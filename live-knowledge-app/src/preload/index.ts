import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { MonitorConfig, Insight } from '../renderer/src/types'
import { PresentationConfig } from '../main/services/PresentationService'

// Custom APIs for renderer
const api = {
  // Monitoring control APIs
  monitoring: {
    start: (config: MonitorConfig) => ipcRenderer.invoke('monitoring:start', config),
    stop: () => ipcRenderer.invoke('monitoring:stop'),
    pause: () => ipcRenderer.invoke('monitoring:pause'),
    resume: () => ipcRenderer.invoke('monitoring:resume'),
    getStatus: () => ipcRenderer.invoke('monitoring:getStatus'),
    onInsight: (callback: (insight: Insight) => void) => {
      ipcRenderer.on('monitoring:insight', (_, insight) => callback(insight))
    },
    onStatusChange: (callback: (status: { status: string; sessionId?: string }) => void) => {
      ipcRenderer.on('monitoring:status', (_, status) => callback(status))
    },
    onError: (callback: (error: unknown) => void) => {
      ipcRenderer.on('monitoring:error', (_, error) => callback(error))
    }
  },

  // Database APIs
  database: {
    getUser: (userId: string) => ipcRenderer.invoke('db:getUser', userId),
    createUser: (userData: {
      email: string
      name: string
      preferences?: Record<string, unknown>
      plan?: 'free' | 'premium'
    }) => ipcRenderer.invoke('db:createUser', userData),
    getInsights: (limit: number = 50) => ipcRenderer.invoke('db:getInsights', limit),
    getKnowledgeItems: (limit: number = 100) => ipcRenderer.invoke('db:getKnowledgeItems', limit),
    deleteKnowledgeItem: (id: string) => ipcRenderer.invoke('db:deleteKnowledgeItem', id),
    searchKnowledge: (query: string) => ipcRenderer.invoke('db:searchKnowledge', query),
    getUserStats: (userId: string) => ipcRenderer.invoke('db:getUserStats', userId)
  },

  // Presentation APIs
  presentation: {
    show: (insight: Insight, config?: PresentationConfig) =>
      ipcRenderer.invoke('presentation:show', insight, config),
    hide: () => ipcRenderer.invoke('presentation:hide'),
    setMode: (mode: string) => ipcRenderer.invoke('presentation:setMode', mode),
    getConfig: () => ipcRenderer.invoke('presentation:getConfig'),
    updateConfig: (config: Partial<PresentationConfig>) =>
      ipcRenderer.invoke('presentation:updateConfig', config)
  },

  // Settings APIs
  settings: {
    getAIConfig: () => ipcRenderer.invoke('settings:getAIConfig'),
    saveAIConfig: (config: {
      apiKey: string
      provider: string
      model: string
      proxyUrl?: string
    }) => ipcRenderer.invoke('settings:saveAIConfig', config),
    fetchModels: (config: { apiKey: string; provider: string; proxyUrl?: string }) =>
      ipcRenderer.invoke('settings:fetchModels', config)
  },

  // Plugin APIs
  plugins: {
    list: () => ipcRenderer.invoke('plugins:list'),
    toggle: (id: string, enabled: boolean) => ipcRenderer.invoke('plugins:toggle', id, enabled)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
