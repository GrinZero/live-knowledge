import { NextRequest, NextResponse } from 'next/server'
import { analyzeWithAI } from '@/lib/ai'
import { loadEvents, updateEventAnalysis } from '@/lib/store'

export async function POST(req: NextRequest) {
  const { eventId, userPrompt } = (await req.json()) as { eventId?: string; userPrompt?: string }

  if (!eventId || !userPrompt) {
    return NextResponse.json({ error: 'eventId 和 userPrompt 必填' }, { status: 400 })
  }

  const events = await loadEvents()
  const record = events.find((item) => item.id === eventId)

  if (!record) {
    return NextResponse.json({ error: '未找到对应事件' }, { status: 404 })
  }

  try {
    const result = await analyzeWithAI({
      userPrompt,
      payload: record.payload,
      attachments: record.attachments,
      markdown: record.markdown,
      detectedType: record.detectedType,
    })

    await updateEventAnalysis(record.id, userPrompt, result)
    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败' },
      { status: 500 },
    )
  }
}
