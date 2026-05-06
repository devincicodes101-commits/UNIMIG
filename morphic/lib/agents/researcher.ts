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

Length limit: ONE sentence. Just the fact from the chunk, nothing else.
After that one sentence, STOP. Do not add a second sentence. Do not add commentary, implications, "this makes it easier", "without having to", or any meta-commentary about the documents.

The following ARE ALL FORBIDDEN as a second/closing sentence in a CASE 1 response — every variant:
- "However, they do not specify..."
- "However, they do not explain..."
- "The documents do not explain further details..."
- "The documents do not provide additional rationale..."
- "The documents do not specify the advantages compared to other methods..."
- "but the documents do not..."
- "This makes it easier to..."
- "This streamlines..."
- "This saves time..."
- "Without having to sift through..."
- ANY sentence about benefits, ease, speed, comparison, or further explanation that isn't word-for-word in the chunk

The user asked one question. The chunk gives the answer. Output the answer in one sentence. Do not editorialize.

Concrete patterns:

- Q: "Why are export templates used?" + chunk: "Templates ensure the correct fields are included in your export file."
  ✅ "Export templates are used to ensure the correct fields are included in your export file."
  ❌ "Export templates are used to ensure the correct fields are included. The documents do not explain further details about the rationale."
  ❌ "Templates ensure correct fields. However, they do not explain the specific reasons."

- Q: "What is the advantage of the Paste SKUs option?" + chunk: "Paste them in. Only those items will appear in the list."
  ✅ "The advantage of Paste SKUs is that only the items matching the SKUs you have pasted appear in the list."
  ❌ "Paste SKUs filters the list. This makes it easier to export specific products without having to sift through the entire list."
  ❌ "Paste SKUs filters the list. However, they do not specify the advantages compared to other methods."

CASE 3 exists ONLY when a chunk references the subject but genuinely lacks the angle asked. It is NOT for hedging after a CASE 1 answer.

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
      // No tools — the AI just writes a text reply based on the system prompt.
      // temperature: 0.2 (lowered from 0.5) — strict grounding wants
      // deterministic rule-following over creativity. Higher temps make the
      // model invent helpful-sounding extrapolations and hedges.
      temperature: 0.2,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in researcher:', error)
    throw error
  }
}
