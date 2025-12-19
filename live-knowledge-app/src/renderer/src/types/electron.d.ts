export interface MonitoringAPI {
  start: (config: import('./index').MonitorConfig) => Promise<void>
  stop: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  getStatus: () => Promise<{
    status: string
    startTime?: string
    lastCapture?: string
    totalCaptures: number
    totalInsights: number
    error?: string
  }>
  onInsight: (callback: (insight: unknown) => void) => void
  onStatusChange: (callback: (status: unknown) => void) => void
  onError: (callback: (error: unknown) => void) => void
}

export interface DatabaseAPI {
  getUser: (userId: string) => Promise<unknown>
  createUser: (userData: unknown) => Promise<unknown>
  getInsights: (limit?: number) => Promise<unknown[]>
  getKnowledgeItems: (limit?: number) => Promise<unknown[]>
  deleteKnowledgeItem: (id: string) => Promise<void>
  searchKnowledge: (query: string) => Promise<unknown[]>
  getUserStats: (userId: string) => Promise<unknown>
}

export interface PresentationAPI {
  show: (insight: unknown, config?: unknown) => Promise<void>
  hide: () => Promise<void>
  setMode: (mode: string) => Promise<{ success: boolean }>
  getConfig: () => Promise<unknown>
  updateConfig: (config: unknown) => Promise<{ success: boolean }>
}

export interface SettingsAPI {
  getAIConfig: () => Promise<{ apiKey: string; provider: string; model: string; proxyUrl?: string; language?: 'zh' | 'en' } | null>
  saveAIConfig: (config: { apiKey: string; provider: string; model: string; proxyUrl?: string; language?: 'zh' | 'en' }) => Promise<void>
  fetchModels: (config: { apiKey: string; provider: string; proxyUrl?: string }) => Promise<string[]>
}

export interface API {
  monitoring: MonitoringAPI
  database: DatabaseAPI
  presentation: PresentationAPI
  settings: SettingsAPI
}

declare global {
  interface Window {
    api: API
    electron: unknown
  }
}
