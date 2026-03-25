import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface EventRecord {
  id: string
  type: string
  payload: Record<string, unknown>
  receivedAt: string
  analysis: {
    result: string
    analyzedAt: string
  } | {
    error: string
    analyzedAt: string
  } | null
}

const MAX_RECORDS = 200
const dataDir = path.join(process.cwd(), 'data')
const eventsFile = path.join(dataDir, 'events.json')
let writeQueue: Promise<void> = Promise.resolve()

async function ensureStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  try {
    const content = await readFile(eventsFile, 'utf8')
    if (!content.trim()) {
      await writeFile(eventsFile, '[]', 'utf8')
      return
    }
    JSON.parse(content)
  } catch {
    await writeFile(eventsFile, '[]', 'utf8')
  }
}

export async function loadEvents(): Promise<EventRecord[]> {
  await ensureStore()
  const content = await readFile(eventsFile, 'utf8')
  try {
    return JSON.parse(content) as EventRecord[]
  } catch {
    await writeFile(eventsFile, '[]', 'utf8')
    return []
  }
}

function contentHash(type: string, payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify({ type, payload }))
    .digest('hex')
}

/**
 * Save an event record. Returns the existing eventId if a duplicate is found.
 */
export async function saveEvent(record: EventRecord): Promise<{ eventId: string; duplicate: boolean }> {
  let resultId = record.id
  let isDuplicate = false

  writeQueue = writeQueue.then(async () => {
    const records = await loadEvents()
    const hash = contentHash(record.type, record.payload)

    // Check for duplicate by content hash
    const existing = records.find(
      (r) => contentHash(r.type, r.payload) === hash,
    )
    if (existing) {
      resultId = existing.id
      isDuplicate = true
      return
    }

    records.unshift(record)
    // FIFO: keep only MAX_RECORDS
    const trimmed = records.slice(0, MAX_RECORDS)
    await writeFile(eventsFile, JSON.stringify(trimmed, null, 2), 'utf8')
  }).catch((err) => {
    console.error('[store] saveEvent failed:', err)
  })

  await writeQueue
  return { eventId: resultId, duplicate: isDuplicate }
}

export async function updateEventAnalysis(
  eventId: string,
  analysis: EventRecord['analysis'],
): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const records = await loadEvents()
    const index = records.findIndex((item) => item.id === eventId)
    if (index < 0) return

    records[index] = { ...records[index], analysis }
    await writeFile(eventsFile, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2), 'utf8')
  }).catch((err) => {
    console.error('[store] updateEventAnalysis failed:', err)
  })

  await writeQueue
}

export async function getEvent(eventId: string): Promise<EventRecord | undefined> {
  const records = await loadEvents()
  return records.find((r) => r.id === eventId)
}

export async function clearEvents(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureStore()
    await writeFile(eventsFile, '[]', 'utf8')
  }).catch((err) => {
    console.error('[store] clearEvents failed:', err)
  })
  await writeQueue
}
