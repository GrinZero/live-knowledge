export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface Tag {
  type: 'meeting_schedule' | 'task_todo' | 'topic_discussion' | 'data_table' | 'problem_solving' | 'insight_context'
  title: string
  content: string
  metadata: Record<string, any>
  timestamp: string
  confidence: number
}

export interface Insight {
  id: string
  type: 'task' | 'schedule' | 'note' | 'analysis' | 'reminder'
  title: string
  content: string
  priority: 'low' | 'medium' | 'high'
  suggestedActions: Action[]
  metadata: Record<string, any>
}

export interface Action {
  type: 'create_task' | 'add_calendar' | 'save_note' | 'send_notification'
  payload: Record<string, any>
  confirmationRequired: boolean
}

export interface ContextWindow {
  recentContexts: string[]
  knowledgeItems: KnowledgeItem[]
  session: { id: string; startedAt: string }
}

export interface KnowledgeItem {
  id: string
  userId: string
  type: string
  title: string
  content: string
  metadata: Record<string, any>
  confidence: number
  createdAt: string
}

export interface MonitoringSession {
  id: string
  userId: string
  config: MonitorConfig
  status: 'active' | 'paused' | 'stopped'
  startedAt: string
  endedAt?: string
  createdAt: string
}

export interface MonitorConfig {
  region?: Rectangle
  mode: 'full' | 'region' | 'window'
  triggerConfig: {
    debounce: number
    throttle: number
    similarityThreshold: number
  }
}

export interface Screenshot {
  id: string
  sessionId: string
  imagePath: string
  metadata: Record<string, any>
  capturedAt: string
}

export interface TriggerEvent {
  id: string
  sessionId: string
  eventType: string
  content: Record<string, any>
  confidence: number
  triggeredAt: string
}

export interface UserAction {
  id: string
  itemId: string
  actionType: string
  payload: Record<string, any>
  status: 'pending' | 'completed' | 'failed'
  executedAt?: string
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string
  preferences: Record<string, any>
  plan: 'free' | 'premium'
  createdAt: string
  updatedAt: string
}

export interface IntegrationConfig {
  id: string
  userId: string
  provider: string
  credentials: Record<string, any>
  settings: Record<string, any>
  enabled: boolean
  createdAt: string
  updatedAt: string
}