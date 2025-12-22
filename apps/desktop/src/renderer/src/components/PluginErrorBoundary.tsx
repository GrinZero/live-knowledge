import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface Props {
  children?: ReactNode
  pluginId?: string
  variant?: 'default' | 'icon'
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PluginErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Plugin Error (${this.props.pluginId || 'unknown'}):`, error, errorInfo)
  }

  handleUninstall = async () => {
    if (this.props.pluginId) {
      if (confirm(`Are you sure you want to uninstall the plugin "${this.props.pluginId}"?`)) {
        try {
          await window.api.plugins.uninstall(this.props.pluginId)
          window.location.reload()
        } catch (error) {
          console.error('Failed to uninstall plugin:', error)
          alert('Failed to uninstall plugin')
        }
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.variant === 'icon') {
        return (
          <div
            className="h-4 w-4 text-red-500 flex items-center justify-center cursor-pointer"
            title={`Plugin Error: ${this.props.pluginId}. Click to uninstall.`}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              this.handleUninstall()
            }}
          >
            <AlertTriangle className="h-full w-full" />
          </div>
        )
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <h2 className="text-lg font-semibold mb-2">Plugin Error</h2>
          <p className="text-sm mb-2">
            The plugin &quot;{this.props.pluginId}&quot; encountered an error and could not be
            rendered.
          </p>
          <pre className="bg-red-100 p-2 rounded text-xs overflow-auto max-h-40 mb-4">
            {this.state.error?.message}
          </pre>
          <button
            onClick={this.handleUninstall}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <Trash2 className="h-4 w-4" />
            Uninstall Plugin
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
