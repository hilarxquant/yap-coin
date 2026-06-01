import { readFileSync } from 'fs'

function loadEnv() {
  try {
    const content = readFileSync('.env', 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      process.env[key.trim()] = rest.join('=').trim()
    }
  } catch {
    // use process.env on Render
  }
}

loadEnv()

export const config = {
  mint: process.env.MINT || '',
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY || '',
  rpcUrl: process.env.RPC_URL || 'https://api.mainnet-beta.solana.com',
  ccApiKey: process.env.CC_API_KEY || '',
  ccBaseUrl: process.env.CC_BASE_URL || 'https://api.coin-communities.xyz',
  port: parseInt(process.env.PORT || '3001', 10),
  collectIntervalMs: parseInt(process.env.COLLECT_INTERVAL_MS || '300000', 10),
  minPayoutSol: parseFloat(process.env.MIN_PAYOUT_SOL || '0.01'),
  minPerWallet: parseFloat(process.env.MIN_PER_WALLET || '0.0005'),
  reserveSol: parseFloat(process.env.RESERVE_SOL || '0.005'),
  minHold: parseFloat(process.env.MIN_HOLD || '1'),
  minContentLength: parseInt(process.env.MIN_CONTENT_LENGTH || '2', 10),
  adminSecret: process.env.ADMIN_SECRET || '',
  enableFeeCollection: process.env.ENABLE_FEE_COLLECTION !== 'false',
  holderBonus: process.env.HOLDER_BONUS === 'true',
  lastCollectedSol: 0,
}
