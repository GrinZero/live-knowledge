import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { analyzeWithAI } from '@/lib/ai'
import { convertWithMarkItDown } from '@/lib/markitdown'
import type { DetectedType } from '@/lib/store'
import { saveEvent, updateEventAnalysis } from '@/lib/store'
import {
  DEFAULT_EVENT_TYPES,
  normalizeEventType,
  resolveEventDomain,
  type EventTypeDefinition,
} from '@/lib/event-types'
import {
  normalizeMultimodal,
  requiresStructuredContent,
  type MultimodalResource,
} from '@/lib/multimodal'

const duplicateWindowMs = 8000
const recentSignatureMap = new Map<string, number>()

async function saveIncomingFiles(files: File[], eventId: string): Promise<string[]> {
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', eventId)
  await mkdir(uploadDir, { recursive: true })

  const paths: string[] = []

  for (const file of files) {
    const buf = Buffer.from(await file.arrayBuffer())
    const filename = `${Date.now()}-${file.name}`
    const filepath = path.join(uploadDir, filename)
    await writeFile(filepath, buf)
    paths.push(`/uploads/${eventId}/${filename}`)
  }

  return paths
}

function buildSignature(input: { event: string; payload: Record<string, unknown> }): string {
  return createHash('sha1').update(`${normalizeEventType(input.event)}:${JSON.stringify(input.payload)}`).digest('hex')
}

function isDuplicate(signature: string): boolean {
  const now = Date.now()
  const latest = recentSignatureMap.get(signature)
  recentSignatureMap.set(signature, now)

  for (const [key, value] of recentSignatureMap.entries()) {
    if (now - value > duplicateWindowMs) {
      recentSignatureMap.delete(key)
    }
  }

  if (!latest) return false
  return now - latest < duplicateWindowMs
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  let event = 'unknown.event'
  let eventSource = 'unknown'
  let eventTypeCatalog: EventTypeDefinition[] = [...DEFAULT_EVENT_TYPES]
  let payload: Record<string, unknown> = {}
  let attachments: string[] = []
  let detectedType: DetectedType = 'unknown'
  let markdown: string | undefined
  let multimodal: MultimodalResource | null = null

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    event = String(form.get('event') || event)

    // Only accept raw.created events
    if (event !== 'raw.created') {
      return NextResponse.json({ success: true, ignored: true, reason: 'not_raw_created' })
    }

    const payloadString = String(form.get('payload') || '{}')
    payload = JSON.parse(payloadString) as Record<string, unknown>

    const incomingType = String(form.get('detectedType') || '')
    if (incomingType) {
      detectedType = incomingType as typeof detectedType
    }

    const markdownValue = form.get('markdown')
    markdown = typeof markdownValue === 'string' ? markdownValue : undefined

    const multimodalValue = form.get('multimodal')
    if (typeof multimodalValue === 'string' && multimodalValue.trim()) {
      try {
        multimodal = normalizeMultimodal(JSON.parse(multimodalValue) as Partial<MultimodalResource>)
      } catch {
        multimodal = null
      }
    }

    const eventSourceValue = form.get('eventSource')
    eventSource = typeof eventSourceValue === 'string' ? eventSourceValue : eventSource

    const eventTypeCatalogValue = form.get('eventTypeCatalog')
    if (typeof eventTypeCatalogValue === 'string' && eventTypeCatalogValue.trim()) {
      try {
        eventTypeCatalog = JSON.parse(eventTypeCatalogValue) as EventTypeDefinition[]
      } catch {
        eventTypeCatalog = [...DEFAULT_EVENT_TYPES]
      }
    }

    const files = form.getAll('files').filter((item): item is File => item instanceof File)
    attachments = await saveIncomingFiles(files, id)
  } else {
    const body = (await req.json()) as {
      event?: string
      payload?: Record<string, unknown>
      payloadBase64Images?: string[]
      detectedType?: DetectedType
      markdown?: string
      eventSource?: string
      eventTypeCatalog?: EventTypeDefinition[]
      multimodal?: Partial<MultimodalResource>
    }

    event = body.event || event

    // Only accept raw.created events
    if (event !== 'raw.created') {
      return NextResponse.json({ success: true, ignored: true, reason: 'not_raw_created' })
    }

    payload = body.payload || {}
    detectedType = body.detectedType || detectedType
    markdown = body.markdown
    eventSource = body.eventSource || eventSource
    eventTypeCatalog = body.eventTypeCatalog || eventTypeCatalog
    multimodal = normalizeMultimodal(body.multimodal)

    const maybeBase64Images = body.payloadBase64Images || []
    if (maybeBase64Images.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', id)
      await mkdir(uploadDir, { recursive: true })

      for (let i = 0; i < maybeBase64Images.length; i += 1) {
        const data = maybeBase64Images[i]
        const base64 = data.includes(',') ? data.split(',').pop() || '' : data
        const filename = `${Date.now()}-${i}.png`
        await writeFile(path.join(uploadDir, filename), Buffer.from(base64, 'base64'))
        attachments.push(`/uploads/${id}/${filename}`)
      }
    }
  }


  if (!multimodal) {
    const fallbackMode = markdown ? 'markitdown' : attachments.length > 0 ? 'local_file' : 'raw'
    multimodal = normalizeMultimodal({
      mode: fallbackMode,
      raw: payload,
      markdown,
      localFiles: attachments,
    })
  }

  if (!requiresStructuredContent(multimodal)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'web-demo requires multimodal.raw or multimodal.markdown. local_file only is not enough for remote analysis.',
      },
      { status: 400 },
    )
  }

  payload = multimodal?.raw || payload
  markdown = multimodal?.markdown || markdown

  const normalizedEventType = normalizeEventType(event)
  const eventDomain = resolveEventDomain(normalizedEventType, eventTypeCatalog)

  const signature = buildSignature({ event: normalizedEventType, payload })
  if (isDuplicate(signature)) {
    return NextResponse.json({ success: true, ignored: true, reason: 'debounced_duplicate' })
  }

  if (!markdown && attachments.length > 0) {
    markdown = (await convertWithMarkItDown(attachments[0])) || undefined
  }

  await saveEvent({
    id,
    event: normalizedEventType,
    eventDomain,
    eventSource,
    eventTypeCatalog,
    payload,
    attachments,
    createdAt,
    detectedType,
    markdown,
    multimodal: multimodal || undefined,
  })

  if (detectedType === 'problem_solving') {
    queueMicrotask(async () => {
      try {
        const prompt = '请直接给出题目的解题思路、关键步骤和最终答案。'
        const result = await analyzeWithAI({
          userPrompt: prompt,
          payload,
          attachments,
          markdown,
          detectedType,
        })
        await updateEventAnalysis(id, prompt, result)
      } catch (error) {
        console.error('[web-demo] auto analyze failed:', error)
      }
    })
  }

  return NextResponse.json({ success: true, id, attachmentsCount: attachments.length, detectedType })
}
