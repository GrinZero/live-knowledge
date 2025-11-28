/// <reference types="vite/client" />

import type { Insight, MonitorConfig, MonitoringSession, KnowledgeItem, User } from './types'
import type { PresentationConfig } from '../../main/services/PresentationService'

declare global {
  interface Window {
    electron: { process: { versions: Record<string, string> } }
    api: {
      monitoring: {
        start: (config: MonitorConfig) => Promise<MonitoringSession>
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
        onInsight: (callback: (insight: Insight) => void) => void
        onStatusChange: (callback: (status: { status: string; sessionId?: string }) => void) => void
        onError: (callback: (error: unknown) => void) => void
      }
      database: {
        getUser: (userId: string) => Promise<User | null>
        createUser: (userData: {
          email: string
          name: string
          preferences?: Record<string, unknown>
          plan?: 'free' | 'premium'
        }) => Promise<User>
        getInsights: (limit?: number) => Promise<
          Array<{
            id: string
            knowledgeItemId: string
            title: string
            content: string
            type: string
            confidence: number
            tags: string[]
            createdAt: string
            itemTitle: string
            itemType: string
            screenshotPath?: string
          }>
        >
        getKnowledgeItems: (limit?: number) => Promise<KnowledgeItem[]>
        searchKnowledge: (query: string) => Promise<KnowledgeItem[]>
        getUserStats: (userId: string) => Promise<{
          totalKnowledgeItems: number
          totalInsights: number
          totalActions: number
          activeSessions: number
        }>
      }
      presentation: {
        show: (insight: Insight, config?: PresentationConfig) => Promise<void>
        hide: () => Promise<void>
        setMode: (mode: string) => Promise<{ success: boolean }>
        getConfig: () => Promise<PresentationConfig>
        updateConfig: (config: Partial<PresentationConfig>) => Promise<{ success: boolean }>
      }
    }
  }
}

export {}
