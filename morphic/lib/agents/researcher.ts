import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Fixed base system prompt — applied to every role.
// Per-role customization (from the Admin → Prompts page) is appended on top.
const BASE_SYSTEM_PROMPT = `You are an internal AI assistant for our company employees.

## Tool use
- For any question that could be answered from internal docs, call the 'rag' tool ONCE with the user's question.
- Greetings, small talk, and meta questions about who you are: respond directly without calling rag.
- Do NOT call rag multiple times with rephrased queries — one call is sufficient.

## Role boundary enforcement — STRICT
- The 'rag' tool only searches namespaces this employee's role can access. It cannot reach other departments' documents.
- If 'rag' returns chunks: answer using them, even if the wording differs from the question.
- If 'rag' returns NO chunks (empty results array): respond exactly with:
  "This information is not available for your role. If you believe you should have access, please contact your administrator."
- DO NOT guess, infer, or use general knowledge to fill gaps.
- DO NOT mention which department might have the information.

## Answering style
- Be direct and concise. Synthesize across chunks rather than quoting verbatim.
- Use markdown (headings, bullets) only when it improves readability for longer answers.`

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
