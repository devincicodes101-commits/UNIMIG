import { NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth'
import { getAbsoluteUrl } from '@/lib/utils'

interface ResultItem {
  id: string
  score: number
  metadata: Record<string, any>
  is_correction?: boolean
  [key: string]: any
}

export async function POST(req: Request) {
  try {
    // Get the authenticated user's session and role
    const session = await getAuthSession()
    const role = session?.user?.role || 'unassigned'

    if (role === 'unassigned') {
      return NextResponse.json(
        { error: 'Your account has no role assigned yet. Please contact your administrator.' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { query, top_k } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Use environment variable — falls back to localhost for development
    const ragServerUrl = getAbsoluteUrl(process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000')

    const response = await fetch(`${ragServerUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        top_k: top_k || 5,
        role,                            // ← pass user's role for namespace filtering
        user_id: session?.user?.id,
        user_email: session?.user?.email,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`RAG server error: ${errorData.detail || response.statusText}`)
    }

    const result = await response.json()

    // Mark high-priority correction/feedback items
    if (result.results) {
      result.results = result.results.map((item: ResultItem) =>
        item.is_correction
          ? { ...item, priority: 'high', source: 'feedback', type: 'correction' }
          : item
      )
    }

    // Log conversation to RAG server (fire-and-forget, don't block response)
    if (result.results?.length > 0 && session?.user) {
      const answer = result.results
        .map((r: ResultItem) => r.metadata?.text || '')
        .join('\n\n')

      fetch(`${ragServerUrl}/log-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          user_email: session.user.email,
          role,
          question: query,
          answer,
          sources: result.sources || [],
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {/* silent — logging should never break chat */})
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