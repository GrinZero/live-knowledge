import { Action } from '../../renderer/src/types'
import { IpcMainInvokeEvent } from 'electron'
import { Router } from 'express'
import { DatabaseService } from '../services/DatabaseService'

export interface PluginContext {
  ai: {
    generateCompletion: (prompt: string) => Promise<string>
    generateCompletionStream: (
      prompt: string,
      images?: string[]
    ) => AsyncGenerator<string, void, unknown>
  }
  ipc: {
    handle: (
      channel: string,
      listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<void> | unknown
    ) => void
  }
  http: {
    router: Router
  }
  database: DatabaseService
}

export interface LiveKnowledgePlugin {
  id: string
  name: string
  version: string
  description?: string

  // Configuration
  defaultConfig?: Record<string, unknown>
  config?: Record<string, unknown>
  onConfigUpdated?: (newConfig: Record<string, unknown>) => void

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
