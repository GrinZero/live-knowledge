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
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [eventListCollapsed, setEventListCollapsed] = useState(false)
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestIdRef = useRef<string>('')

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedId) || events[0],
    [events, selectedId],
  )

  const fetchEvents = async () => {
    const response = await fetch('/api/events', { cache: 'no-store' })
    const data = (await response.json()) as EventRecord[]

    const latestIncoming = data[0]?.id
    const previousLatest = latestIdRef.current

    setEvents(data)

    if (!latestIncoming) {
      return
    }

    if (!selectedId) {
      setSelectedId(latestIncoming)
      latestIdRef.current = latestIncoming
      return
    }

    if (latestIncoming !== previousLatest) {
      // 新事件来了，自动切到最新事件
      setSelectedId(latestIncoming)
      latestIdRef.current = latestIncoming
      return
    }

    // 选中的事件被删除或不存在时兜底
    if (!data.some((item) => item.id === selectedId)) {
      setSelectedId(latestIncoming)
    }

    latestIdRef.current = latestIncoming
  }

  useEffect(() => {
    void fetchEvents()
    const timer = setInterval(() => {
      void fetchEvents()
    }, 5000)

    return () => clearInterval(timer)
  }, [selectedId])

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
    if (!selectedEvent) return

    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
    }

    autoTimerRef.current = setTimeout(() => {
      void runAnalyze(selectedEvent)
    }, 1200)

    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current)
    }
  }, [selectedEvent?.id, question])

  return (
    <main className="container">
      <section className="card hero">
        <div className="collapse-row">
          <h1>Live Knowledge · 题解预判面板</h1>
          <button className="collapse-btn" onClick={() => setHeaderCollapsed((v) => !v)}>
            {headerCollapsed ? '展开' : '折叠'}
          </button>
        </div>

        {!headerCollapsed && (
          <>
            <p>自动接收 webhook 事件，优先为题目场景提前生成思路与答案。</p>
            <div className="meta-row">
              <span>Webhook: POST /api/webhook</span>
              <span>轮询刷新: 5s</span>
              <span>分析触发: 自动（防抖 1.2s）</span>
            </div>
          </>
        )}
      </section>

      <section className="grid">
        <aside className="card left-panel">
          <div className="panel-title-row">
            <h3>事件流</h3>
            <div className="inline-actions">
              <button onClick={fetchEvents}>刷新</button>
              <button className="collapse-btn" onClick={() => setEventListCollapsed((v) => !v)}>
                {eventListCollapsed ? '展开' : '折叠'}
              </button>
            </div>
          </div>

          {!eventListCollapsed && (
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
          )}
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

              <h3>分析输入（自动触发）</h3>
              <textarea rows={3} value={question} onChange={(e) => setQuestion(e.target.value)} />
              {loading && <p className="loading-tip">AI 正在自动分析最新事件...</p>}

              {(result || selectedEvent.analysis?.result) && (
                <div className="answer-box">
                  <h4>AI 结果（自动）</h4>
                  <pre className="answer-content">{result || selectedEvent.analysis?.result}</pre>
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
