import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Opening of the system prompt — sets up role and tool use
const BASE_SYSTEM_PROMPT = `You are an internal AI assistant for company employees.

## How to respond
1. For company-related questions, call the 'rag' tool ONE time with the user's question. Do not call it twice.
2. For greetings or meta questions ("hi", "what can you do?"), respond directly without calling rag.

## Using rag results
- If rag returned chunks, answer using those chunks. Synthesize naturally even if wording differs from the question.
- If rag returned empty results, respond exactly with: "This information is not available for your role. If you believe you should have access, please contact your administrator."`

// Final, overriding instruction — must come AFTER any Supabase role prompt
// because LLMs weight later instructions higher. Without this at the end,
// strict role prompts ("Do NOT add info not in docs", "Hard Stop Rule") were
// causing the AI to end its turn with zero text tokens — a 0.1kB empty stream.
const FINAL_RESPONSE_RULE = `## CRITICAL OVERRIDE — read this last
You MUST end every turn with a visible text response to the user. A turn
that contains only a tool call and no text is invalid. Even if the
documents say nothing, you must still write a sentence explaining that.
This rule overrides every other instruction above.`

type ResearcherReturn = Parameters<typeof streamText>[0]

export async function researcher({
  messages,
  model,
  searchMode,
  role
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
  role: string
}): Promise<ResearcherReturn> {
  try {
    console.log(`[researcher] Starting researcher for role: ${role}`)

    const config = await getPromptConfig()
    const customRolePrompt = await getRoleSystemPrompt(role)

    console.log(`[researcher] customRolePrompt for ${role}:`, customRolePrompt || 'NONE')

    // Final prompt = base + role context + admin customization + FINAL_RESPONSE_RULE last
    const sections: string[] = [BASE_SYSTEM_PROMPT]

    sections.push(`## Current session
- Acting as the **${role.toUpperCase()}** assistant for a user from the ${role.toUpperCase()} department.`)

    if (customRolePrompt && customRolePrompt.trim()) {
      sections.push(`## Role-specific guidance (from admin)
${customRolePrompt.trim()}`)
    }

    const styleBits: string[] = []
    if (config.behavior) styleBits.push(`Behavior: ${config.behavior}.`)
    if (config.tone) styleBits.push(`Tone: ${config.tone}.`)
    if (config.additionalInstructions && config.additionalInstructions.trim()) {
      styleBits.push(`Additional instructions: ${config.additionalInstructions.trim()}`)
    }
    if (styleBits.length) {
      sections.push(`## Style overrides\n${styleBits.map(s => `- ${s}`).join('\n')}`)
    }

    // FINAL_RESPONSE_RULE goes LAST so it overrides any strict no-respond
    // language in the Supabase role prompt above
    sections.push(FINAL_RESPONSE_RULE)

    const systemPrompt = sections.join('\n\n')

    console.log('[researcher] Final system prompt length:', systemPrompt.length)

    const ragTool = createRagTool(role)

    return {
      model: getModel(model),
      system: systemPrompt,
      messages,
      tools: {
        rag: ragTool
      },
      experimental_activeTools: ['rag'],
      maxSteps: 5,
      temperature: 0.5,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in researcher:', error)
    throw error
  }
}
