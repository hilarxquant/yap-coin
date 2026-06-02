import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { config } from './config.js'
import { getPendingPool, consumeFromPool } from './pool.js'

export async function distributePayout(submissions) {
  if (!config.treasuryPrivateKey) {
    console.log('[payout] Skipping — TREASURY_PRIVATE_KEY not set')
    return []
  }

  const eligible = submissions.filter(s => s.qualified && !s.paid)
  if (eligible.length === 0) return []

  const wallets = [...new Set(eligible.map(s => s.wallet))]
  if (wallets.length === 0) return []

  const keypair = Keypair.fromSecretKey(bs58.decode(config.treasuryPrivateKey))
  const connection = new Connection(config.rpcUrl, 'confirmed')

  const pending = getPendingPool()
  const balance = await connection.getBalance(keypair.publicKey)
  const balanceSol = balance / LAMPORTS_PER_SOL
  // Pool = claimed creator fees only (pool.json). Wallet balance is only a spend cap.
  const available = Math.min(pending, Math.max(0, balanceSol - config.reserveSol))
  if (pending <= 0) {
    console.log('[payout] No claimed fees in pool')
    return []
  }

  if (available < config.minPayoutSol) {
    console.log(
      `[payout] Pool too low — pending=${pending.toFixed(6)} balance=${balanceSol.toFixed(4)} min=${config.minPayoutSol}`,
    )
    return []
  }

  let share = available / wallets.length
  if (share < config.minPerWallet) {
    console.log(
      `[payout] Share ${share.toFixed(6)} below MIN_PER_WALLET — ${wallets.length} wallets, pool=${available.toFixed(6)}`,
    )
    return []
  }

  console.log(
    `[payout] Equal split: ${share.toFixed(6)} SOL × ${wallets.length} wallets (${available.toFixed(6)} SOL)`,
  )

  const paid = []
  let totalSent = 0

  for (const wallet of wallets) {
    try {
      const recipient = new PublicKey(wallet)
      const lamports = Math.floor(share * LAMPORTS_PER_SOL)
      if (lamports < 1) continue

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: recipient,
          lamports,
        }),
      )

      const sig = await connection.sendTransaction(tx, [keypair])
      await connection.confirmTransaction(sig, 'confirmed')

      const payoutSol = lamports / LAMPORTS_PER_SOL
      totalSent += payoutSol
      console.log(`[payout] Sent ${payoutSol.toFixed(6)} SOL → ${wallet.slice(0, 8)}… | ${sig}`)

      for (const post of eligible.filter(s => s.wallet === wallet)) {
        post.paid = true
        post.paidAmount = payoutSol
        post.paidTx = sig
        paid.push(post)
      }
    } catch (err) {
      console.error(`[payout] Failed ${wallet.slice(0, 8)}…:`, err.message)
    }
  }

  if (totalSent > 0) consumeFromPool(totalSent)
  console.log(`[payout] Distributed ${totalSent.toFixed(6)} SOL to ${paid.length} entries`)
  return paid
}
