import { CoreMessage, smoothStream, streamText } from 'ai'
import { queryRAGServer } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Greeting / meta-question detector — short messages where rag is unnecessary
const GREETING_PATTERNS = [
  /^(hi|hello|hey|yo|sup|hola|good\s+(morning|afternoon|evening))[!.\s]*$/i,
  /^(thanks|thank\s+you|ty|thx)[!.\s]*$/i,
  /^(what\s+can\s+you\s+do|who\s+are\s+you|what\s+are\s+you)\??$/i
]
const isGreeting = (text: string) =>
  text.trim().length < 60 && GREETING_PATTERNS.some(p => p.test(text.trim()))

// Extract the last user message from the conversation
function getLastUserText(messages: CoreMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user') {
      const c = m.content
      if (typeof c === 'string') return c
      if (Array.isArray(c)) {
        const textPart = c.find((p: any) => p.type === 'text')
        return (textPart as any)?.text || ''
      }
    }
  }
  return ''
}

const BASE_INSTRUCTION = `You are an internal AI assistant for company employees. You have already searched the company's role-restricted knowledge base for the user's question. The retrieved chunks (if any) are provided below in the "Retrieved documents" section.

Your job — handle these three cases distinctly:

CASE 1 — Retrieved documents contain a direct answer:
  Write a clear, direct response using them. Synthesize across chunks naturally; you do not need to quote them verbatim.

CASE 2 — Retrieved documents section is empty (no chunks at all):
  Respond exactly with: "This information is not available for your role. If you believe you should have access, please contact your administrator."

CASE 3 — Retrieved documents exist on the topic but don't answer the user's specific question:
  State what the documents DO say on the topic, then explicitly note that the specific aspect they asked about is not covered. Example phrasings:
  - "The documents specify that [what is documented], but they do not explain [what was asked]."
  - "According to the documents, [what is stated]. The reason behind this is not documented."
  Do NOT use the "not available for your role" response in this case — the documents ARE available, they just don't cover that specific angle.

For greetings or meta questions ("hi", "what can you do?"), respond briefly and directly.

You MUST always reply with a text response. Never reply silently.`

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

    const lastUserText = getLastUserText(messages)
    console.log(`[researcher] last user message: ${lastUserText.slice(0, 100)}`)

    // Inline RAG: call the search server directly here, BEFORE the LLM runs.
    // This avoids the tool-calling path where the model sometimes ended its
    // turn with no text. The model now just receives "user question + retrieved
    // docs" and writes a normal text reply.
    let retrievedBlock = ''
    if (lastUserText && !isGreeting(lastUserText)) {
      try {
        const ragResponse = await queryRAGServer(lastUserText, role)
        const chunks = ragResponse.results || []
        console.log(`[researcher] inline rag returned ${chunks.length} chunks`)
        if (chunks.length > 0) {
          retrievedBlock = chunks
            .map((c, i) => `[Chunk ${i + 1}] ${c.text}`)
            .join('\n\n---\n\n')
        }
      } catch (err) {
        console.error('[researcher] inline rag failed:', err)
      }
    }

    // Assemble the system prompt
    const sections: string[] = [BASE_INSTRUCTION]

    sections.push(`## Current session
Acting as the **${role.toUpperCase()}** assistant for a user from the ${role.toUpperCase()} department.`)

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

    // Retrieved docs section — placed near the end so the model sees it after rules
    sections.push(
      retrievedBlock
        ? `## Retrieved documents (use these to answer)\n\n${retrievedBlock}`
        : `## Retrieved documents\n\n(empty — no relevant chunks were retrieved for this query)`
    )

    const systemPrompt = sections.join('\n\n')
    console.log('[researcher] Final system prompt length:', systemPrompt.length)

    return {
      model: getModel(model),
      system: systemPrompt,
      messages,
      // No tools — the AI just writes a text reply based on the system prompt
      temperature: 0.5,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in researcher:', error)
    throw error
  }
}
