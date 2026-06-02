/** Static branding — mint/CA comes from the API (MINT env) or VITE_MINT at build time. */
export const TOKEN = {
  name: 'Yap to Earn',
  ticker: '$YAP',
  tagline: 'Post in the community. Hold $YAP. Get paid in SOL.',
  apiUrl: import.meta.env.VITE_API_URL || 'https://yap-coin.onrender.com',
  twitterUrl: 'https://x.com/yaptoearnPF',
  twitterHandle: '@yaptoearnPF',
  /** Optional build-time override; normally use /stats tokenAddress from the backend. */
  mintOverride: import.meta.env.VITE_MINT || '',
}

export function pumpFunUrl(mint) {
  return mint ? `https://pump.fun/coin/${mint}` : null
}

export function solscanMintUrl(mint) {
  return mint ? `https://solscan.io/token/${mint}` : null
}
