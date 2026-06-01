import { config } from './config.js'

/**
 * Coin Communities — messages/public (verified spike 2026-06-01)
 * Response: { messages: [{ id, walletAddress, content, createdAt, isSpam, isHarmful, ... }] }
 */
export async function getMessages(tokenAddress, { limit = 50 } = {}) {
  if (!config.ccApiKey || !tokenAddress) {
    console.log('[cc] Skipping — CC_API_KEY or MINT not set')
    return []
  }

  const url = new URL(
    `/api/v1/communities/${encodeURIComponent(tokenAddress)}/messages/public`,
    config.ccBaseUrl,
  )
  url.searchParams.set('limit', String(Math.min(limit, 100)))

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': config.ccApiKey },
    })
    if (!res.ok) {
      const text = await res.text()
      console.error(`[cc] HTTP ${res.status}: ${text.slice(0, 200)}`)
      return []
    }
    const data = await res.json()
    const messages = data.messages || data.data || []
    return messages.map(normalizeMessage).filter(Boolean)
  } catch (err) {
    console.error('[cc] Fetch failed:', err.message)
    return []
  }
}

function normalizeMessage(m) {
  if (!m?.id || !m?.walletAddress) return null
  const createdAt = m.createdAt ? new Date(m.createdAt).getTime() : Date.now()
  return {
    messageId: m.id,
    walletAddress: m.walletAddress,
    content: (m.content || '').trim(),
    createdAt,
    username: m.username || null,
    displayName: m.displayName || null,
    profileImageUrl: m.profileImageUrl || null,
    isSpam: !!m.isSpam,
    isHarmful: !!m.isHarmful,
  }
}
