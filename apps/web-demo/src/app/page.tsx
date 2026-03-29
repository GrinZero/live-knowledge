'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { EventRecord } from '@/lib/store'

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

function FocusIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 8a5 5 0 1 1 1.5 3.5M3 8V4m0 4H7M13 12a5 5 0 1 1 1.5 3.5M13 12v4m0-4h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ExitFocusIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M8 3H3v5M3 8V4m9 9a5 5 0 1 1 1.5 3.5M12 12v5h5M12 17h5v-5m-9-9H4m4-4V4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg className="icon refresh-icon" viewBox="0 0 20 20" fill="none" aria-hidden>
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

function TrashIcon() {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5.5 7v9a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V7M3.5 5h13M8 5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AnalysisStatus({ analysis }: { analysis: EventRecord['analysis'] }) {
  if (!analysis) {
    return (
      <span className="status-badge pending" role="status" aria-label="分析中">
        pending
      </span>
    )
  }
  if ('error' in analysis) {
    return (
      <span className="status-badge error" title={analysis.error} role="status" aria-label="分析错误">
        error
      </span>
    )
  }
  return (
    <span className="status-badge completed" role="status" aria-label="分析完成">
      completed
    </span>
  )
}

export default function HomePage() {
  const [events, setEvents] = useState<EventRecord[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [eventListCollapsed, setEventListCollapsed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const latestIdRef = useRef<string>('')

  const selectedEvent = events.find((item) => item.id === selectedId) || events[0]

  const fetchEvents = async () => {
    setIsRefreshing(true)
    const response = await fetch('/api/events', { cache: 'no-store' })
    const data = (await response.json()) as { events: EventRecord[] }
    const list = data.events || []

    const latestIncoming = list[0]?.id
    const previousLatest = latestIdRef.current

    setEvents(list)
    setIsRefreshing(false)

    if (!latestIncoming) return

    if (!selectedId || latestIncoming !== previousLatest) {
      setSelectedId(latestIncoming)
      latestIdRef.current = latestIncoming
      return
    }

    if (!list.some((item) => item.id === selectedId)) {
      setSelectedId(latestIncoming)
    }

    latestIdRef.current = latestIncoming
  }

  const clearEvents = async () => {
    if (!confirm('确认清除所有事件记录？')) return
    await fetch('/api/events', { method: 'DELETE' })
    setEvents([])
    setSelectedId('')
    latestIdRef.current = ''
  }

  useEffect(() => {
    void fetchEvents()
    const timer = setInterval(() => {
      void fetchEvents()
    }, 5000)
    return () => clearInterval(timer)
  }, [selectedId])

  const analysisResult = selectedEvent?.analysis && 'result' in selectedEvent.analysis
    ? selectedEvent.analysis.result
    : undefined

  return (
    <main className={`container ${focusMode ? 'focus-mode' : ''}`}>
      <div className="top-bar">
        <button
          className="icon-button focus-btn"
          onClick={() => setFocusMode((v) => !v)}
          title={focusMode ? '退出专注模式' : '专注模式'}
          aria-label={focusMode ? '退出专注模式' : '进入专注模式'}
        >
          {focusMode ? <ExitFocusIcon /> : <FocusIcon />}
        </button>
      </div>
      {!focusMode && (
      <section className={`hero ${headerCollapsed ? 'collapsed' : ''}`}>
        <div className="hero-row">
          <div>
            <p className="eyebrow">LIVE KNOWLEDGE</p>
            <h1>Event Feed</h1>
          </div>
          <button
            className="icon-button"
            onClick={() => setHeaderCollapsed((v) => !v)}
            aria-label={headerCollapsed ? '展开头部' : '折叠头部'}
            aria-expanded={!headerCollapsed}
          >
            <ChevronIcon collapsed={headerCollapsed} />
          </button>
        </div>

        {!headerCollapsed && (
          <>
            <p className="subtitle">接收 raw.created 事件，自动触发 AI 分析。</p>
            <div className="hero-meta">
              <span>Webhook: /api/webhook</span>
              <span>自动刷新 5s</span>
              <span>接收即分析</span>
            </div>
          </>
        )}
      </section>
      )}

      <section className={`grid ${eventListCollapsed ? 'stream-collapsed' : ''}`}>
        {!focusMode && (
        <aside className={`panel panel-stream ${eventListCollapsed ? 'collapsed' : ''}`}>
          <div className="panel-header">
            <h3>事件列表</h3>
            <div className="panel-actions">
              <button
                className="icon-button"
                onClick={clearEvents}
                title="清除所有记录"
                aria-label="清除所有记录"
              >
                <TrashIcon />
              </button>
              <button
                className={`icon-button ${isRefreshing ? 'is-refreshing' : ''}`}
                onClick={fetchEvents}
                title="刷新"
                aria-label="刷新事件列表"
                disabled={isRefreshing}
              >
                <RefreshIcon />
              </button>
              <button
                className="icon-button"
                onClick={() => setEventListCollapsed((v) => !v)}
                title={eventListCollapsed ? '展开' : '折叠'}
                aria-label={eventListCollapsed ? '展开列表' : '折叠列表'}
                aria-expanded={!eventListCollapsed}
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
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="event-top">
                    <strong>{item.type}</strong>
                    <span>{new Date(item.receivedAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="event-bottom">
                    <AnalysisStatus analysis={item.analysis} />
                  </div>
                </button>
              ))}
              {events.length === 0 && <p className="muted">暂无事件，等待桌面端推送...</p>}
            </div>
          ) : (
            <div className="stream-collapsed-hint muted">事件流已折叠</div>
          )}
        </aside>
        )}

        <section className="panel panel-main">
          <h3>当前事件</h3>
          {selectedEvent ? (
            <>
              {analysisResult && (
                <div className="answer-box priority">
                  <h4>AI 分析结果</h4>
                  <div className="answer-content markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {analysisResult}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {selectedEvent.analysis && 'error' in selectedEvent.analysis && (
                <div className="answer-box error-box">
                  <h4>分析失败</h4>
                  <p>{selectedEvent.analysis.error}</p>
                </div>
              )}

              <p className="muted">
                事件类型：<strong>{selectedEvent.type}</strong>
                {' · '}分析状态：<AnalysisStatus analysis={selectedEvent.analysis} />
              </p>

              <details>
                <summary>事件详情（折叠）</summary>
                <pre>{JSON.stringify(selectedEvent.payload, null, 2)}</pre>
              </details>
            </>
          ) : (
            <p className="muted">暂无事件。</p>
          )}
        </section>
      </section>
    </main>
  )
}
