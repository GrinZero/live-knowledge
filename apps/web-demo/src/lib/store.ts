import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export interface WebhookEventRecord {
  id: string
  event: string
  createdAt: string
  payload: Record<string, unknown>
  attachments: string[]
}

const dataDir = path.join(process.cwd(), 'data')
const eventsFile = path.join(dataDir, 'events.json')

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
  const records = await loadEvents()
  records.unshift(record)
  await writeFile(eventsFile, JSON.stringify(records.slice(0, 200), null, 2), 'utf8')
}
