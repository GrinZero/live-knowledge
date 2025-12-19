import { useState, useEffect } from 'react'
import { Play, Pause, Square, Settings, Activity, Eye, Brain, Database } from 'lucide-react'
import type { Insight as ModelInsight } from '../types'

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
  screenshotPath?: string
}

export default function Monitor(): React.JSX.Element {
  const [status, setStatus] = useState<MonitoringStatus>({
    status: 'not_initialized',
    totalCaptures: 0,
    totalInsights: 0
  })
  const [insights, setInsights] = useState<DisplayInsight[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load initial status and insights
  useEffect(() => {
    loadStatus()
    loadInsights()

    // Set up event listeners
    if (window.api?.monitoring) {
      window.api.monitoring.onInsight((insight: ModelInsight) => {
        const mapped: DisplayInsight = {
          id: insight.id,
          title: insight.title,
          content: insight.content,
          type: insight.type,
          confidence: 0.8,
          tags: [],
          createdAt: new Date().toISOString(),
          screenshotPath: undefined
        }
        setInsights((prev) => [mapped, ...prev.slice(0, 9)])
        setStatus((prev) => ({
          ...prev,
          totalInsights: prev.totalInsights + 1,
          lastCapture: new Date().toISOString()
        }))
      })

      window.api.monitoring.onStatusChange((newStatus: { status: string; sessionId?: string }) => {
        setStatus(newStatus as MonitoringStatus)
      })

      window.api.monitoring.onError((error: unknown) => {
        setStatus((prev) => ({ ...prev, status: 'error', error: String(error) }))
      })
    }

    // Poll status every 5 seconds
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async (): Promise<void> => {
    try {
      const newStatus = await window.api.monitoring.getStatus()
      setStatus(newStatus as MonitoringStatus)
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  const loadInsights = async (): Promise<void> => {
    try {
      const insightsData = await window.api.database.getInsights(10)
      const mapped = insightsData.map((d) => ({
        id: d.id,
        title: d.title,
        content: d.content,
        type: d.type,
        confidence: d.confidence,
        tags: d.tags,
        createdAt: d.createdAt,
        screenshotPath: d.screenshotPath
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
        triggerConfig: {
          debounce: 800,
          throttle: 2000,
          similarityThreshold: 0.85
        },
        captureInterval: 2000
      }
      await window.api.monitoring.start(config)
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await window.api?.monitoring?.stop()
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePause = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await window.api?.monitoring?.pause()
    } catch (error) {
      console.error('Failed to pause monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResume = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await window.api?.monitoring?.resume()
    } catch (error) {
      console.error('Failed to resume monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'running':
        return 'text-green-400'
      case 'paused':
        return 'text-yellow-400'
      case 'error':
        return 'text-red-400'
      case 'idle':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStatusBgColor = () => {
    switch (status.status) {
      case 'running':
        return 'bg-green-500'
      case 'paused':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      case 'idle':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'task':
        return 'bg-blue-100 text-blue-700 border border-blue-200'
      case 'meeting':
        return 'bg-green-100 text-green-700 border border-green-200'
      case 'reminder':
        return 'bg-yellow-100 text-yellow-700 border border-yellow-200'
      case 'insight':
        return 'bg-purple-100 text-purple-700 border border-purple-200'
      case 'suggestion':
        return 'bg-indigo-100 text-indigo-700 border border-indigo-200'
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200'
    }
  }

  return (
    <div>
      <div className="flex">
        {/* Left Panel - Control & Stats */}
        <div className="w-80 border-r border-gray-200 p-4 bg-white rounded-l-lg">
          {/* Control Buttons */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">控制面板</h3>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${getStatusBgColor()}`} />
                <span className={`text-xs ${getStatusColor()}`}>{status.status.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {status.status === 'idle' || status.status === 'not_initialized' ? (
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 active:scale-95 cursor-pointer text-white px-4 py-2 rounded-lg transition-all"
                >
                  <Play className="h-4 w-4" />
                  <span>{isLoading ? 'Starting...' : 'Start Monitoring'}</span>
                </button>
              ) : status.status === 'running' ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handlePause}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 active:scale-95 cursor-pointer text-white px-4 py-2 rounded-lg transition-all"
                  >
                    <Pause className="h-4 w-4" />
                    <span>{isLoading ? 'Pausing...' : 'Pause'}</span>
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 active:scale-95 cursor-pointer text-white px-4 py-2 rounded-lg transition-all"
                  >
                    <Square className="h-4 w-4" />
                    <span>{isLoading ? 'Stopping...' : 'Stop'}</span>
                  </button>
                </div>
              ) : status.status === 'paused' ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleResume}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 active:scale-95 cursor-pointer text-white px-4 py-2 rounded-lg transition-all"
                  >
                    <Play className="h-4 w-4" />
                    <span>{isLoading ? 'Resuming...' : 'Resume'}</span>
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 active:scale-95 cursor-pointer text-white px-4 py-2 rounded-lg transition-all"
                  >
                    <Square className="h-4 w-4" />
                    <span>{isLoading ? 'Stopping...' : 'Stop'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          {/* Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">统计</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="text-sm">Total Captures</span>
                </div>
                <span className="text-lg font-bold">{status.totalCaptures}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-600" />
                  <span className="text-sm">Total Insights</span>
                </div>
                <span className="text-lg font-bold">{status.totalInsights}</span>
              </div>
              {status.startTime && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Started</span>
                  </div>
                  <span className="text-sm">{new Date(status.startTime).toLocaleTimeString()}</span>
                </div>
              )}
              {status.lastCapture && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">Last Capture</span>
                  </div>
                  <span className="text-sm">
                    {new Date(status.lastCapture).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {status.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-700 text-sm font-medium mb-1">Error</div>
              <div className="text-red-600 text-xs">{status.error}</div>
            </div>
          )}
        </div>

        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Insights</h3>
            <button className="flex items-center gap-2 text-gray-500 hover:text-gray-900 active:text-gray-700 cursor-pointer transition-colors">
              <Settings className="h-4 w-4" />
              <span className="text-sm">Settings</span>
            </button>
          </div>

          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-500">
              <Brain className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg">No insights yet</p>
              <p className="text-sm mt-2">Start monitoring to see AI-generated insights</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {insights.map((insight) => (
                <div key={insight.id} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getInsightTypeColor(insight.type)}`}
                      >
                        {insight.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(insight.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                  </div>

                  <h4 className="font-semibold mb-2">{insight.title}</h4>
                  <p className="text-gray-700 text-sm mb-2 leading-relaxed">{insight.content}</p>

                  {insight.screenshotPath && (
                    <div className="mt-2">
                      <img
                        src={`file://${insight.screenshotPath}`}
                        alt="screenshot"
                        className="max-h-64 w-auto rounded-lg border border-gray-200"
                      />
                    </div>
                  )}

                  {insight.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {insight.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
