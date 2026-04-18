import { tool } from 'ai'
import { z } from 'zod'
import { getAbsoluteUrl } from '../utils'

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

const RAG_URL = getAbsoluteUrl(process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000')

// Roles the RAG server recognises — anything else falls back to "unassigned"
const VALID_ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting', 'unassigned']

function sanitizeRole(role: string): string {
  const normalised = role?.toLowerCase?.().trim() ?? 'unassigned'
  return VALID_ROLES.includes(normalised) ? normalised : 'unassigned'
}

async function queryRAGServer(query: string, role: string): Promise<RAGResponse> {
  const safeRole = sanitizeRole(role)
  console.log(`[RAG] Querying with role="${safeRole}" (original="${role}"), url=${RAG_URL}/query`)

  const response = await fetch(`${RAG_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      role: safeRole,
      top_k: 5
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`RAG server error (${response.status}): ${errorText}`)
  }

  const data = await response.json()

  return {
    results: (data.results ?? []).map((result: any) => ({
      text: result.metadata?.text ?? '',
      score: result.score ?? 0,
      metadata: {
        filename: result.metadata?.filename,
        chunk_index: result.metadata?.chunk_index,
        total_chunks: result.metadata?.total_chunks,
        timestamp: result.metadata?.timestamp,
        namespace: result.metadata?.namespace,
      }
    })),
    query
  }
}

export const createRagTool = (role: string) => tool({
  description: 'Search for information in the company knowledge base using semantic search',
  parameters: ragSchema,
  execute: async ({ query }) => {
    try {
      const results = await queryRAGServer(query, role)
      console.log(`[RAG] Got ${results.results.length} results for query: "${query}"`)
      return results
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
