import { NextResponse } from 'next/server'
import { loadEvents, clearEvents } from '@/lib/store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const events = await loadEvents()
  // Already stored newest-first (unshift on save)
  return NextResponse.json({ events })
}

export async function DELETE() {
  await clearEvents()
  return NextResponse.json({ success: true })
}
