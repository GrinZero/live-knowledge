/// <reference types="vite/client" />

import type { Insight, MonitorConfig, MonitoringSession, KnowledgeItem, User } from './types'
import type { PresentationConfig } from '../../main/services/PresentationService'

import type { RendererPlugin } from './plugin-registry'

declare global {
  interface Window {
    electron: { process: { versions: Record<string, string> } }
    LiveKnowledge: {
      registerPlugin: (plugin: RendererPlugin) => void
    }
    React: typeof import('react')
    ReactDOM: typeof import('react-dom')
    ReactRouterDOM: typeof import('react-router-dom')
    ReactJSXRuntime: typeof import('react/jsx-runtime')
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
        deleteKnowledgeItem: (id: string) => Promise<void>
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
      settings: {
        getAIConfig: () => Promise<{
          apiKey: string
          provider: string
          model: string
          proxyUrl?: string
          language?: 'zh' | 'en'
        } | null>
        saveAIConfig: (config: {
          apiKey: string
          provider: string
          model: string
          proxyUrl?: string
          language?: 'zh' | 'en'
        }) => Promise<void>
        fetchModels: (config: {
          apiKey: string
          provider: string
          proxyUrl?: string
        }) => Promise<string[]>
      }
      plugins: {
        list: () => Promise<
          Array<{
            id: string
            name: string
            version: string
            description: string
            enabled: boolean
            config?: Record<string, unknown>
            configSchema?: Record<string, unknown>
            canUninstall?: boolean
          }>
        >
        getRendererPlugins: () => Promise<Array<{ id: string; scriptPath: string }>>
        toggle: (id: string, enabled: boolean) => Promise<boolean>
        install: (path: string) => Promise<boolean>
        uninstall: (id: string) => Promise<boolean>
        openFileDialog: () => Promise<string | null>
        invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      }
      shortcut: {
        get: () => Promise<string>
        set: (shortcut: string) => Promise<void>
      }
      window: {
        onBlur: (callback: () => void) => void
        onFocus: (callback: () => void) => void
      }
      logs: {
        export: () => Promise<{ success: boolean; content?: string; path?: string; error?: string }>
      }
      apiServer: {
        getPort: () => Promise<number>
      }
    }
  }
}

export {}
