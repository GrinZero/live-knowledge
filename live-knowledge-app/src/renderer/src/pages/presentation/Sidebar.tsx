import { useEffect, useState } from 'react'
import { X, Lightbulb, Calendar, CheckSquare, AlertCircle, Clock, Tag } from 'lucide-react'
import type { Action } from '../../types'

interface Insight {
  id: string
  title: string
  content: string
  type: 'task' | 'schedule' | 'note' | 'analysis' | 'reminder'
  priority: 'low' | 'medium' | 'high'
  suggestedActions: Action[]
  metadata: Record<string, unknown>
  createdAt: string
}

export default function SidebarPresentation(): React.JSX.Element {
  const [insight, setInsight] = useState<Insight | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Parse insight from URL parameters
    const params = new URLSearchParams(window.location.search)
    const insightData = params.get('insight')

    if (insightData) {
      try {
        const parsedInsight = JSON.parse(decodeURIComponent(insightData))
        setInsight(parsedInsight)
      } catch (error) {
        console.error('Failed to parse insight data:', error)
      }
    }

    // Auto-hide after 8 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        if (window.api?.presentation) {
          window.api.presentation.hide()
        }
      }, 300)
    }, 8000)

    return () => clearTimeout(timer)
  }, [])

  const getTypeIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-4 w-4" />
      case 'schedule':
        return <Calendar className="h-4 w-4" />
      case 'note':
        return <Lightbulb className="h-4 w-4" />
      case 'analysis':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Lightbulb className="h-4 w-4" />
    }
  }

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'task':
        return 'bg-blue-500'
      case 'schedule':
        return 'bg-green-500'
      case 'note':
        return 'bg-yellow-500'
      case 'analysis':
        return 'bg-purple-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high':
        return 'border-red-400'
      case 'medium':
        return 'border-yellow-400'
      case 'low':
        return 'border-green-400'
      default:
        return 'border-gray-400'
    }
  }

  if (!insight || !isVisible) {
    return <div className="hidden" />
  }

  return (
    <div className="h-screen bg-transparent flex items-center justify-center p-2">
      <div
        className={`bg-gray-900 border-l-4 ${getPriorityColor(insight.priority)} rounded-r-lg shadow-2xl w-full max-w-sm transform transition-all duration-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-full ${getTypeColor(insight.type)} text-white`}>
              {getTypeIcon(insight.type)}
            </div>
            <span className="text-sm font-medium text-white truncate">{insight.title}</span>
          </div>
          <button
            onClick={() => {
              setIsVisible(false)
              setTimeout(() => {
                if (window.api?.presentation) {
                  window.api.presentation.hide()
                }
              }, 300)
            }}
            className="text-gray-400 hover:text-white active:scale-90 cursor-pointer transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3">
          <p className="text-gray-300 text-xs leading-relaxed mb-3">{insight.content}</p>

          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Clock className="h-3 w-3" />
            <span>{new Date(insight.createdAt).toLocaleTimeString()}</span>
          </div>

          {/* Tags */}
          {Array.isArray((insight.metadata as Record<string, unknown>).tags as unknown) && (
            <div className="flex flex-wrap gap-1 mb-2">
              {((insight.metadata as Record<string, unknown>).tags as string[]).map(
                (tag: string, index: number) => (
                  <span
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-800 text-xs rounded text-gray-300"
                  >
                    <Tag className="h-2 w-2" />
                    <span>{tag}</span>
                  </span>
                )
              )}
            </div>
          )}

          {/* Actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="flex flex-col gap-1">
              {insight.suggestedActions.slice(0, 2).map((action, index) => (
                <button
                  key={index}
                  onClick={() => {
                    console.log('Executing action:', action.type)
                    setIsVisible(false)
                    setTimeout(() => {
                      if (window.api?.presentation) {
                        window.api.presentation.hide()
                      }
                    }, 300)
                  }}
                  className="w-full text-left px-2 py-1 bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-98 cursor-pointer text-xs rounded transition-all"
                >
                  {action.type.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
