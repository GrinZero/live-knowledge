import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { saveEvent, updateEventAnalysis } from '@/lib/store'
import { analyzeEvent } from '@/lib/ai'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''

  // Only accept JSON
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: 'Unsupported Media Type. Only application/json is accepted.' },
      { status: 415 },
    )
  }

  const body = (await req.json()) as {
    type?: string
    payload?: Record<string, unknown>
    emittedAt?: string
  }

  const eventType = body.type || 'unknown'

  // Only process raw.created events
  if (eventType !== 'raw.created') {
    return NextResponse.json({ success: true, ignored: true })
  }

  const eventId = randomUUID()
  const payload = body.payload || {}

  const record = {
    id: eventId,
    type: eventType,
    payload,
    receivedAt: new Date().toISOString(),
    analysis: null,
  }

  const { eventId: savedId, duplicate } = await saveEvent(record)

  if (duplicate) {
    return NextResponse.json({ success: true, eventId: savedId })
  }

  // Async AI analysis — don't await, return immediately
  analyzeEvent(payload)
    .then(async (result) => {
      await updateEventAnalysis(savedId, {
        result,
        analyzedAt: new Date().toISOString(),
      })
    })
    .catch(async (error) => {
      await updateEventAnalysis(savedId, {
        error: error instanceof Error ? error.message : String(error),
        analyzedAt: new Date().toISOString(),
      })
    })

  return NextResponse.json({ success: true, eventId: savedId })
}
