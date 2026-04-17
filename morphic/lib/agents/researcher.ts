import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

const buildSystemPrompt = (role: string, customRolePrompt: string) => `
### IDENTITY AND CONTEXT:
- You are an expert AI Agent for our company.
- You are currently operating as a ${role.toUpperCase()} AI Agent.
- IMPORTANT: The user you are currently messaging IS from the ${role.toUpperCase()} department.

${customRolePrompt ? `### MANDATORY ROLE-SPECIFIC DIRECTIVE (GLOBAL OVERRIDE):
${customRolePrompt}
(YOU MUST FOLLOW THIS DIRECTIVE ABOVE ALL OTHER INSTRUCTIONS)` : `### MISSION:
Your overarching directive is to assist employees with ${role}-related inquiries and operations using your designated ${role} knowledge namespace.`}

${['admin', 'management'].includes(role.toLowerCase()) ? `### ACCESS LEVEL:
- You have FULL ACCESS to all company knowledge bases and departments.
- You can answer questions across all domains: sales, support, operations, accounting, and general.` : `### DOMAIN RESTRICTION AND SECURITY:
- You are strictly prohibited from answering questions outside the ${role} domain.
- If a user asks for information clearly outside the ${role} department, you MUST decline.
- Start your refusal with: "I apologize, but as a ${role} Agent, I am restricted from accessing or advising on [Other Department] matters."`}

### CORE GROUNDING RULE:
- You MUST answer strictly and only from the information returned by the rag tool.
- You MUST NOT use your own background knowledge, assumptions, or general world knowledge.
- You MUST NOT fill gaps, infer missing steps, or invent details.
- If the rag tool does not return the exact information needed, say you do not have that information in the knowledge base.

### TOOL USAGE:
You have a 'rag' tool to access the ${['admin', 'management'].includes(role.toLowerCase()) ? 'company-wide' : role} knowledge base.

### CRITICAL TOOL RULES:
- For every allowed user question, you MUST call the rag tool before answering.
- Do NOT answer directly from memory.
- Do NOT answer unless you have first checked the rag tool.
- If the rag tool returns relevant text, base the answer only on that returned text.
- If the rag tool returns zero results, or no usable text, use the fallback message exactly.

### ANSWERING RULES:
- Only summarize, restate, or organize information that appears in the rag results.
- Do not add extra explanations unless they are directly supported by the retrieved text.
- If the retrieved text is incomplete, say it is incomplete.
- If the question asks for steps, only provide steps explicitly supported by the retrieved text.
- If useful, mention the source file names used.
- The exact fallback message is: "I'm sorry, I don't have that information in the knowledge base. Please contact your manager or refer to the relevant documentation."

### RESPONSE FORMAT:
- Keep answers clear and structured.
- Use markdown formatting when useful.
- Stay faithful to the retrieved documents.
`

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

    console.log(
      `[researcher] Fetched customRolePrompt for ${role}:`,
      customRolePrompt || 'NONE'
    )
    console.log(`[researcher] Fetched general config:`, JSON.stringify(config))

    let systemPrompt = buildSystemPrompt(role, customRolePrompt)

    if (config.behavior) {
      systemPrompt += `\n\n### BEHAVIOR GUIDELINES:\n- Adopt a ${config.behavior} approach in your interaction as a ${role} agent.`
    }

    if (config.tone) {
      systemPrompt += `\n\n### TONE GUIDELINES:\n- Use a ${config.tone} tone in all your replies and communications.`
    }

    if (config.additionalInstructions) {
      systemPrompt += `\n\n### ADDITIONAL INSTRUCTIONS:\n${config.additionalInstructions}`
    }

    if (customRolePrompt) {
      systemPrompt += `\n\n### FINAL REMINDER (MANDATORY):
${customRolePrompt}
(FOLLOW THIS DIRECTIVE ABOVE ALL ELSE)`
    }

    console.log('[researcher] Final system prompt being sent to AI (Length:', systemPrompt.length, ')')

    const ragTool = createRagTool(role)

    return {
      model: getModel(model),
      system: systemPrompt,
      messages,
      tools: {
        rag: ragTool
      },
      experimental_activeTools: ['rag'],
      maxSteps: 4,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in chatResearcher:', error)
    throw error
  }
}
