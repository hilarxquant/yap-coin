import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import { config } from './config.js'
import { addToPool } from './pool.js'

const PUMP_FEE_API = 'https://fun-block.pump.fun'

export async function collectCreatorFees() {
  if (!config.enableFeeCollection) return 0
  if (!config.mint || !config.treasuryPrivateKey) {
    console.log('[collector] Skipping — MINT or TREASURY_PRIVATE_KEY not set')
    return 0
  }

  const keypair = Keypair.fromSecretKey(bs58.decode(config.treasuryPrivateKey))
  const connection = new Connection(config.rpcUrl, 'confirmed')
  const balanceBefore = await connection.getBalance(keypair.publicKey)

  const res = await fetch(`${PUMP_FEE_API}/agents/collect-fees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mint: config.mint,
      user: keypair.publicKey.toBase58(),
      encoding: 'base64',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Pump API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  if (!data.transaction) return 0

  const tx = VersionedTransaction.deserialize(Buffer.from(data.transaction, 'base64'))
  tx.sign([keypair])
  const sig = await connection.sendTransaction(tx, {
    encoding: 'base64',
    skipPreflight: false,
    maxRetries: 3,
  })
  await connection.confirmTransaction(sig, 'confirmed')

  const balanceAfter = await connection.getBalance(keypair.publicKey)
  const collected = (balanceAfter - balanceBefore) / 1e9

  if (collected > 0) {
    config.lastCollectedSol += collected
    addToPool(collected)
  }

  console.log(`[collector] TX: ${sig} | +${collected.toFixed(6)} SOL`)
  return collected
}
