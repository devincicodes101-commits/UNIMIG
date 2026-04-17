import { supabaseAdmin } from '../supabase'
import { PromptConfig } from '../schema/prompt-config'
import { getAbsoluteUrl, getVercelBypassHeaders } from '../utils'

// Default configuration
const DEFAULT_CONFIG: PromptConfig = {
  behavior: 'Professional',
  tone: 'Friendly',
  numReplies: 3,
  additionalInstructions: ''
}

// Cache the config with TTL
let configCache: PromptConfig | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes for general config
const ROLE_PROMPT_CACHE_TTL = 10 * 1000 // 10 seconds for role prompts

/**
 * Get the latest prompt configuration from the database
 * Uses caching with a 5-minute TTL to reduce database calls
 */
export async function getPromptConfig(): Promise<PromptConfig> {
  // Use cached value if available and not expired
  const now = Date.now()
  if (configCache && (now - cacheTimestamp) < CACHE_TTL) {
    return configCache
  }

  try {
    // Get the latest prompt configuration
    const { data, error } = await supabaseAdmin
      .from('prompt_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('[prompt-config-service] Error fetching config:', error)
      return DEFAULT_CONFIG
    }

    // Update cache - map from snake_case DB columns to camelCase JS properties
    configCache = data ? {
      id: data.id,
      behavior: data.behavior || DEFAULT_CONFIG.behavior,
      tone: data.tone || DEFAULT_CONFIG.tone,
      numReplies: data.num_replies || DEFAULT_CONFIG.numReplies,
      additionalInstructions: data.additional_instructions || DEFAULT_CONFIG.additionalInstructions
    } : DEFAULT_CONFIG

    cacheTimestamp = now

    return configCache
  } catch (error) {
    console.error('[prompt-config-service] Error in getPromptConfig:', error)
    return DEFAULT_CONFIG
  }
}

// ─────────────────────────────────────────────
// Role System Prompt Syncing
// ─────────────────────────────────────────────
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || ''

// Memory cache for role prompts to reduce backend network hits
const rolePromptCache: Record<string, { prompt: string; timestamp: number }> = {}

/**
 * Get the custom system prompt for a specific role from the Python RAG server.
 * Uses caching with a 10-second TTL to reduce backend calls.
 */
export async function getRoleSystemPrompt(role: string): Promise<string> {
  const cacheEntry = rolePromptCache[role]
  const now = Date.now()

  // Serve from cache if available and not expired (10s TTL)
  if (cacheEntry && (now - cacheEntry.timestamp) < ROLE_PROMPT_CACHE_TTL) {
    return cacheEntry.prompt
  }

  try {
    const ragUrl = getAbsoluteUrl(process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000')

    const res = await fetch(`${ragUrl}/admin/prompt/${role}`, {
      headers: {
        'X-Admin-Key': ADMIN_KEY,
        ...getVercelBypassHeaders()
      },
      cache: 'no-store'
    })

    if (!res.ok) {
      console.warn(`[prompt-config-service] Failed to fetch prompt for role ${role}. Status: ${res.status}`)
      return ''
    }

    const data = await res.json()
    const prompt = data.prompt || ''

    // Update Cache
    rolePromptCache[role] = {
      prompt,
      timestamp: now,
    }

    return prompt
  } catch (error) {
    console.error(`[prompt-config-service] Error fetching prompt for role ${role}:`, error)
    return ''
  }
}
