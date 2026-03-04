import { NextResponse } from 'next/server'
import { loadEvents } from '@/lib/store'

export async function GET() {
  const events = await loadEvents()
  return NextResponse.json(events)
}
