import { useState, useEffect } from 'react'
import { Play, Pause, Square, Settings, Activity, Eye, Brain, Database } from 'lucide-react'

interface MonitoringStatus {
  status: 'idle' | 'running' | 'paused' | 'error' | 'not_initialized'
  startTime?: string
  lastCapture?: string
  totalCaptures: number
  totalInsights: number
  error?: string
}

interface Insight {
  id: string
  title: string
  content: string
  type: 'task' | 'meeting' | 'reminder' | 'insight' | 'suggestion'
  confidence: number
  tags: string[]
  createdAt: string
}

export default function Monitor(): React.JSX.Element {
  const [status, setStatus] = useState<MonitoringStatus>({
    status: 'not_initialized',
    totalCaptures: 0,
    totalInsights: 0
  })
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Load initial status and insights
  useEffect(() => {
    loadStatus()
    loadInsights()
    
    // Set up event listeners
    if (window.api?.monitoring) {
      window.api.monitoring.onInsight((insight: Insight) => {
        setInsights(prev => [insight, ...prev.slice(0, 9)])
        setStatus(prev => ({
          ...prev,
          totalInsights: prev.totalInsights + 1,
          lastCapture: new Date().toISOString()
        }))
      })

      window.api.monitoring.onStatusChange((newStatus: MonitoringStatus) => {
        setStatus(newStatus)
      })

      window.api.monitoring.onError((error: string) => {
        setStatus(prev => ({ ...prev, status: 'error', error }))
      })
    }

    // Poll status every 5 seconds
    const interval = setInterval(loadStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const loadStatus = async () => {
    try {
      const newStatus = await window.api?.monitoring?.getStatus()
      if (newStatus) {
        setStatus(newStatus)
      }
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  }

  const loadInsights = async () => {
    try {
      const insightsData = await window.api?.database?.getInsights(10)
      if (insightsData) {
        setInsights(insightsData)
      }
    } catch (error) {
      console.error('Failed to load insights:', error)
    }
  }

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const config = {
        mode: 'full',
        region: null,
        triggerConfig: {
          debounce: 800,
          throttle: 2000,
          similarityThreshold: 0.85
        },
        captureInterval: 2000
      }
      await window.api?.monitoring?.start(config)
    } catch (error) {
      console.error('Failed to start monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    setIsLoading(true)
    try {
      await window.api?.monitoring?.stop()
    } catch (error) {
      console.error('Failed to stop monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePause = async () => {
    setIsLoading(true)
    try {
      await window.api?.monitoring?.pause()
    } catch (error) {
      console.error('Failed to pause monitoring:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleResume = async () => {
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
      case 'running': return 'text-green-400'
      case 'paused': return 'text-yellow-400'
      case 'error': return 'text-red-400'
      case 'idle': return 'text-blue-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusBgColor = () => {
    switch (status.status) {
      case 'running': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      case 'idle': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  const getInsightTypeColor = (type: string) => {
    switch (type) {
      case 'task': return 'bg-blue-500'
      case 'meeting': return 'bg-green-500'
      case 'reminder': return 'bg-yellow-500'
      case 'insight': return 'bg-purple-500'
      case 'suggestion': return 'bg-indigo-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="h-6 w-6 text-blue-400" />
            <h1 className="text-2xl font-bold">Live Knowledge Monitor</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`h-3 w-3 rounded-full ${getStatusBgColor()}`} />
              <span className={`text-sm font-medium ${getStatusColor()}`}>
                {status.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Panel - Control & Stats */}
        <div className="w-80 border-r border-gray-700 p-6">
          {/* Control Buttons */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Control Panel</h3>
            <div className="space-y-3">
              {status.status === 'idle' || status.status === 'not_initialized' ? (
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Play className="h-4 w-4" />
                  <span>{isLoading ? 'Starting...' : 'Start Monitoring'}</span>
                </button>
              ) : status.status === 'running' ? (
                <div className="space-y-3">
                  <button
                    onClick={handlePause}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Pause className="h-4 w-4" />
                    <span>{isLoading ? 'Pausing...' : 'Pause'}</span>
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Square className="h-4 w-4" />
                    <span>{isLoading ? 'Stopping...' : 'Stop'}</span>
                  </button>
                </div>
              ) : status.status === 'paused' ? (
                <div className="space-y-3">
                  <button
                    onClick={handleResume}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    <span>{isLoading ? 'Resuming...' : 'Resume'}</span>
                  </button>
                  <button
                    onClick={handleStop}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
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
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">Total Captures</span>
                </div>
                <span className="text-lg font-bold">{status.totalCaptures}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-sm">Total Insights</span>
                </div>
                <span className="text-lg font-bold">{status.totalInsights}</span>
              </div>
              {status.startTime && (
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-green-400" />
                    <span className="text-sm">Started</span>
                  </div>
                  <span className="text-sm">{new Date(status.startTime).toLocaleTimeString()}</span>
                </div>
              )}
              {status.lastCapture && (
                <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm">Last Capture</span>
                  </div>
                  <span className="text-sm">{new Date(status.lastCapture).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Error Display */}
          {status.error && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg">
              <div className="text-red-200 text-sm font-medium mb-1">Error</div>
              <div className="text-red-300 text-xs">{status.error}</div>
            </div>
          )}
        </div>

        {/* Right Panel - Insights */}
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Insights</h3>
            <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
              <Settings className="h-4 w-4" />
              <span className="text-sm">Settings</span>
            </button>
          </div>

          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
              <Brain className="h-16 w-16 mb-4 opacity-50" />
              <p className="text-lg">No insights yet</p>
              <p className="text-sm mt-2">Start monitoring to see AI-generated insights</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              {insights.map((insight) => (
                <div key={insight.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getInsightTypeColor(insight.type)}`}>
                        {insight.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(insight.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-xs text-gray-400">
                        {Math.round(insight.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  
                  <h4 className="font-semibold mb-2">{insight.title}</h4>
                  <p className="text-gray-300 text-sm mb-2 leading-relaxed">{insight.content}</p>
                  
                  {insight.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {insight.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-700 text-xs rounded">
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