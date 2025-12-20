import { Action } from '../../renderer/src/types'
import { IpcMainInvokeEvent } from 'electron'

export interface PluginContext {
  ai: {
    generateCompletion: (prompt: string) => Promise<string>
  }
  ipc: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle: (channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => (Promise<void> | any)) => void
  }
}

export interface LiveKnowledgePlugin {
  id: string
  name: string
  version: string
  description?: string

  // Initialization Phase: Receive dependencies and register backend handlers
  initialize?: (context: PluginContext) => void

  hooks?: {
    // Input Phase: Gather extra context (e.g. git branch, calendar)
    // Returns a dictionary of context data to be merged into the analysis context
    getContext?: () => Promise<Record<string, unknown>>

    // Core Phase: Modify system prompt or inject rules
    // Receives current context, returns a string to be appended to the system prompt
    enrichPrompt?: (currentContext: Record<string, unknown>) => Promise<string | void>

    // Output Phase: Handle specific actions
    // Returns true if the action was handled, false otherwise
    onAction?: (action: Action) => Promise<boolean>
  }
}

export interface PluginManagerConfig {
  pluginDir?: string
}
