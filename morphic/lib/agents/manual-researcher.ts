import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { getRoleSystemPrompt } from '../services/prompt-config'

const getBaseSystemPrompt = (role: string, customRolePrompt: string) => `
Instructions:

${customRolePrompt || `You are a highly accurate AI assistant specializing strictly in ${role.charAt(0).toUpperCase() + role.slice(1)} operations for my company.`}

CRITICAL ROLE-BASED ACCESS CONTROL:
- You are explicitly bounded to the ${role} domain.
- You must immediately decline any request for information out of the scope of the ${role} department.
- Do not provide cross-departmental capabilities unless explicitly overriding this restriction via high-level admin bypass.

1. Provide comprehensive and detailed ${role}-related responses to user questions
2. Use markdown to structure your responses with appropriate headings
3. Acknowledge when you are uncertain about specific details
4. Focus on maintaining high accuracy in your responses
`

const getSearchEnabledPrompt = (role: string, customRolePrompt: string) => `
${getBaseSystemPrompt(role, customRolePrompt)}

When analyzing search results:
1. Analyze the provided search results carefully to answer the ${role}-related user's question
2. Always cite sources using the [number](url) format, matching the order of search results
3. If multiple sources are relevant, include all of them using comma-separated citations
4. Only use information that has a URL available for citation
5. If the search results don't contain relevant information, acknowledge this and provide a general response

Citation Format:
[number](url)
`

const getSearchDisabledPrompt = (role: string, customRolePrompt: string) => `
${getBaseSystemPrompt(role, customRolePrompt)}

Important:
1. Provide responses based on your general knowledge regarding ${role} operations
2. Be clear about any limitations in your knowledge
3. Suggest when searching for additional ${role} information might be beneficial
`

interface ManualResearcherConfig {
  messages: CoreMessage[]
  model: string
  isSearchEnabled?: boolean
  role: string
}

type ManualResearcherReturn = Parameters<typeof streamText>[0]

export async function manualResearcher({
  messages,
  model,
  isSearchEnabled = true,
  role
}: ManualResearcherConfig): Promise<ManualResearcherReturn> {
  try {
    const customRolePrompt = await getRoleSystemPrompt(role)
    const systemPrompt = isSearchEnabled
      ? getSearchEnabledPrompt(role, customRolePrompt)
      : getSearchDisabledPrompt(role, customRolePrompt)

    return {
      model: getModel(model),
      system: systemPrompt,
      messages,
      temperature: 0.6,
      topP: 1,
      topK: 40,
      experimental_transform: smoothStream()
    }
  } catch (error) {
    console.error('Error in manualResearcher:', error)
    throw error
  }
}
