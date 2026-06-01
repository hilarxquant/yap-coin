import { Connection, PublicKey } from '@solana/web3.js'
import { config } from './config.js'

export async function walletHoldsToken(walletAddress, minAmount = null) {
  if (!config.mint || !walletAddress) return false
  const min = minAmount ?? config.minHold

  try {
    const connection = new Connection(config.rpcUrl, 'confirmed')
    const wallet = new PublicKey(walletAddress)
    const mint = new PublicKey(config.mint)
    const accounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint })
    if (accounts.value.length === 0) return false
    const balance = accounts.value[0].account.data.parsed.info.tokenAmount.uiAmount
    return (balance || 0) >= min
  } catch {
    return false
  }
}
