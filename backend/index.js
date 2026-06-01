import express from 'express'
import cors from 'cors'
import { Connection, Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { config } from './config.js'
import { collectCreatorFees } from './collect.js'
import { syncFeed } from './feed.js'
import { distributePayout } from './payout.js'
import { getPendingPool, setPendingPool, getTotalClaimed } from './pool.js'
import { loadSubmissions, saveSubmissions, currentCycleId } from './db.js'

let _treasuryPubkey = null
function treasuryPubkey() {
  if (_treasuryPubkey) return _treasuryPubkey
  if (!config.treasuryPrivateKey) return null
  try {
    _treasuryPubkey = Keypair.fromSecretKey(bs58.decode(config.treasuryPrivateKey)).publicKey
    return _treasuryPubkey
  } catch {
    return null
  }
}

let _payoutCache = { data: [], at: 0 }
async function fetchOnchainPayouts() {
  if (Date.now() - _payoutCache.at < 30_000) return _payoutCache.data
  const pk = treasuryPubkey()
  if (!pk) return []
  const conn = new Connection(config.rpcUrl, 'confirmed')
  const sigs = await conn.getSignaturesForAddress(pk, { limit: 30 })
  if (sigs.length === 0) return []
  const treasuryStr = pk.toBase58()
  const payouts = []

  for (let i = 0; i < sigs.length; i++) {
    let tx
    try {
      tx = await conn.getParsedTransaction(sigs[i].signature, {
        maxSupportedTransactionVersion: 0,
      })
    } catch {
      continue
    }
    if (!tx || tx.meta?.err) continue
    const topInstructions = tx.transaction.message.instructions || []
    const isPurePayoutTx = topInstructions.every(
      ix => ix?.program === 'system' && ix.parsed?.type === 'transfer',
    )
    if (!isPurePayoutTx) continue
    for (const ix of topInstructions) {
      const info = ix.parsed?.info
      if (!info) continue
      if (info.source === treasuryStr && info.destination !== treasuryStr) {
        payouts.push({
          tx: sigs[i].signature,
          wallet: info.destination,
          amount: (info.lamports || 0) / 1e9,
          time: (sigs[i].blockTime || 0) * 1000,
        })
      }
    }
  }

  payouts.sort((a, b) => b.time - a.time)
  _payoutCache = { data: payouts, at: Date.now() }
  return payouts
}

const app = express()
app.use(cors())
app.use(express.json())

const CYCLE_MS = 5 * 60 * 1000
function nextCycleInSec() {
  const bucket = Math.floor(Date.now() / CYCLE_MS) * CYCLE_MS
  return Math.max(0, Math.ceil((bucket + CYCLE_MS - Date.now()) / 1000))
}

function shapePost(s) {
  return {
    messageId: s.messageId,
    wallet: s.wallet,
    content: s.content || '',
    username: s.username || null,
    displayName: s.displayName || null,
    profileImageUrl: s.profileImageUrl || null,
    createdAt: s.createdAt,
    ingestedAt: s.ingestedAt,
    isHolder: !!s.isHolder,
    qualified: !!s.qualified,
    paid: !!s.paid,
    paidAmount: s.paidAmount || 0,
    paidTx: s.paidTx || null,
    cycleId: s.cycleId,
  }
}

app.get('/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }))

app.get('/stats', async (req, res) => {
  const submissions = loadSubmissions()
  const cycleId = currentCycleId()
  const qualifyingThisCycle = submissions.filter(
    s => s.cycleId === cycleId && s.qualified && !s.paid,
  ).length
  const uniqueWallets = new Set(
    submissions.filter(s => s.paid && s.paidAmount > 0).map(s => s.wallet),
  )

  let onchainTotalSent = 0
  let onchainCount = 0
  try {
    const onchain = await fetchOnchainPayouts()
    onchainCount = onchain.length
    onchainTotalSent = onchain.reduce((sum, p) => sum + (p.amount || 0), 0)
  } catch {}

  res.json({
    tokenAddress: config.mint,
    totalSubmissions: submissions.length,
    verifiedPosts: submissions.filter(s => s.qualified).length,
    totalPaid: Math.max(submissions.filter(s => s.paid).length, onchainCount),
    totalSentSol: onchainTotalSent,
    poolSol: getPendingPool(),
    totalClaimedSol: Math.max(getTotalClaimed(), config.lastCollectedSol || 0),
    qualifyingThisCycle,
    uniqueEarners: uniqueWallets.size,
    nextCycleInSec: nextCycleInSec(),
  })
})

app.get('/recent-posts', (req, res) => {
  const recent = loadSubmissions()
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 40)
    .map(shapePost)
  res.json(recent)
})

app.get('/earners', (req, res) => {
  const submissions = loadSubmissions()
  const map = {}
  for (const s of submissions) {
    if (!s.paid || !s.paidAmount) continue
    if (!map[s.wallet]) {
      map[s.wallet] = { wallet: s.wallet, totalEarnedSol: 0, payoutCount: 0, lastPaidAt: 0 }
    }
    map[s.wallet].totalEarnedSol += s.paidAmount
    map[s.wallet].payoutCount += 1
    map[s.wallet].lastPaidAt = Math.max(map[s.wallet].lastPaidAt, s.ingestedAt || s.createdAt)
  }
  const earners = Object.values(map)
    .sort((a, b) => b.totalEarnedSol - a.totalEarnedSol)
    .slice(0, 30)
  res.json(earners)
})

app.get('/payouts', async (req, res) => {
  try {
    res.json(await fetchOnchainPayouts())
  } catch (err) {
    console.error('[payouts]', err.message)
    res.json([])
  }
})

function adminAuth(req, res) {
  const secret = req.headers['x-admin-secret'] || req.query.secret
  if (!config.adminSecret || secret !== config.adminSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return false
  }
  return true
}

app.post('/admin/set-pool', (req, res) => {
  if (!adminAuth(req, res)) return
  setPendingPool(Number(req.query.sol ?? req.body?.sol ?? 0))
  res.json({ ok: true, pendingPool: getPendingPool() })
})

app.post('/admin/collect', async (req, res) => {
  if (!adminAuth(req, res)) return
  try {
    const collected = await collectCreatorFees()
    res.json({ ok: true, collected, pool: getPendingPool() })
  } catch (e) {
    res.json({ ok: true, collected: 0, pool: getPendingPool(), note: e.message })
  }
})

app.post('/admin/sync', async (req, res) => {
  if (!adminAuth(req, res)) return
  try {
    const result = await syncFeed()
    res.json({ ok: true, ...result })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/admin/payout', async (req, res) => {
  if (!adminAuth(req, res)) return
  try {
    const submissions = loadSubmissions()
    const paidList = await distributePayout(submissions)
    saveSubmissions(submissions)
    res.json({
      ok: true,
      paid: paidList.length,
      txs: [...new Set(paidList.map(p => p.paidTx).filter(Boolean))],
      pool: getPendingPool(),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/admin/clear-db', (req, res) => {
  if (!adminAuth(req, res)) return
  saveSubmissions([])
  console.log('[admin] Database cleared')
  res.json({ ok: true, message: 'Database cleared' })
})

const PORT = config.port
app.listen(PORT, () => {
  console.log(`[yap-backend] http://localhost:${PORT}`)
  console.log(`[yap-backend] Mint: ${config.mint || 'NOT SET'}`)
  console.log(`[yap-backend] CC API: ${config.ccApiKey ? 'configured' : 'MISSING'}`)
})

async function selfHealPool() {
  try {
    const pk = treasuryPubkey()
    if (!pk) return
    if (getPendingPool() > 0.001) return
    const conn = new Connection(config.rpcUrl, 'confirmed')
    const sol = (await conn.getBalance(pk)) / 1e9
    const seed = Math.max(0, sol - config.reserveSol - 0.005)
    if (seed > config.minPayoutSol) {
      setPendingPool(seed)
      console.log(`[selfheal] Seeded pool ${seed.toFixed(6)} SOL`)
    }
  } catch (e) {
    console.error('[selfheal]', e.message)
  }
}

async function feeCollectionLoop() {
  try {
    const collected = await collectCreatorFees()
    console.log(
      collected > 0
        ? `[collector] +${collected.toFixed(6)} SOL`
        : '[collector] Nothing to claim',
    )
  } catch (err) {
    console.error('[collector]', err.message)
  }
}

async function syncAndPayLoop() {
  try {
    await selfHealPool()
    const feedResult = await syncFeed()
    if (feedResult.ingested > 0) {
      console.log(`[feed] ingested=${feedResult.ingested} qualified=${feedResult.qualified}`)
    }
    const submissions = loadSubmissions()
    const eligible = submissions.filter(s => s.qualified && !s.paid)
    if (eligible.length > 0) {
      const paidList = await distributePayout(submissions)
      saveSubmissions(submissions)
      if (paidList.length > 0) {
        console.log(`[payout] Paid ${paidList.length} entries`)
      }
    }
  } catch (err) {
    console.error('[sync+pay]', err.message)
  }
}

selfHealPool()
if (config.enableFeeCollection) {
  feeCollectionLoop()
  setInterval(feeCollectionLoop, config.collectIntervalMs)
}
setTimeout(syncAndPayLoop, 15_000)
setInterval(syncAndPayLoop, config.collectIntervalMs)
