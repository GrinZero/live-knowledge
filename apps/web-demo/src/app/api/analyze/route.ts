import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { analyzeWithAI } from '@/lib/ai'
import { loadEvents, updateEventAnalysis } from '@/lib/store'

async function attachmentToBase64(attachmentPath: string): Promise<string | undefined> {
  try {
    const filePath = path.join(process.cwd(), 'public', attachmentPath)
    const buffer = await readFile(filePath)
    return buffer.toString('base64')
  } catch {
    return undefined
  }
}

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
    // Convert first attachment to base64 for AI vision
    const screenshotBase64 = record.attachments.length > 0
      ? await attachmentToBase64(record.attachments[0])
      : undefined

    const result = await analyzeWithAI({
      userPrompt,
      payload: record.payload,
      attachments: record.attachments,
      markdown: record.markdown,
      detectedType: record.detectedType,
      screenshotBase64,
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
