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
}

export default function OverlayPresentation(): React.JSX.Element {
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

    // Auto-hide after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        if (window.api?.presentation) {
          window.api.presentation.hide()
        }
      }, 300)
    }, 5000)

    return () => clearTimeout(timer)
  }, [])

  const getTypeIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'task':
        return <CheckSquare className="h-5 w-5" />
      case 'schedule':
        return <Calendar className="h-5 w-5" />
      case 'note':
        return <Lightbulb className="h-5 w-5" />
      case 'analysis':
        return <AlertCircle className="h-5 w-5" />
      default:
        return <Lightbulb className="h-5 w-5" />
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
    <div className="h-screen bg-transparent flex items-center justify-center p-4">
      <div
        className={`bg-gray-900 border-2 ${getPriorityColor(insight.priority)} rounded-lg shadow-2xl max-w-md w-full transform transition-all duration-300 ${isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${getTypeColor(insight.type)} text-white`}>
              {getTypeIcon(insight.type)}
            </div>
            <h3 className="text-lg font-semibold text-white truncate">{insight.title}</h3>
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
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-gray-300 text-sm leading-relaxed mb-4">{insight.content}</p>

          {/* Suggested Actions */}
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-gray-400">Suggested Actions:</h4>
              <div className="flex flex-col gap-1">
                {insight.suggestedActions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-gray-300">
                    <div className="w-1 h-1 bg-blue-400 rounded-full" />
                    <span>{action.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {insight.metadata && Object.keys(insight.metadata).length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="flex flex-wrap gap-2">
                {Object.entries(insight.metadata).map(([key, value]) => (
                  <span key={key} className="px-2 py-1 bg-gray-800 text-xs rounded text-gray-400">
                    {key}: {Array.isArray(value) ? value.join(', ') : String(value)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-700">
          <button
            onClick={() => {
              // Implement dismiss action
              setIsVisible(false)
              setTimeout(() => {
                if (window.api?.presentation) {
                  window.api.presentation.hide()
                }
              }, 300)
            }}
            className="px-3 py-1 text-sm text-gray-400 hover:text-white active:text-gray-200 cursor-pointer transition-colors"
          >
            Dismiss
          </button>
          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <button
              onClick={() => {
                // Implement primary action
                console.log('Executing primary action:', insight.suggestedActions[0])
                setIsVisible(false)
                setTimeout(() => {
                  if (window.api?.presentation) {
                    window.api.presentation.hide()
                  }
                }, 300)
              }}
              className="px-4 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 cursor-pointer text-white text-sm rounded transition-all"
            >
              {insight.suggestedActions[0].type.replace('_', ' ')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
