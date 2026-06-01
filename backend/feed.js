import { config } from './config.js'
import { getMessages } from './cc-client.js'
import { walletHoldsToken } from './holders.js'
import {
  loadSubmissions,
  saveSubmissions,
  loadCursor,
  saveCursor,
  currentCycleId,
} from './db.js'

const FUD_WORDS = [
  'scam', 'rug', 'rugpull', 'rug pull', "don't buy", 'dont buy',
  'stay away', 'fraud', 'fake', 'honeypot', 'dump it', 'dumping',
  'sell now', 'dead coin', 'trash', 'garbage', 'avoid', 'warning',
  'beware', 'ponzi', 'hack', 'hacked', 'sketchy', 'suspicious',
]

function isFud(text) {
  const lower = text.toLowerCase()
  return FUD_WORDS.filter(w => lower.includes(w)).length >= 2
}

export async function syncFeed() {
  if (!config.mint) return { ingested: 0, qualified: 0 }

  const messages = await getMessages(config.mint, { limit: 50 })
  if (messages.length === 0) return { ingested: 0, qualified: 0 }

  const cursor = loadCursor()
  const submissions = loadSubmissions()
  const knownIds = new Set(submissions.map(s => s.messageId))
  const cycleId = currentCycleId()
  const walletThisCycle = new Set(
    submissions.filter(s => s.cycleId === cycleId).map(s => s.wallet),
  )

  let ingested = 0
  let qualified = 0
  let maxTs = cursor.lastTs
  let lastId = cursor.lastMessageId

  for (const msg of messages) {
    if (msg.createdAt <= cursor.lastTs && knownIds.has(msg.messageId)) continue

    if (msg.createdAt > maxTs) {
      maxTs = msg.createdAt
      lastId = msg.messageId
    }

    if (knownIds.has(msg.messageId)) continue

    const entry = {
      messageId: msg.messageId,
      wallet: msg.walletAddress,
      content: msg.content,
      username: msg.username,
      displayName: msg.displayName,
      profileImageUrl: msg.profileImageUrl,
      createdAt: msg.createdAt,
      ingestedAt: Date.now(),
      isHolder: false,
      qualified: false,
      paid: false,
      paidAmount: 0,
      paidTx: null,
      cycleId,
    }

    ingested++

    if (msg.content.length < config.minContentLength) {
      submissions.push(entry)
      knownIds.add(msg.messageId)
      continue
    }
    if (msg.isSpam || msg.isHarmful || isFud(msg.content)) {
      submissions.push(entry)
      knownIds.add(msg.messageId)
      continue
    }
    if (walletThisCycle.has(msg.walletAddress)) {
      submissions.push(entry)
      knownIds.add(msg.messageId)
      continue
    }

    const holds = await walletHoldsToken(msg.walletAddress)
    entry.isHolder = holds
    if (!holds) {
      submissions.push(entry)
      knownIds.add(msg.messageId)
      continue
    }

    entry.qualified = true
    qualified++
    walletThisCycle.add(msg.walletAddress)
    submissions.push(entry)
    knownIds.add(msg.messageId)
    console.log(
      `[feed] Qualified @${msg.username || '?'} | ${msg.walletAddress.slice(0, 8)}… | ${msg.content.slice(0, 40)}`,
    )
  }

  if (ingested > 0 || maxTs > cursor.lastTs) {
    saveCursor({ lastMessageId: lastId, lastTs: maxTs })
  }
  saveSubmissions(submissions)

  return { ingested, qualified }
}
