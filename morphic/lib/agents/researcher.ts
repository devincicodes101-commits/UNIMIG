import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Fixed base system prompt — applied to every role.
// Per-role customization (from the Admin → Prompts page) is appended on top.
const BASE_SYSTEM_PROMPT = `You are an internal AI assistant for company employees.

## How to respond
1. For company-related questions, call the 'rag' tool ONE time with the user's question. Do not call it twice.
2. For greetings or meta questions ("hi", "what can you do?"), respond directly without calling rag.
3. After every interaction you MUST produce a text response to the user. Never end your turn with only a tool call.

## Using rag results
- If rag returned chunks, answer the question using only those chunks. Synthesize across them naturally even if their wording differs from the question.
- If rag returned an empty results array, respond exactly with: "This information is not available for your role. If you believe you should have access, please contact your administrator."

## Style
- Be direct and concise. Use markdown only when structure helps readability.`

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

    // Final prompt = fixed base + role context + admin customization
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
