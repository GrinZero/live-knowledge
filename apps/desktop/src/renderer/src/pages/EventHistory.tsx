import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Calendar, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiClient } from '../lib/api-client'
import { cn } from '@/lib/utils'

interface EventType {
  type: string
  domain: string
  description: string
  source: 'core' | 'plugin'
}

interface TriggerEvent {
  id: string
  sessionId: string
  eventType: string
  content: Record<string, unknown>
  confidence: number
  triggeredAt: string
  screenshotBase64?: string
}

interface EventHistoryResponse {
  events: TriggerEvent[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function EventHistory(): React.JSX.Element {
  const [events, setEvents] = useState<TriggerEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | 'core' | 'plugin'>('all')
  const [selectedEventType, setSelectedEventType] = useState<string>('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: ''
  })
  const [searchQuery, setSearchQuery] = useState('')

  const [eventTypes, setEventTypes] = useState<EventType[]>([])

  const [selectedEvent, setSelectedEvent] = useState<TriggerEvent | null>(null)

  const [pageInput, setPageInput] = useState('')

  const [, setSseInitialized] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const loadEventsRef = useRef<(() => void) | null>(null)

  const pageSize = 20

  const loadEventTypes = async (): Promise<void> => {
    try {
      const result = await apiClient.events.getTypes()
      if (result?.types) {
        setEventTypes(result.types)
      }
    } catch (error) {
      console.error('Failed to load event types:', error)
    }
  }

  const loadEvents = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      const result: EventHistoryResponse = await apiClient.events.getHistory({
        page,
        pageSize,
        eventType: selectedEventType || undefined,
        startDate: dateRange.start || undefined,
        endDate: dateRange.end || undefined,
        search: searchQuery || undefined
      })

      let filteredEvents = result.events

      if (eventTypeFilter === 'core') {
        const coreTypes = eventTypes.filter((t) => t.source === 'core').map((t) => t.type)
        filteredEvents = result.events.filter((e) => coreTypes.includes(e.eventType))
      } else if (eventTypeFilter === 'plugin') {
        const pluginTypes = eventTypes.filter((t) => t.source === 'plugin').map((t) => t.type)
        filteredEvents = result.events.filter((e) => pluginTypes.includes(e.eventType))
      }

      setEvents(filteredEvents)
      setTotal(result.total)
      setTotalPages(result.totalPages)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, selectedEventType, dateRange, searchQuery, eventTypeFilter, eventTypes])

  // 保持 loadEventsRef 最新
  useEffect(() => {
    loadEventsRef.current = loadEvents
  }, [loadEvents])

  useEffect(() => {
    loadEventTypes()
  }, [])

  useEffect(() => {
    loadEvents()
  }, [page, eventTypeFilter, selectedEventType, dateRange, searchQuery])

  // SSE 实时更新 - 收到新事件通知时重新加载数据
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    const eventSource = new EventSource(`${apiUrl}/api/events/stream`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.type === 'init' && data.events && data.events.length > 0) {
          // SSE 初始化数据直接使用（已包含 screenshotBase64）
          const latestEvents = data.events.slice(0, pageSize)
          setEvents(latestEvents)
          setTotal(data.events.length)
          setTotalPages(Math.ceil(data.events.length / pageSize))
          setSseInitialized(true)
        } else if (data.type === 'update' && data.events && data.events.length > 0) {
          // 新事件更新：插入到列表顶部
          setEvents((prev) => {
            const newEvents = data.events.filter(
              (newEvent: TriggerEvent) => !prev.some((e) => e.id === newEvent.id)
            )
            if (newEvents.length === 0) return prev
            return [...newEvents, ...prev].slice(0, pageSize * 3)
          })
          setTotal((prev) => prev + data.events.length)
        }
      } catch (error) {
        console.error('SSE parse error:', error)
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error, reconnecting...')
      eventSource.close()
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSourceRef.current = null
          setSseInitialized(false)
        }
      }, 5000)
    }

    return () => {
      eventSource.close()
      eventSourceRef.current = null
    }
  }, [])

  const getEventTypeBadgeColor = (eventType: string) => {
    const event = eventTypes.find((t) => t.type === eventType)
    const domain = event?.domain || 'core'
    const colors: Record<string, string> = {
      knowledge: 'bg-green-100 text-green-700',
      information: 'bg-purple-100 text-purple-700',
      core: 'bg-gray-200 text-gray-700',
      system: 'bg-red-100 text-red-700'
    }
    return colors[domain] || 'bg-gray-100 text-gray-700'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 将 base64 转为图片 URL
  const base64ToImageUrl = (base64: string | undefined): string | null => {
    if (!base64) return null
    return `data:image/png;base64,${base64}`
  }

  const clearFilters = () => {
    setEventTypeFilter('all')
    setSelectedEventType('')
    setDateRange({ start: '', end: '' })
    setSearchQuery('')
    setPage(1)
  }

  const hasActiveFilters =
    eventTypeFilter !== 'all' ||
    selectedEventType ||
    dateRange.start ||
    dateRange.end ||
    searchQuery

  const goToPage = (targetPage: number) => {
    const validPage = Math.max(1, Math.min(totalPages, targetPage))
    setPage(validPage)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">事件历史</h1>
        <p className="text-sm text-gray-500 mt-1">查看所有触发过的事件记录</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索事件内容..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setPage(1)
              }}
              className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          <select
            value={selectedEventType}
            onChange={(e) => {
              setSelectedEventType(e.target.value)
              setPage(1)
            }}
            className="h-10 px-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">全部类型</option>
            {eventTypes.map((type) => (
              <option key={type.type} value={type.type}>
                {type.type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setEventTypeFilter('all')
                setPage(1)
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-all',
                eventTypeFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              全部
            </button>
            <button
              onClick={() => {
                setEventTypeFilter('core')
                setPage(1)
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-all',
                eventTypeFilter === 'core'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              核心事件
            </button>
            <button
              onClick={() => {
                setEventTypeFilter('plugin')
                setPage(1)
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-all',
                eventTypeFilter === 'plugin'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              )}
            >
              插件事件
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
                setPage(1)
              }}
              className="h-9 px-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-gray-400">至</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
                setPage(1)
              }}
              className="h-9 px-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 h-9 px-3 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              清除筛选
            </button>
          )}

          <span className="ml-auto text-sm text-gray-400">{total} 条记录</span>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-gray-100">
          <span className="text-sm text-gray-500">
            第 {page} / {totalPages} 页，共 {total} 条
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              上一页
            </Button>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pageInput) {
                  goToPage(parseInt(pageInput))
                  setPageInput('')
                }
              }}
              placeholder={`1-${totalPages}`}
              className="w-16 h-8 px-2 text-sm border border-gray-200 rounded text-center"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (pageInput) {
                  goToPage(parseInt(pageInput))
                  setPageInput('')
                }
              }}
            >
              跳转
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400">加载中...</div>
        ) : events.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">暂无事件记录</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-50">
              {events.map((event) => {
                const screenshotUrl = base64ToImageUrl(event.screenshotBase64)
                return (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className="px-5 py-4 hover:bg-gray-50/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* 略缩图 */}
                      {screenshotUrl && (
                        <img
                          src={screenshotUrl}
                          alt="screenshot"
                          className="w-20 h-14 object-cover rounded border border-gray-100 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <code
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded selectable"
                            style={{ userSelect: 'text' }}
                          >
                            {event.eventType}
                          </code>
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs rounded',
                              getEventTypeBadgeColor(event.eventType)
                            )}
                          >
                            {eventTypes.find((t) => t.type === event.eventType)?.domain ||
                              'unknown'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(event.triggeredAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {typeof event.content === 'string'
                            ? event.content
                            : JSON.stringify(event.content, null, 2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {Math.round(event.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setSelectedEvent(null)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">事件详情</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    事件类型
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <code
                      className="px-2 py-1 bg-blue-100 text-blue-700 text-sm font-mono rounded selectable"
                      style={{ userSelect: 'text' }}
                    >
                      {selectedEvent.eventType}
                    </code>
                    <span
                      className={cn(
                        'px-2 py-1 text-xs rounded',
                        getEventTypeBadgeColor(selectedEvent.eventType)
                      )}
                    >
                      {eventTypes.find((t) => t.type === selectedEvent.eventType)?.domain ||
                        'unknown'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    触发时间
                  </label>
                  <p className="mt-2 text-sm text-gray-900">
                    {new Date(selectedEvent.triggeredAt).toLocaleString('zh-CN')}
                  </p>
                </div>

                {/* 截图 */}
                {base64ToImageUrl(selectedEvent.screenshotBase64) && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      截图
                    </label>
                    <div className="mt-2">
                      <img
                        src={base64ToImageUrl(selectedEvent.screenshotBase64)!}
                        alt="screenshot"
                        className="max-w-full h-auto rounded border border-gray-100"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    置信度
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${selectedEvent.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-700">
                      {Math.round(selectedEvent.confidence * 100)}%
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    内容
                  </label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {typeof selectedEvent.content === 'string'
                        ? selectedEvent.content
                        : JSON.stringify(selectedEvent.content, null, 2)}
                    </pre>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    会话 ID
                  </label>
                  <p className="mt-2 text-sm text-gray-600 font-mono">{selectedEvent.sessionId}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
