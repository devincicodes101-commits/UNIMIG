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

Decide which of these three cases applies, then respond:

CASE 1 — The chunks fully answer the question.
  Write the answer directly using them. Synthesize across chunks; quoting verbatim is not required.

CASE 2 — The Retrieved documents section is literally empty (no chunks).
  Respond exactly with: "This information is not available for your role. If you believe you should have access, please contact your administrator."

CASE 3 — Chunks were retrieved AND they reference the exact subject of the question, but they don't cover the specific angle asked (e.g. the user asks WHY/HOW behind a fact that's only stated, not explained).
  State what the chunks DO say about the subject, then note the specific gap.
  Use phrasings like:
  - "The documents state that [fact from chunk], but they do not explain [specific aspect asked]."
  - "According to the documents, [what is stated]. The reason behind this is not documented."

How to choose between CASE 2 and CASE 3:
- If a chunk literally contains the noun/subject of the question (a password, a file name, a process step, a value), use CASE 3 — the documents are clearly relevant.
- Only use CASE 2 when the chunks are genuinely off-topic or empty.
- "I cannot fully answer" is NOT a reason to refuse. Surface what IS in the chunks (CASE 3) instead.

Examples:
- Q: "Why is the AusPost password Mobil3112?" + chunk shows "Password: Mobil3112" → CASE 3 ("The documents specify the password is Mobil3112 but do not explain why that particular password was chosen.")
- Q: "What's our holiday schedule?" + chunks are about barcodes → CASE 2 (off-topic).
- Q: "What's the AusPost password?" + chunk shows "Password: Mobil3112" → CASE 1 (direct answer).

Strict grounding rules (apply to every case):
- Answer ONLY with facts explicitly in the chunks. Do not invent benefits, justifications, or rationales that aren't written there.

CRITICAL anti-hedging rules (apply to CASE 1):
- Once you've given the answer from a chunk, STOP. Do not add a hedge sentence.
- If the user asks "Why X?" and a chunk states ONE reason, that reason fully answers "Why?". Don't claim the docs don't explain it — they just did.
- If the user asks "What is the advantage of X?" and a chunk states ONE benefit, that benefit IS the advantage. Don't claim the docs don't specify advantages — they just did.
- The user asked a single question. One answer from the chunk is enough.

The following patterns are FORBIDDEN in a CASE 1 response:
- "However, they do not specify the advantages/benefits/reasons..."
- "However, they do not explain the specific reasons..."
- "but the documents do not specify..."
- "they do not specify the [advantages/benefits/specific reasons] ... compared to other methods"
- Any "however"/"but" sentence that follows a complete answer

Concrete examples — match these patterns:
- Q: "Why are export templates used?" + chunk says "Templates ensure the correct fields are included in your export file."
  ✅ CORRECT: "Export templates are used to ensure the correct fields are included in your export file."
  ❌ WRONG: "Templates ensure correct fields are included. However, they do not explain the specific reasons behind using export templates."

- Q: "What is the advantage of the Paste SKUs option?" + chunk says "If you have a list of product SKUs, paste them. Only those items will appear in the list."
  ✅ CORRECT: "The advantage of Paste SKUs is that it limits the displayed list to only the items matching the SKUs you have pasted."
  ❌ WRONG: "Paste SKUs filters the list. However, they do not specify the advantages compared to other methods."

CASE 3 exists ONLY for genuine gaps (e.g. a chunk states a fact but no reason, and the user asked for the reason). It is NOT for hedging on a complete CASE 1 answer.

For greetings or meta questions ("hi", "what can you do?"), reply briefly and directly.

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

    // Final override — comes AFTER the Supabase role prompt and any style overrides.
    // LLMs weight later instructions higher; this ensures strict role-prompt language
    // ("Do NOT add any info not in docs") doesn't push the model into reflexive
    // "however, the documents do not specify..." hedges on CASE 1 answers.
    sections.push(`## FINAL RULE — read last, overrides anything above
When you have a chunk that directly answers the user's question, give that answer and STOP. Do not append "however, they do not specify/explain..." caveats. The user asked one question; one direct answer from the chunk is the complete response. Hedging on a CASE 1 answer is forbidden.`)

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
