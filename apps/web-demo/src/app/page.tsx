'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type EventRecord = {
  id: string
  event: string
  createdAt: string
  payload: Record<string, unknown>
  attachments: string[]
  detectedType?: 'problem_solving' | 'coding' | 'meeting' | 'document' | 'unknown'
  markdown?: string
  analysis?: { result: string; analyzedAt: string; prompt: string }
}

const DEFAULT_QUESTION = '请基于这条事件直接给出题目解法和答案（如果不是题目则给关键建议）'

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null)

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedId) || events[0],
    [events, selectedId],
  )

  const fetchEvents = async () => {
    const response = await fetch('/api/events', { cache: 'no-store' })
    const data = (await response.json()) as EventRecord[]
    setEvents(data)
    if (!selectedId && data.length > 0) {
      setSelectedId(data[0].id)
    }
  }

  useEffect(() => {
    void fetchEvents()
    const timer = setInterval(() => {
      void fetchEvents()
    }, 5000)

    return () => clearInterval(timer)
  }, [])

  const runAnalyze = async (target?: EventRecord) => {
    const eventToAnalyze = target || selectedEvent
    if (!eventToAnalyze) return

    setLoading(true)

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventToAnalyze.id, userPrompt: question }),
      })
      const data = (await response.json()) as { result?: string; error?: string }
      setResult(data.result || data.error || '没有返回结果')
      await fetchEvents()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!autoAnalyze || !selectedEvent) return

    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
    }

    autoTimerRef.current = setTimeout(() => {
      void runAnalyze(selectedEvent)
    }, 1200)

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    }
  }, [selectedEvent?.id, autoAnalyze, question])

  return (
    <main className="container">
      <header className="hero card">
        <h1>Live Knowledge · 题解预判面板</h1>
        <p>自动接收 webhook 事件，优先为题目场景提前生成思路与答案。</p>
        <div className="meta-row">
          <span>Webhook: POST /api/webhook</span>
          <span>轮询刷新: 5s</span>
          <label>
            <input type="checkbox" checked={autoAnalyze} onChange={(e) => setAutoAnalyze(e.target.checked)} />
            自动分析
          </label>
        </div>
      </header>

      <section className="grid">
        <aside className="card left-panel">
          <div className="panel-title-row">
            <h3>事件流</h3>
            <button onClick={fetchEvents}>刷新</button>
          </div>
          <div className="events-list">
            {events.map((item) => (
              <button
                key={item.id}
                className={`event-item ${selectedEvent?.id === item.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedId(item.id)
                  if (item.analysis?.result) setResult(item.analysis.result)
                }}
              >
                <div className="event-top">
                  <strong>{item.detectedType || 'unknown'}</strong>
                  <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                </div>
                <div>{item.event}</div>
              </button>
            ))}
            {events.length === 0 && <p>暂无事件，等待桌面端推送...</p>}
          </div>
        </aside>

        <section className="card right-panel">
          <h3>当前事件详情</h3>
          {selectedEvent ? (
            <>
              <p>
                类型：<strong>{selectedEvent.detectedType || 'unknown'}</strong>
              </p>
              <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>

              {selectedEvent.markdown && (
                <details>
                  <summary>查看 webhook markdown 载荷</summary>
                  <pre>{selectedEvent.markdown}</pre>
                </details>
              )}

              <div className="attachments-grid">
                {selectedEvent.attachments.map((path) => (
                  <a key={path} href={path} target="_blank" className="attachment-card">
                    <img src={path} alt={path} />
                    <span>{path}</span>
                  </a>
                ))}
              </div>

              <h3>分析控制</h3>
              <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
              <button onClick={() => runAnalyze()} disabled={loading} style={{ marginTop: 8 }}>
                {loading ? '分析中...' : '立即分析'}
              </button>

              {(result || selectedEvent.analysis?.result) && (
                <div className="answer-box">
                  <h4>AI 结果</h4>
                  <pre>{result || selectedEvent.analysis?.result}</pre>
                </div>
              )}
            </>
          ) : (
            <p>请选择一条事件。</p>
          )}
        </section>
      </section>
    </main>
  )
}
