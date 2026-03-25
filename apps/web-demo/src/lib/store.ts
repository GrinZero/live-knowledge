import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { EventDomain, EventTypeDefinition } from './event-types'
import type { MultimodalResource } from './multimodal'

export type DetectedType = 'problem_solving' | 'coding' | 'meeting' | 'document' | 'unknown'

export interface WebhookEventRecord {
  id: string
  event: string
  eventDomain?: EventDomain
  eventSource?: string
  eventTypeCatalog?: EventTypeDefinition[]
  createdAt: string
  payload: Record<string, unknown>
  attachments: string[]
  multimodal?: MultimodalResource
  detectedType?: DetectedType
  markdown?: string
  analysis?: {
    result: string
    prompt: string
    analyzedAt: string
  }
}

const MAX_RECORDS = 300
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
    JSON.parse(content) // Validate JSON
  } catch {
    await writeFile(eventsFile, '[]', 'utf8')
  }
}

export async function loadEvents(): Promise<WebhookEventRecord[]> {
  await ensureStore()
  const content = await readFile(eventsFile, 'utf8')
  try {
    return JSON.parse(content) as WebhookEventRecord[]
  } catch {
    // 文件被并发写入损坏，重置并返回空数组
    await writeFile(eventsFile, '[]', 'utf8')
    return []
  }
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...payload }
  // Remove any Buffer-like objects that shouldn't be persisted
  delete cleaned.screenshotBuffer
  delete cleaned.screenshotPath
  return cleaned
}

export async function saveEvent(record: WebhookEventRecord): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const records = await loadEvents()
    records.unshift({
      ...record,
      payload: sanitizePayload(record.payload),
    })
    await writeFile(eventsFile, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2), 'utf8')
  }).catch((err) => {
    console.error('[store] saveEvent failed:', err)
  })

  await writeQueue
}

export async function updateEventAnalysis(
  eventId: string,
  prompt: string,
  result: string,
): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const records = await loadEvents()
    const index = records.findIndex((item) => item.id === eventId)
    if (index < 0) return

    records[index] = {
      ...records[index],
      analysis: {
        prompt,
        result,
        analyzedAt: new Date().toISOString(),
      },
    }

    await writeFile(eventsFile, JSON.stringify(records.slice(0, MAX_RECORDS), null, 2), 'utf8')
  }).catch((err) => {
    console.error('[store] updateEventAnalysis failed:', err)
  })

  await writeQueue
}
