import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getAbsoluteUrl, getVercelBypassHeaders } from '@/lib/utils'

interface ResultItem {
  id?: string
  score?: number
  metadata?: Record<string, any>
  text?: string
  content?: string
  chunk?: string
  pageContent?: string
  document?: string
  is_correction?: boolean
  [key: string]: any
}

function extractResultText(item: ResultItem): string {
  return (
    item?.metadata?.text ??
    item?.text ??
    item?.content ??
    item?.chunk ??
    item?.pageContent ??
    item?.document ??
    ''
  )
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession()
    const body = await req.json()
    const { query, top_k, role: bodyRole } = body
    const role = session?.user?.role || bodyRole || 'unassigned'

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

     const ragServerUrl = getAbsoluteUrl(
  process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
)

const response = await fetch(`${ragServerUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getVercelBypassHeaders() },
      body: JSON.stringify({
        query,
        top_k: top_k || 5,
        role,
        user_id: session?.user?.id,
        user_email: session?.user?.email
      }),
      cache: 'no-store'
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`RAG server error: ${errorText || response.statusText}`)
    }

    const result = await response.json()

    if (result.results) {
      result.results = result.results.map((item: ResultItem) =>
        item.is_correction
          ? { ...item, priority: 'high', source: 'feedback', type: 'correction' }
          : item
      )
    }

    if (result.results?.length > 0 && session?.user) {
      const answer = result.results
        .map((r: ResultItem) => extractResultText(r))
        .filter(Boolean)
        .join('\n\n')

      fetch(`${ragServerUrl}/log-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getVercelBypassHeaders() },
        body: JSON.stringify({
          user_id: session.user.id,
          user_email: session.user.email,
          role,
          question: query,
          answer,
          sources: result.sources || [],
          timestamp: new Date().toISOString()
        })
      }).catch(() => {})
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error querying RAG server:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
