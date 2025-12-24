import { useState, useEffect } from 'react'
import { Play, Pause, Square, Eye, Brain, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ImagePreview } from '@/components/ImagePreview'
import type { Insight as ModelInsight } from '../types'
import { apiClient } from '../lib/api-client'

interface MonitoringStatus {
  status: 'idle' | 'running' | 'paused' | 'error' | 'not_initialized'
  startTime?: string
  lastCapture?: string
  totalCaptures: number
  totalInsights: number
  error?: string
}

type DisplayInsight = {
  id: string
  title: string
  content: string
  type: string
  confidence: number
  tags: string[]
  createdAt: string
  screenshotPath?: string | string[]
}

export default function Monitor(): React.JSX.Element {
  const [status, setStatus] = useState<MonitoringStatus>({
    status: 'not_initialized',
    totalCaptures: 0,
    totalInsights: 0
  })
  const [insights, setInsights] = useState<DisplayInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadStatus()
    loadInsights()

    // @ts-ignore - Electron IPC API
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore - Electron IPC API
      window.electron.ipcRenderer.on('monitoring:insight', (_: unknown, insight: ModelInsight) => {
        const mapped: DisplayInsight = {
          id: insight.id,
          title: insight.title,
          content: insight.content,
          type: insight.type,
          confidence: 0.8,
          tags: [],
          createdAt: new Date().toISOString(),
          screenshotPath: insight.metadata?.screenshotPath as string | string[]
        }
        setInsights((prev) => {
          if (prev.some((i) => i.id === mapped.id)) return prev
          return [mapped, ...prev.slice(0, 9)]
        })
        setStatus((prev) => ({
          ...prev,
          totalInsights: prev.totalInsights + 1,
          lastCapture: new Date().toISOString()
        }))
      })

      // @ts-ignore - Electron IPC API
      window.electron.ipcRenderer.on(
        'monitoring:status',
        (_: unknown, newStatus: { status: string; sessionId?: string }) => {
          setStatus(newStatus as MonitoringStatus)
        }
      )

      // @ts-ignore - Electron IPC API
      window.electron.ipcRenderer.on('monitoring:error', (_: unknown, error: unknown) => {
        setStatus((prev) => ({ ...prev, status: 'error', error: String(error) }))
      })
    }

    const interval = setInterval(loadStatus, 5000)
    return () => {
      clearInterval(interval)
      // @ts-ignore - Electron IPC API
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore - Electron IPC API
        window.electron.ipcRenderer.removeAllListeners('monitoring:insight')
        // @ts-ignore - Electron IPC API
        window.electron.ipcRenderer.removeAllListeners('monitoring:status')
        // @ts-ignore - Electron IPC API
        window.electron.ipcRenderer.removeAllListeners('monitoring:error')
      }
    }
  }, [])

  const loadStatus = async (): Promise<void> => {
    try {
      const newStatus = await apiClient.monitoring.getStatus()
      setStatus(newStatus as MonitoringStatus)
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  const loadInsights = async (): Promise<void> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insightsData: any[] = await apiClient.database.getInsights(10)
      const mapped = insightsData.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        type: d.type,
        confidence: d.confidence,
        tags: d.tags,
        createdAt: d.createdAt,
        screenshotPath: d.metadata?.screenshotPath || d.screenshotPath
      }))
      setInsights(mapped)
    } catch (error) {
      console.error('Failed to load insights:', error)
    }
  }

  const handleStart = async (): Promise<void> => {
    setIsLoading(true)
    try {
      const config = {
        mode: 'full' as const,
        region: undefined,
        triggerConfig: { debounce: 800, throttle: 2000, similarityThreshold: 0.85 },
        captureInterval: 15000,
        contextCapture: { durationMs: 6000, maxFrames: 5 }
      }
      await apiClient.monitoring.start(config)
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await apiClient.monitoring.stop()
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePause = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await apiClient.monitoring.pause()
    } catch (error) {
      console.error('Failed to pause monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResume = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await apiClient.monitoring.resume()
    } catch (error) {
      console.error('Failed to resume monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      task: 'bg-blue-500',
      meeting: 'bg-green-500',
      reminder: 'bg-amber-500',
      insight: 'bg-purple-500',
      suggestion: 'bg-indigo-500'
    }
    return colors[type] || 'bg-gray-400'
  }

  const isIdle = status.status === 'idle' || status.status === 'not_initialized'
  const isRunning = status.status === 'running'
  const isPaused = status.status === 'paused'

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">监控中心</h1>
        <p className="text-sm text-gray-500 mt-1">实时捕获屏幕内容，AI 自动提取知识洞察</p>
      </div>

      <div className="flex gap-6">
        {/* Left Panel - Control */}
        <div className="w-72 flex-none space-y-5">
          {/* Status Card */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-5">
              <span className="text-sm font-medium text-gray-500">系统状态</span>
              <StatusBadge status={status.status} size="md" />
            </div>

            {/* Control Buttons */}
            <div className="space-y-2.5">
              {isIdle && (
                <Button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                >
                  <Play className="mr-2 h-4 w-4" />
                  {isLoading ? '启动中...' : '开始监控'}
                </Button>
              )}

              {isRunning && (
                <>
                  <Button
                    onClick={handlePause}
                    disabled={isLoading}
                    className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    {isLoading ? '暂停中...' : '暂停'}
                  </Button>
                  <Button
                    onClick={handleStop}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full h-10 rounded-lg text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    停止
                  </Button>
                </>
              )}

              {isPaused && (
                <>
                  <Button
                    onClick={handleResume}
                    disabled={isLoading}
                    className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    {isLoading ? '恢复中...' : '继续'}
                  </Button>
                  <Button
                    onClick={handleStop}
                    disabled={isLoading}
                    variant="outline"
                    className="w-full h-10 rounded-lg text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50"
                  >
                    <Square className="mr-2 h-4 w-4" />
                    停止
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-gray-600">捕获次数</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{status.totalCaptures}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Brain className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-gray-600">洞察数量</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">{status.totalInsights}</span>
            </div>
            {status.lastCapture && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">最近捕获</span>
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(status.lastCapture).toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>

          {/* Error Display */}
          {status.error && (
            <div className="bg-red-50 rounded-xl border border-red-100 p-4">
              <div className="text-sm font-medium text-red-700 mb-1">错误</div>
              <div className="text-xs text-red-600">{status.error}</div>
            </div>
          )}
        </div>

        {/* Right Panel - Insights */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-100 h-full">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-medium text-gray-900">最近洞察</h2>
            </div>

            <div className="p-5">
              {insights.length === 0 ? (
                <EmptyState
                  icon={Brain}
                  title="暂无洞察"
                  description="开始监控后，AI 将自动从屏幕内容中提取知识洞察"
                />
              ) : (
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <div
                      key={insight.id}
                      className="flex gap-3 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      {/* Type indicator */}
                      <div className={`w-1 rounded-full flex-none ${getTypeColor(insight.type)}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs text-gray-400 uppercase font-medium">
                            {insight.type}
                          </span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            {new Date(insight.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <h4 className="font-medium text-gray-900 mb-1 line-clamp-1">
                          {insight.title}
                        </h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{insight.content}</p>

                        {insight.screenshotPath && (
                          <div className="mt-3">
                            {Array.isArray(insight.screenshotPath) ? (
                              <ImagePreview
                                src={`media://${insight.screenshotPath[0]}`}
                                alt="screenshot"
                                className="max-h-32 rounded-lg border border-gray-100"
                              />
                            ) : (
                              <ImagePreview
                                src={`media://${insight.screenshotPath}`}
                                alt="screenshot"
                                className="max-h-32 rounded-lg border border-gray-100"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
