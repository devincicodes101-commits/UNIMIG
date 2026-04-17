import { tool } from 'ai'
import { z } from 'zod'
import { getAbsoluteUrl, getVercelBypassHeaders } from '../utils'

const ragSchema = z.object({
  query: z.string().describe('The search query to find relevant information')
})

interface RAGResponse {
  results: Array<{
    text: string
    score: number
    metadata: Record<string, any>
  }>
  query: string
}

const VALID_ROLES = [
  'admin',
  'management',
  'sales',
  'support',
  'operations',
  'accounting',
  'unassigned'
]

function sanitizeRole(role: string): string {
  const normalised = role?.toLowerCase?.().trim() ?? 'unassigned'
  return VALID_ROLES.includes(normalised) ? normalised : 'unassigned'
}

function extractResultText(result: any): string {
  return (
    result?.metadata?.text ??
    result?.text ??
    result?.content ??
    result?.chunk ??
    result?.pageContent ??
    result?.document ??
    ''
  )
}

async function queryRAGServer(query: string, role: string): Promise<RAGResponse> {
  const safeRole = sanitizeRole(role)

  // IMPORTANT:
  // Call the app's internal Next route instead of the protected public Vercel /api/python URL.
  const queryUrl = getAbsoluteUrl('/api/query')

  console.log(
    `[RAG] Querying internal route with role="${safeRole}" (original="${role}"), url=${queryUrl}`
  )

  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getVercelBypassHeaders() },
    body: JSON.stringify({
      query,
      top_k: 5,
      role: safeRole
    }),
    cache: 'no-store'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`RAG route error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  const results = (data.results ?? []).map((result: any) => {
    const text = extractResultText(result)

    return {
      text,
      score: result?.score ?? 0,
      metadata: {
        ...(result?.metadata ?? {}),
        filename: result?.metadata?.filename ?? result?.filename,
        chunk_index: result?.metadata?.chunk_index ?? result?.chunk_index,
        total_chunks: result?.metadata?.total_chunks ?? result?.total_chunks,
        timestamp: result?.metadata?.timestamp ?? result?.timestamp,
        namespace: result?.metadata?.namespace ?? result?.namespace
      }
    }
  })

  console.log(`[RAG] Got ${results.length} mapped results for query: "${query}"`)
  console.log('[RAG] First result preview:', results[0]?.text?.slice(0, 200) || 'NO TEXT')

  return {
    results,
    query
  }
}

export const createRagTool = (role: string) =>
  tool({
    description: 'Search for information in the company knowledge base using semantic search',
    parameters: ragSchema,
    execute: async ({ query }) => {
      try {
        return await queryRAGServer(query, role)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[RAG] Tool execution failed:', msg)

        return {
          results: [],
          query,
          error: msg
        }
      }
    }
  })
