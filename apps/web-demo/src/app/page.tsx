'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EventDomain } from '@/lib/event-types'
import type { MultimodalResource } from '@/lib/multimodal'

type EventRecord = {
  id: string
  event: string
  createdAt: string
  eventDomain?: EventDomain
  eventSource?: string
  payload: Record<string, unknown>
  attachments: string[]
  multimodal?: MultimodalResource
  detectedType?: 'problem_solving' | 'coding' | 'meeting' | 'document' | 'unknown'
  markdown?: string
  analysis?: { result: string; analyzedAt: string; prompt: string }
}

const DEFAULT_QUESTION = '请基于这条事件直接给出题目解法和答案（如果不是题目则给关键建议）'

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`icon icon-chevron ${collapsed ? 'is-collapsed' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M16.5 10A6.5 6.5 0 1 1 14 5.03M16.5 4.5v3.75h-3.75"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [question, setQuestion] = useState(DEFAULT_QUESTION)
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [eventListCollapsed, setEventListCollapsed] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const autoTimerRef = useRef<NodeJS.Timeout | null>(null)
  const latestIdRef = useRef<string>('')

  const selectedEvent = useMemo(
    () => events.find((item) => item.id === selectedId) || events[0],
    [events, selectedId],
  )

  const streamEvents = useMemo(
    () => events.filter((item) => item.eventDomain === 'information'),
    [events],
  )

  const knowledgeEvents = useMemo(
    () => events.filter((item) => item.eventDomain === 'knowledge'),
    [events],
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
      setSelectedId(latestIncoming)
      latestIdRef.current = latestIncoming
      return
    }

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
      <section className={`hero ${headerCollapsed ? 'collapsed' : ''}`}>
        <div className="hero-row">
          <div>
            <p className="eyebrow">LIVE KNOWLEDGE</p>
            <h1>Problem Solving Feed</h1>
          </div>
          <button className="icon-button" onClick={() => setHeaderCollapsed((v) => !v)}>
            <ChevronIcon collapsed={headerCollapsed} />
          </button>
        </div>

        {!headerCollapsed && (
          <>
            <p className="subtitle">统一事件类型后，信息流（insight）与知识库（knowledge）会明确分层展示。</p>
            <div className="hero-meta">
              <span>Webhook: /api/webhook</span>
              <span>自动刷新 5s</span>
              <span>自动分析 1.2s 防抖</span>
              <button className="text-button" onClick={() => setGuideOpen(true)} title="查看多模态说明">多模态说明</button>
            </div>
          </>
        )}
      </section>


      {guideOpen && (
        <section className="panel guide-panel">
          <div className="panel-header">
            <h3>多模态传输快速说明</h3>
            <button className="text-button" onClick={() => setGuideOpen(false)}>关闭说明</button>
          </div>
          <ul className="muted guide-list">
            <li><strong>raw</strong>：发送结构化 JSON（multimodal.raw），适合 API 直接消费。</li>
            <li><strong>markitdown</strong>：发送 markdown 文本（multimodal.markdown），适合 AI 二次分析。</li>
            <li><strong>local_file</strong>：仅发送本地路径，仅适合同机流程，远端 webhook 不可直接读取。</li>
            <li>Web-demo 要求至少包含 raw 或 markitdown，不能仅 local_file。</li>
          </ul>
        </section>
      )}

      <section className={`grid ${eventListCollapsed ? 'stream-collapsed' : ''}`}>
        <aside className={`panel panel-stream ${eventListCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <h3>信息流事件</h3>
            <div className="panel-actions">
              <button className="icon-button" onClick={fetchEvents} title="刷新">
                <RefreshIcon />
              </button>
              <button
                className="icon-button"
                onClick={() => setEventListCollapsed((v) => !v)}
                title={eventListCollapsed ? '展开' : '折叠'}
              >
                <ChevronIcon collapsed={eventListCollapsed} />
              </button>
            </div>
          </div>

          {!eventListCollapsed ? (
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
                    <strong>{item.eventDomain || 'unknown'} · {item.detectedType || 'unknown'}</strong>
                    <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div>{item.event}</div>
                  <small className="muted">mode: {item.multimodal?.mode || 'raw'}</small>
                </button>
              ))}
              {events.length === 0 && <p className="muted">暂无事件，等待桌面端推送...</p>}
            </div>
          ) : (
            <div className="stream-collapsed-hint muted">事件流已折叠</div>
          )}
        </aside>

        <section className="panel panel-main">
          <h3>当前事件</h3>
          {selectedEvent ? (
            <>
              {(result || selectedEvent.analysis?.result) && (
                <div className="answer-box priority">
                  <h4>AI 结果（自动）</h4>
                  <div className="answer-content markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {result || selectedEvent.analysis?.result || ''}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              <p className="muted">
                事件类型：<strong>{selectedEvent.event}</strong>
                {' · '}域：<strong>{selectedEvent.eventDomain || 'unknown'}</strong>
                {' · '}内容类型：<strong>{selectedEvent.detectedType || 'unknown'}</strong>
              </p>
              <p className="muted">
                信息流事件：<strong>{streamEvents.length}</strong> 条，知识库事件：<strong>{knowledgeEvents.length}</strong> 条
              </p>
              <p className="muted">
                多模态模式：<strong>{selectedEvent.multimodal?.mode || 'raw'}</strong>
              </p>

              <details>
                <summary>事件详情（折叠）</summary>
                <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
              </details>

              {selectedEvent.markdown && (
                <details>
                  <summary>查看 markdown 载荷</summary>
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
              {loading && <p className="muted">AI 正在自动分析最新事件...</p>}
            </>
          ) : (
            <p className="muted">请选择一条事件。</p>
          )}
        </section>
      </section>
    </main>
  )
}
