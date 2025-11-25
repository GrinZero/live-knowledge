export interface MonitoringAPI {
  start: (config: any) => Promise<void>
  stop: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  getStatus: () => Promise<any>
  onInsight: (callback: (insight: any) => void) => void
  onStatusChange: (callback: (status: any) => void) => void
  onError: (callback: (error: any) => void) => void
}

export interface DatabaseAPI {
  getUser: (userId: string) => Promise<any>
  createUser: (userData: any) => Promise<any>
  getInsights: (limit?: number) => Promise<any[]>
  getKnowledgeItems: (limit?: number) => Promise<any[]>
  searchKnowledge: (query: string) => Promise<any[]>
  getUserStats: (userId: string) => Promise<any>
}

export interface PresentationAPI {
  show: (insight: any, config?: any) => Promise<void>
  hide: () => Promise<void>
  setMode: (mode: string) => Promise<{ success: boolean }>
  getConfig: () => Promise<any>
  updateConfig: (config: any) => Promise<{ success: boolean }>
}

export interface API {
  monitoring: MonitoringAPI
  database: DatabaseAPI
  presentation: PresentationAPI
}

declare global {
  interface Window {
    api: API
    electron: any
  }
}