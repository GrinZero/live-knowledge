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

const dataDir = path.join(process.cwd(), 'data')
const eventsFile = path.join(dataDir, 'events.json')
let writeQueue: Promise<void> = Promise.resolve()

async function ensureStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  try {
    await readFile(eventsFile, 'utf8')
  } catch {
    await writeFile(eventsFile, '[]', 'utf8')
  }
}

export async function loadEvents(): Promise<WebhookEventRecord[]> {
  await ensureStore()
  const content = await readFile(eventsFile, 'utf8')
  return JSON.parse(content) as WebhookEventRecord[]
}

export async function saveEvent(record: WebhookEventRecord): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const records = await loadEvents()
    records.unshift(record)
    await writeFile(eventsFile, JSON.stringify(records.slice(0, 300), null, 2), 'utf8')
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

    await writeFile(eventsFile, JSON.stringify(records, null, 2), 'utf8')
  })

  await writeQueue
}
