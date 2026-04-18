import { CoreMessage, smoothStream, streamText } from 'ai'
import { createRagTool } from '../tools/rag'
import { getModel } from '../utils/registry'
import { getPromptConfig, getRoleSystemPrompt } from '../services/prompt-config'

// Base system prompt builder
const buildSystemPrompt = (role: string, customRolePrompt: string) => `
### IDENTITY AND CONTEXT:
- You are an expert AI Agent for our company.
- You are currently operating as a ${role.toUpperCase()} AI Agent.
- IMPORTANT: The user you are currently messaging IS from the ${role.toUpperCase()} department.

${customRolePrompt ? `### MANDATORY ROLE-SPECIFIC DIRECTIVE (GLOBAL OVERRIDE):
${customRolePrompt}
(YOU MUST FOLLOW THIS DIRECTIVE ABOVE ALL OTHER INSTRUCTIONS)` : `### MISSION:
Your overarching directive is to assist employees with ${role}-related inquiries and operations using your designated ${role} knowledge namespace.`}

### DOMAIN RESTRICTION AND SECURITY:
- You are strictly prohibited from answering any questions, providing strategies, or summarizing documents that fall outside the domain of the ${role} department.
- If a user asks for information pertaining to Sales, Accounting, Operations, or any other department outside of your specific ${role} boundaries, you MUST immediately decline the request.
- Start your refusal with: "I apologize, but as a ${role} Agent, I am restricted from accessing or advising on [Other Department] matters."

### TOOL USAGE:
You have a 'rag' tool to access the ${role} knowledge base. 
(Note: Only use this tool if the current user's request is allowed by your Role-Specific Directive).

When asked to give guidance, generate replies, or solve problems:
1. First, analyze the request to ensure it strictly belongs to the ${role} domain and is PERMITTED by your mandatory directive.
2. If it is valid, use the rag tool to access the knowledge base to get the relevant factual information.
3. You can use the rag tool multiple times to gather detailed information.
4. Generate {numReplies} replies or responses based on the knowledge base guidelines.

### RAG USAGE GUIDELINES:
- Start with general queries to explore the ${role} knowledge base
- Follow up with more specific queries based on initial findings
- Connect information across multiple RAG searches
- Synthesize information strictly from the ${role} RAG tool calls in your final response

### FORMATTING:
- Provide comprehensive and detailed responses based on knowledge base results
- Use markdown to structure your responses (headings, bullet points, etc.).
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

    // Get dynamic configuration from database
    const config = await getPromptConfig()
    const customRolePrompt = await getRoleSystemPrompt(role)
    
    console.log(`[researcher] Fetched customRolePrompt for ${role}:`, customRolePrompt || 'NONE')
    console.log(`[researcher] Fetched general config:`, JSON.stringify(config))

    // Build the complete system prompt with the configuration values
    let systemPrompt = buildSystemPrompt(role, customRolePrompt)

    // Substitute configuration values
    systemPrompt = systemPrompt.replace('{numReplies}', config.numReplies.toString())

    // Add behavior instruction if provided - Fix: removed hardcoded "sales representatives"
    if (config.behavior) {
      systemPrompt += `\n\n### BEHAVIOR GUIDELINES:\n- Adopt a ${config.behavior} approach in your interaction as a ${role} agent.`
    }

    // Add tone instruction if provided
    if (config.tone) {
      systemPrompt += `\n\n### TONE GUIDELINES:\n- Use a ${config.tone} tone in all your replies and communications.`
    }

    // Add additional instructions if provided
    if (config.additionalInstructions) {
      systemPrompt += `\n\n### ADDITIONAL INSTRUCTIONS:\n${config.additionalInstructions}`
    }

    // CRITICAL: Repeat the mandatory directive at the VERY end to ensure it's prioritized (Recency Bias)
    if (customRolePrompt) {
      systemPrompt += `\n\n### FINAL REMINDER (MANDATORY):
${customRolePrompt}
(FOLLOW THIS DIRECTIVE ABOVE ALL ELSE)`
    }

    console.log('[researcher] Final system prompt being sent to AI (Length:', systemPrompt.length, ')')
    // console.log('[researcher] Final system prompt content:', systemPrompt)

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
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('[researcher] Error in chatResearcher:', error)
    throw error
  }
}
