import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children?: ReactNode
  pluginId?: string
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

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <h2 className="text-lg font-semibold mb-2">Plugin Error</h2>
          <p className="text-sm mb-2">
            The plugin "{this.props.pluginId}" encountered an error and could not be rendered.
          </p>
          <pre className="bg-red-100 p-2 rounded text-xs overflow-auto max-h-40">
            {this.state.error?.message}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
}
