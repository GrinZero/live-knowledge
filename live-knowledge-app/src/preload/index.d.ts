import { ElectronAPI } from '@electron-toolkit/preload'

interface MonitoringAPI {
  start: (config: any) => Promise<any>
  stop: () => Promise<any>
  pause: () => Promise<any>
  resume: () => Promise<any>
  getStatus: () => Promise<any>
  onInsight: (callback: (insight: any) => void) => void
  onStatusChange: (callback: (status: any) => void) => void
  onError: (callback: (error: any) => void) => void
}

interface DatabaseAPI {
  getUser: (userId: string) => Promise<any>
  createUser: (userData: any) => Promise<any>
  getInsights: (limit?: number) => Promise<any[]>
  getKnowledgeItems: (limit?: number) => Promise<any[]>
  searchKnowledge: (query: string) => Promise<any[]>
  getUserStats: (userId: string) => Promise<any>
}

interface API {
  monitoring: MonitoringAPI
  database: DatabaseAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: API
  }
}
