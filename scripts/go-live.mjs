/**
 * Set new mint + treasury, sync to Render, redeploy.
 *
 *   node scripts/go-live.mjs --mint <CA> --treasury <base58>
 *   node scripts/go-live.mjs --mint <CA>   # treasury unchanged in .env
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, 'backend', '.env')

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mint' && args[i + 1]) out.mint = args[++i]
    if (args[i] === '--treasury' && args[i + 1]) out.treasury = args[++i]
  }
  return out
}

function updateEnvFile({ mint, treasury }) {
  if (!existsSync(envPath)) throw new Error('Missing backend/.env')
  let lines = readFileSync(envPath, 'utf8').split('\n')
  const set = (key, value) => {
    const idx = lines.findIndex(l => l.startsWith(`${key}=`))
    const row = `${key}=${value}`
    if (idx >= 0) lines[idx] = row
    else lines.push(row)
  }
  if (mint) set('MINT', mint)
  if (treasury) set('TREASURY_PRIVATE_KEY', treasury)
  writeFileSync(envPath, lines.filter((l, i, a) => i < a.length - 1 || l !== '').join('\n') + '\n')
}

const { mint, treasury } = parseArgs()
if (!mint && !treasury) {
  console.error('Usage: node scripts/go-live.mjs --mint <CA> [--treasury <base58>]')
  process.exit(1)
}

updateEnvFile({ mint, treasury })
console.log('Updated backend/.env')
if (mint) console.log('  MINT:', mint)
if (treasury) console.log('  TREASURY_PRIVATE_KEY: (set)')

const child = spawn(process.execPath, ['scripts/deploy-render.mjs'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
child.on('exit', code => {
  if (code !== 0) process.exit(code)
  console.log('\nOptional: clear old feed data after mint swap:')
  console.log('  curl -X POST https://yap-coin.onrender.com/admin/clear-db -H "x-admin-secret: ..."')
  if (mint) {
    console.log('\nOptional Vercel build-time mint:')
    console.log(`  vercel env add VITE_MINT production  # value: ${mint}`)
  }
})
