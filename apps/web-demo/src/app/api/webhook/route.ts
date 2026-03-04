import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { saveEvent } from '@/lib/store'

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

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''
  const id = randomUUID()
  const createdAt = new Date().toISOString()

  let event = 'unknown_event'
  let payload: Record<string, unknown> = {}
  let attachments: string[] = []

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    event = String(form.get('event') || event)

    const payloadString = String(form.get('payload') || '{}')
    payload = JSON.parse(payloadString) as Record<string, unknown>

    const files = form.getAll('files').filter((item): item is File => item instanceof File)
    attachments = await saveIncomingFiles(files, id)
  } else {
    const body = (await req.json()) as {
      event?: string
      payload?: Record<string, unknown>
      payloadBase64Images?: string[]
    }
    event = body.event || event
    payload = body.payload || {}

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

  await saveEvent({ id, event, payload, attachments, createdAt })

  return NextResponse.json({ success: true, id, attachmentsCount: attachments.length })
}
