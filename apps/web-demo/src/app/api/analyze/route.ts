import { NextRequest, NextResponse } from 'next/server'
import { getEvent, updateEventAnalysis } from '@/lib/store'
import { analyzeEvent } from '@/lib/ai'

export async function POST(req: NextRequest) {
  const { eventId } = (await req.json()) as { eventId?: string }

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const record = await getEvent(eventId)
  if (!record) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  try {
    const result = await analyzeEvent(record.payload)
    const analysis = { result, analyzedAt: new Date().toISOString() }
    await updateEventAnalysis(eventId, analysis)
    return NextResponse.json({ success: true, analysis })
  } catch (error) {
    const errorAnalysis = {
      error: error instanceof Error ? error.message : String(error),
      analyzedAt: new Date().toISOString(),
    }
    await updateEventAnalysis(eventId, errorAnalysis)
    return NextResponse.json(
      { error: errorAnalysis.error },
      { status: 500 },
    )
  }
}
