import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    
    // Validate the request body
    const { question, ai_response, correct_response, timestamp } = body
    
    if (!question || !ai_response || !correct_response || !timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Forward the feedback to the RAG server
    const ragServerUrl = 'https://companychatbot.onrender.com'
    
    const response = await fetch(`${ragServerUrl}/feedback/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        question,
        ai_response,
        correct_response,
        timestamp
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`RAG server error: ${errorData.detail || response.statusText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error processing feedback:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const timestamp = url.searchParams.get('timestamp')
    const limit = url.searchParams.get('limit') || '10'
    
    // Build the query to fetch feedback from the vector database
    const ragServerUrl = 'https://companychatbot.onrender.com'
    let apiUrl = `${ragServerUrl}/list-feedback`
    
    // Add query parameters if provided
    const params = new URLSearchParams()
    if (timestamp) params.append('timestamp', timestamp)
    params.append('limit', limit)
    
    if (params.toString()) {
      apiUrl += `?${params.toString()}`
    }
    
    console.log("Fetching feedback from:", apiUrl);
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`RAG server error: ${errorData.detail || response.statusText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error retrieving feedback:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const timestamp = url.searchParams.get('timestamp')
    const vector_id = url.searchParams.get('vector_id')
    
    if (!timestamp && !vector_id) {
      return NextResponse.json(
        { error: 'Either timestamp or vector_id parameter is required' },
        { status: 400 }
      )
    }
    
    const ragServerUrl = 'https://companychatbot.onrender.com'
    let apiUrl
    
    if (vector_id) {
      apiUrl = `${ragServerUrl}/delete-feedback-by-id/?vector_id=${encodeURIComponent(vector_id)}`
    } else {
      apiUrl = `${ragServerUrl}/delete-feedback-by-timestamp/?timestamp=${encodeURIComponent(timestamp!)}`
    }
    
    const response = await fetch(apiUrl, {
      method: 'DELETE'
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`RAG server error: ${errorData.detail || response.statusText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error deleting feedback:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    
    // Validate the request body
    const { vector_id, question, ai_response, correct_response, improved_response } = body
    
    if (!vector_id || (!question && !ai_response && !correct_response && !improved_response)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Forward the update to the RAG server
    const ragServerUrl = 'https://companychatbot.onrender.com'
    
    const response = await fetch(`${ragServerUrl}/update-feedback/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`RAG server error: ${errorData.detail || response.statusText}`)
    }
    
    const result = await response.json()
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error updating feedback:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 