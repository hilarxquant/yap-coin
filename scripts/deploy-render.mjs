/**
 * Create or update yap-coin on Render and sync env from backend/.env
 * Usage: RENDER_API_KEY=rnd_... node scripts/deploy-render.mjs
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
function loadEnvFile() {
  const path = join(root, 'backend', '.env')
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const fileEnv = loadEnvFile()
const apiKey = process.env.RENDER_API_KEY || fileEnv.RENDER_API_KEY
if (!apiKey) {
  console.error('Set RENDER_API_KEY in env or backend/.env')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function api(path, opts = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, { headers, ...opts })
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(data)}`)
  return data
}

const ENV_KEYS = [
  'MINT',
  'TREASURY_PRIVATE_KEY',
  'RPC_URL',
  'CC_API_KEY',
  'CC_BASE_URL',
  'MIN_HOLD',
  'MIN_PAYOUT_SOL',
  'MIN_PER_WALLET',
  'RESERVE_SOL',
  'MIN_CONTENT_LENGTH',
  'COLLECT_INTERVAL_MS',
  'ENABLE_FEE_COLLECTION',
  'HOLDER_BONUS',
  'ADMIN_SECRET',
]

const REPO = process.env.YAP_GITHUB_REPO || 'https://github.com/hilarxquant/yap-coin'

async function main() {
  const env = loadEnvFile()
  env.PORT = '3001'
  env.CC_BASE_URL = env.CC_BASE_URL || 'https://api.coin-communities.xyz'

  const owners = await api('/owners?limit=20')
  const ownerId = owners[0]?.owner?.id || owners[0]?.id
  if (!ownerId) throw new Error('No Render owner found')

  let serviceId = process.env.YAP_RENDER_SERVICE_ID
  if (!serviceId) {
    const list = await api('/services?limit=50')
    const hit = list.find(s => (s.service?.name || s.name) === 'yap-coin')
    serviceId = hit?.service?.id || hit?.id
  }

  if (!serviceId) {
    console.log('Creating yap-coin web service…')
    const created = await api('/services', {
      method: 'POST',
      body: JSON.stringify({
        type: 'web_service',
        name: 'yap-coin',
        ownerId,
        repo: REPO,
        branch: 'main',
        autoDeploy: 'yes',
        serviceDetails: {
          env: 'node',
          region: 'oregon',
          plan: 'starter',
          rootDir: 'backend',
          buildCommand: 'npm install',
          startCommand: 'node index.js',
          healthCheckPath: '/health',
        },
      }),
    })
    serviceId = created.id || created.service?.id
    console.log('Created service:', serviceId)
  } else {
    console.log('Using existing service:', serviceId)
  }

  const body = ENV_KEYS.filter(k => env[k])
    .map(key => ({ key, value: env[key] }))

  await api(`/services/${serviceId}/env-vars`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  console.log(`Synced ${body.length} env vars`)

  await api(`/services/${serviceId}/deploys`, {
    method: 'POST',
    body: JSON.stringify({ clearCache: 'do_not_clear' }),
  })
  console.log('Deploy triggered → https://yap-coin.onrender.com')
}

main().catch(e => {
  console.error(e.message)
  process.exit(1)
})
