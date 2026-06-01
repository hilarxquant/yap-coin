import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const POOL_FILE = './data/pool.json'

function ensureDir() {
  if (!existsSync('./data')) mkdirSync('./data', { recursive: true })
}

function readPoolFile() {
  ensureDir()
  if (!existsSync(POOL_FILE)) return { pendingSol: 0, totalClaimedSol: 0 }
  try {
    const data = JSON.parse(readFileSync(POOL_FILE, 'utf-8'))
    return {
      pendingSol: Number(data.pendingSol) || 0,
      totalClaimedSol: Number(data.totalClaimedSol) || 0,
    }
  } catch {
    return { pendingSol: 0, totalClaimedSol: 0 }
  }
}

function writePoolFile(state) {
  ensureDir()
  writeFileSync(
    POOL_FILE,
    JSON.stringify(
      {
        pendingSol: Math.max(0, Number(state.pendingSol) || 0),
        totalClaimedSol: Math.max(0, Number(state.totalClaimedSol) || 0),
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
  )
}

export function getPendingPool() {
  return readPoolFile().pendingSol
}

export function getTotalClaimed() {
  return readPoolFile().totalClaimedSol
}

export function setPendingPool(value) {
  const state = readPoolFile()
  state.pendingSol = Math.max(0, Number(value) || 0)
  writePoolFile(state)
}

export function addToPool(sol) {
  const amount = Number(sol) || 0
  if (amount <= 0) return
  const state = readPoolFile()
  state.pendingSol += amount
  state.totalClaimedSol += amount
  writePoolFile(state)
}

export function consumeFromPool(sol) {
  const amount = Number(sol) || 0
  if (amount <= 0) return
  const state = readPoolFile()
  state.pendingSol = Math.max(0, state.pendingSol - amount)
  writePoolFile(state)
}
