import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdmin } from '@/lib/auth'
import { promptConfigSchema } from '@/lib/schema/prompt-config'

export async function GET() {
  try {
    // console.log('[prompt-config] GET request received')
    
    // Verify admin access
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      // console.log('[prompt-config] GET unauthorized access')
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    // Get the latest prompt configuration
    // console.log('[prompt-config] Fetching from database')
    const { data, error } = await supabaseAdmin
      .from('prompt_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('[prompt-config] Error fetching data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch prompt configuration' },
        { status: 500 }
      )
    }

    // console.log('[prompt-config] Raw data from DB:', data)

    // Transform snake_case database columns to camelCase for frontend
    const formattedData = data ? {
      id: data.id,
      behavior: data.behavior,
      tone: data.tone,
      numReplies: data.num_replies,
      additionalInstructions: data.additional_instructions,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    } : {}

    // console.log('[prompt-config] Formatted data for frontend:', formattedData)
    
    return NextResponse.json(formattedData)
  } catch (error) {
    console.error('[prompt-config] Error in GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // console.log('[prompt-config] POST request received')
    
    // Verify admin access
    const adminAccess = await isAdmin()
    if (!adminAccess) {
      // console.log('[prompt-config] POST unauthorized access')
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      )
    }

    // Parse the request body
    const body = await request.json()
    // console.log('[prompt-config] Request body:', body)
    
    // Validate with zod schema
    const parsedData = promptConfigSchema.parse(body)
    // console.log('[prompt-config] Parsed data:', parsedData)
    
    // Add timestamps and transform camelCase to snake_case for database
    const now = new Date()
    const dataWithTimestamps = {
      behavior: parsedData.behavior,
      tone: parsedData.tone,
      num_replies: parsedData.numReplies,
      additional_instructions: parsedData.additionalInstructions,
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    }

    // console.log('[prompt-config] Data to insert:', dataWithTimestamps)

    // Insert into database
    const { data, error } = await supabaseAdmin
      .from('prompt_config')
      .insert(dataWithTimestamps)
      .select()
      .single()

    if (error) {
      console.error('[prompt-config] Error saving prompt config:', error)
      return NextResponse.json(
        { error: 'Failed to save prompt configuration' },
        { status: 500 }
      )
    }

    // console.log('[prompt-config] Data returned from DB after insert:', data)

    // Transform back to camelCase for frontend response
    const formattedResponse = {
      id: data.id,
      behavior: data.behavior,
      tone: data.tone,
      numReplies: data.num_replies,
      additionalInstructions: data.additional_instructions,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    }

    // console.log('[prompt-config] Formatted response:', formattedResponse)

    return NextResponse.json(formattedResponse)
  } catch (error) {
    console.error('[prompt-config] Error in POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 