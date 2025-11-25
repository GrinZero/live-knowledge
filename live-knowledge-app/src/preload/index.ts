import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  // Monitoring control APIs
  monitoring: {
    start: (config: any) => ipcRenderer.invoke('monitoring:start', config),
    stop: () => ipcRenderer.invoke('monitoring:stop'),
    pause: () => ipcRenderer.invoke('monitoring:pause'),
    resume: () => ipcRenderer.invoke('monitoring:resume'),
    getStatus: () => ipcRenderer.invoke('monitoring:getStatus'),
    onInsight: (callback: (insight: any) => void) => {
      ipcRenderer.on('monitoring:insight', (_, insight) => callback(insight))
    },
    onStatusChange: (callback: (status: any) => void) => {
      ipcRenderer.on('monitoring:status', (_, status) => callback(status))
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on('monitoring:error', (_, error) => callback(error))
    }
  },
  
  // Database APIs
  database: {
    getUser: (userId: string) => ipcRenderer.invoke('db:getUser', userId),
    createUser: (userData: any) => ipcRenderer.invoke('db:createUser', userData),
    getInsights: (limit: number = 50) => ipcRenderer.invoke('db:getInsights', limit),
    getKnowledgeItems: (limit: number = 100) => ipcRenderer.invoke('db:getKnowledgeItems', limit),
    searchKnowledge: (query: string) => ipcRenderer.invoke('db:searchKnowledge', query),
    getUserStats: (userId: string) => ipcRenderer.invoke('db:getUserStats', userId)
  },
  
  // Presentation APIs
  presentation: {
    show: (insight: any, config?: any) => ipcRenderer.invoke('presentation:show', insight, config),
    hide: () => ipcRenderer.invoke('presentation:hide'),
    setMode: (mode: string) => ipcRenderer.invoke('presentation:setMode', mode),
    getConfig: () => ipcRenderer.invoke('presentation:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('presentation:updateConfig', config)
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
