import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { generateText } from 'ai'
import { queryRAGServer } from '@/lib/tools/rag'
import { researcher } from '@/lib/agents/researcher'
import { Model } from '@/lib/types/models'
import { CoreMessage } from 'ai'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 30

const DEFAULT_MODEL: Model = {
  id: 'gpt-4o-mini',
  name: 'GPT-4o mini',
  provider: 'OpenAI',
  providerId: 'openai',
  enabled: true,
  toolCallType: 'native'
}

/**
 * Debug endpoint — visit this URL with ?q=your+question to see the full
 * pipeline output as JSON. Reveals exactly which step is failing.
 *
 * Example:
 *   https://unimig.vercel.app/api/debug-chat?q=What+are+the+barcode+formats
 */
export async function GET(req: Request) {
  const startedAt = Date.now()
  const trace: Record<string, any> = {
    started_at: new Date().toISOString(),
    steps: []
  }
  const log = (label: string, payload: any) => {
    trace.steps.push({
      label,
      ms_since_start: Date.now() - startedAt,
      ...payload
    })
  }

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q') || 'hello'
    log('parsed_query', { query })

    // Step 1 — Resolve session and role
    const session = await getServerSession(authOptions)
    const role = (session?.user as any)?.role || 'unassigned'
    log('session', {
      authenticated: !!session?.user,
      role,
      user_email: (session?.user as any)?.email || null
    })

    // Step 2 — Call rag server directly (same call inline RAG would make)
    let ragResult: any = null
    let ragError: string | null = null
    try {
      const t0 = Date.now()
      ragResult = await queryRAGServer(query, role)
      log('rag_call', {
        ms: Date.now() - t0,
        chunk_count: ragResult.results?.length ?? 0,
        top_score: ragResult.results?.[0]?.score ?? null,
        first_chunk_preview: (ragResult.results?.[0]?.text || '').slice(0, 200),
        all_filenames: [...new Set((ragResult.results || []).map((r: any) => r.metadata?.filename))]
      })
    } catch (e: any) {
      ragError = e?.message || String(e)
      log('rag_call_FAILED', { error: ragError })
    }

    // Step 3 — Build the same system prompt the researcher would build
    const messages: CoreMessage[] = [{ role: 'user', content: query }]
    let researcherConfig: any = null
    let researcherError: string | null = null
    try {
      const t0 = Date.now()
      researcherConfig = await researcher({
        messages,
        model: `${DEFAULT_MODEL.providerId}:${DEFAULT_MODEL.id}`,
        searchMode: false,
        role
      })
      log('researcher_built', {
        ms: Date.now() - t0,
        system_prompt_length: researcherConfig.system?.length ?? 0,
        system_prompt_preview: (researcherConfig.system || '').slice(0, 500),
        has_tools: !!researcherConfig.tools,
        temperature: researcherConfig.temperature
      })
    } catch (e: any) {
      researcherError = e?.message || String(e)
      log('researcher_FAILED', { error: researcherError })
    }

    // Step 4 — Actually call the LLM (non-streaming, generateText) and see what
    // it produces. This is the moment of truth — if generateText returns text
    // here but the streaming endpoint produces nothing, the bug is in the
    // streaming setup. If generateText returns nothing here, it is a prompt
    // or model issue.
    let llmText: string | null = null
    let llmError: string | null = null
    let llmFinishReason: string | null = null
    let llmUsage: any = null
    if (researcherConfig) {
      try {
        const t0 = Date.now()
        const result = await generateText({
          model: researcherConfig.model,
          system: researcherConfig.system,
          messages: researcherConfig.messages,
          temperature: researcherConfig.temperature
        })
        llmText = result.text
        llmFinishReason = result.finishReason
        llmUsage = result.usage
        log('llm_call', {
          ms: Date.now() - t0,
          text_length: llmText?.length ?? 0,
          text_preview: (llmText || '').slice(0, 500),
          finish_reason: llmFinishReason,
          usage: llmUsage
        })
      } catch (e: any) {
        llmError = e?.message || String(e)
        log('llm_call_FAILED', { error: llmError })
      }
    }

    return NextResponse.json({
      query,
      role,
      total_ms: Date.now() - startedAt,
      rag_chunks_found: ragResult?.results?.length ?? 0,
      llm_text: llmText,
      llm_text_length: llmText?.length ?? 0,
      llm_finish_reason: llmFinishReason,
      llm_usage: llmUsage,
      errors: {
        rag: ragError,
        researcher: researcherError,
        llm: llmError
      },
      trace
    }, { status: 200 })
  } catch (error: any) {
    log('uncaught_exception', { error: error?.message || String(error), stack: error?.stack })
    return NextResponse.json({
      error: error?.message || String(error),
      trace
    }, { status: 500 })
  }
}
