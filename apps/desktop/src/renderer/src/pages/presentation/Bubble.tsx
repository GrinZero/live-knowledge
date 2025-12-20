import { useEffect, useState } from 'react'
import { X, Lightbulb, Calendar, CheckSquare, AlertCircle } from 'lucide-react'
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

export default function BubblePresentation(): React.JSX.Element {
  const [insight, setInsight] = useState<Insight | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)

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

    // Auto-hide after 6 seconds
    const timer = setTimeout(() => {
      if (!isExpanded) {
        setIsVisible(false)
        setTimeout(() => {
          if (window.api?.presentation) {
            window.api.presentation.hide()
          }
        }, 300)
      }
    }, 6000)

    return () => clearTimeout(timer)
  }, [isExpanded])

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

  if (!isExpanded) {
    return (
      <div className="h-screen bg-transparent flex items-end justify-end p-4">
        <div
          className={`bg-gray-900 border-2 ${getPriorityColor(insight.priority)} rounded-full shadow-lg cursor-pointer hover:scale-105 transition-all duration-200 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-2 p-3">
            <div className={`p-2 rounded-full ${getTypeColor(insight.type)} text-white`}>
              {getTypeIcon(insight.type)}
            </div>
            <div className="text-white text-sm font-medium max-w-48 truncate">{insight.title}</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-transparent flex items-end justify-end p-4">
      <div
        className={`bg-gray-900 border-2 ${getPriorityColor(insight.priority)} rounded-lg shadow-2xl max-w-sm w-full transform transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
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
          <p className="text-gray-300 text-xs leading-relaxed mb-3 selectable">{insight.content}</p>

          {/* Actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  console.log('Executing action:', insight.suggestedActions[0].type)
                  setIsVisible(false)
                  setTimeout(() => {
                    if (window.api?.presentation) {
                      window.api.presentation.hide()
                    }
                  }, 300)
                }}
                className="flex-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 cursor-pointer text-white text-xs rounded transition-all"
              >
                {insight.suggestedActions[0].type.replace('_', ' ')}
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 active:scale-95 cursor-pointer text-white text-xs rounded transition-all"
              >
                Minimize
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
