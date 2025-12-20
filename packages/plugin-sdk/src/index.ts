import { IpcMainInvokeEvent } from 'electron'
import { Router } from 'express'

// --- Domain Types ---

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface Tag {
  id: string
  type:
    | 'meeting_schedule'
    | 'task_todo'
    | 'topic_discussion'
    | 'data_table'
    | 'problem_solving'
    | 'insight_context'
  title: string
  content: string
  metadata: Record<string, unknown>
  timestamp: string
  confidence: number
}

export interface Action {
  type: string
  payload: Record<string, unknown>
  confirmationRequired: boolean
}

export interface Insight {
  id: string
  type: 'task' | 'schedule' | 'note' | 'analysis' | 'reminder'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  suggestedActions: Action[]
  metadata: Record<string, unknown>
}

export interface KnowledgeItem {
  id: string
  userId: string
  type: string
  title: string
  content: string
  metadata: Record<string, unknown>
  confidence: number
  createdAt: string
}

export interface Screenshot {
  id: string
  sessionId: string
  imagePath: string
  metadata: Record<string, unknown>
  capturedAt: string
}

// --- Service Interfaces ---

export interface PluginDatabaseService {
  getKnowledgeItems(limit?: number): Promise<KnowledgeItem[]>
  createKnowledgeItem(item: Omit<KnowledgeItem, 'id' | 'createdAt'>): Promise<KnowledgeItem>
  getKnowledgeItemById(id: string): Promise<KnowledgeItem | null>
  searchKnowledge(query: string): Promise<KnowledgeItem[]>
  deleteKnowledgeItem(id: string): Promise<void>
  // Add more as needed by plugins
}

// --- Plugin System Interfaces ---

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
  database: PluginDatabaseService
}

export interface LiveKnowledgePlugin {
  id: string
  name: string
  version: string
  description?: string
  
  // Configuration
  defaultConfig?: Record<string, unknown>
  config?: Record<string, unknown>
  configSchema?: Record<string, unknown>
  onConfigUpdated?: (newConfig: Record<string, unknown>) => void

  // Initialization Phase
  initialize?: (context: PluginContext) => void

  hooks?: {
    // Input Phase
    getContext?: () => Promise<Record<string, unknown>>

    // Core Phase
    enrichPrompt?: (currentContext: Record<string, unknown>) => Promise<string | void>

    // Output Phase
    onAction?: (action: Action) => Promise<boolean>
    
    // Event Phase
    onEvent?: (event: string, payload: Record<string, unknown>) => Promise<void>
  }
}
