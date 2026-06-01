import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

const DATA_DIR = './data'
const SUBMISSIONS_FILE = `${DATA_DIR}/submissions.json`
const CURSOR_FILE = `${DATA_DIR}/cursor.json`

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
}

export function loadSubmissions() {
  ensureDir()
  if (!existsSync(SUBMISSIONS_FILE)) return []
  try {
    return JSON.parse(readFileSync(SUBMISSIONS_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveSubmissions(data) {
  ensureDir()
  writeFileSync(SUBMISSIONS_FILE, JSON.stringify(data, null, 2))
}

export function loadCursor() {
  ensureDir()
  if (!existsSync(CURSOR_FILE)) return { lastMessageId: null, lastTs: 0 }
  try {
    const c = JSON.parse(readFileSync(CURSOR_FILE, 'utf-8'))
    return {
      lastMessageId: c.lastMessageId || null,
      lastTs: Number(c.lastTs) || 0,
    }
  } catch {
    return { lastMessageId: null, lastTs: 0 }
  }
}

export function saveCursor(cursor) {
  ensureDir()
  writeFileSync(
    CURSOR_FILE,
    JSON.stringify(
      {
        lastMessageId: cursor.lastMessageId || null,
        lastTs: Number(cursor.lastTs) || 0,
        updatedAt: Date.now(),
      },
      null,
      2,
    ),
  )
}

export function currentCycleId() {
  const bucketMs = 5 * 60 * 1000
  return new Date(Math.floor(Date.now() / bucketMs) * bucketMs).toISOString()
}
