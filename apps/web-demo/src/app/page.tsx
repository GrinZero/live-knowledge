'use client'

import { useEffect, useMemo, useState } from 'react'

type EventRecord = {
  id: string
  event: string
  createdAt: string
  payload: Record<string, unknown>
  attachments: string[]
}

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [question, setQuestion] = useState('帮我总结这次屏幕变化并给下一步建议')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedId) || events[0],
    [events, selectedId],
  )

  const fetchEvents = async () => {
    const response = await fetch('/api/events')
    const data = (await response.json()) as EventRecord[]
    setEvents(data)
    if (!selectedId && data.length > 0) {
      setSelectedId(data[0].id)
    }
  }

  useEffect(() => {
    void fetchEvents()
  }, [])

  const runAnalyze = async () => {
    if (!selectedEvent) return
    setLoading(true)
    setResult('')

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent.id, userPrompt: question }),
      })
      const data = (await response.json()) as { result?: string; error?: string }
      setResult(data.result || data.error || '没有返回结果')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      <h1>Live Knowledge Web Demo</h1>
      <p>接收 webhook、落盘截图，并基于 AI 对事件做二次分析。</p>

      <section className="card">
        <h3>Webhook 地址</h3>
        <code>POST /api/webhook</code>
        <p>支持 application/json 及 multipart/form-data（字段：event, timestamp, payload, files）</p>
      </section>

      <section className="card">
        <h3>事件列表</h3>
        <button onClick={fetchEvents}>刷新</button>
        <select
          style={{ marginTop: 8 }}
          value={selectedEvent?.id || ''}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.event} · {new Date(item.createdAt).toLocaleString()}
            </option>
          ))}
        </select>

        {selectedEvent ? (
          <>
            <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
            <div>
              {selectedEvent.attachments.map((path) => (
                <div key={path}>
                  <a href={path} target="_blank">
                    {path}
                  </a>
                  <img src={path} alt={path} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p>暂无事件，先让 webhook-plugin 推送数据过来。</p>
        )}
      </section>

      <section className="card">
        <h3>AI 分析</h3>
        <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} />
        <button onClick={runAnalyze} disabled={!selectedEvent || loading} style={{ marginTop: 8 }}>
          {loading ? '分析中...' : '开始分析'}
        </button>
        {result && <pre>{result}</pre>}
      </section>
    </main>
  )
}
