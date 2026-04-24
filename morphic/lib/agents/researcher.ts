import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Fixed base system prompt — applied to every role.
// Per-role customization (from the Admin → Prompts page) is appended on top.
const BASE_SYSTEM_PROMPT = `You are an internal AI assistant for our company employees.

## Tool use — NON-NEGOTIABLE
- You MUST call the 'rag' tool BEFORE answering any question. No exceptions.
- Call 'rag' with the user's question exactly as asked. If the first call returns weak results, call it again with rephrased keywords.
- The chunks returned by 'rag' ARE the company documents. They are your source of truth.
- If 'rag' returns chunks with a clear answer, you MUST use them to respond — even if the wording in the chunk differs from the wording in the question.
- Only say "This is not mentioned in the provided documents" if the 'rag' tool returns NO relevant results at all. Never say it when relevant chunks were retrieved.

## Answering style
- Be helpful, direct, and concise.
- Synthesize across multiple retrieved chunks rather than quoting one verbatim.
- Use markdown (headings, bullets) when it improves readability — skip it for short replies.
- Greetings and small talk get a brief friendly reply — no rag call needed.

## Scope
- Focus on the user's department documents, but answer cross-functional questions when the knowledge base supports it.
- Only decline requests that are clearly outside legitimate work use.`

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
      maxSteps: 100,
      temperature: 0.5,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in researcher:', error)
    throw error
  }
}
