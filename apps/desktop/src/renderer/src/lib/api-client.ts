let BASE_URL = 'http://localhost:3000/api'

const resolveBaseUrl = async () => {
  try {
    if (window.api && window.api.apiServer) {
      const port = await window.api.apiServer.getPort()
      return `http://localhost:${port}/api`
    }
  } catch (error) {
    console.warn('Failed to fetch dynamic API port, falling back to previous base URL:', error)
  }
  return BASE_URL
}

const getBaseUrl = async () => {
  BASE_URL = await resolveBaseUrl()
  return BASE_URL
}

export const apiClient = {
  settings: {
    getAIConfig: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/ai-config`)
      if (!res.ok) throw new Error('Failed to fetch AI config')
      return res.json()
    },
    saveAIConfig: async (config: Record<string, unknown>) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/ai-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to save AI config')
      return res.json()
    },
    fetchModels: async (config: Record<string, unknown>) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/fetch-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return res.json()
    },
    getAppSettings: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/app`)
      if (!res.ok) throw new Error('Failed to fetch app settings')
      return res.json()
    },
    saveAppSettings: async (settings: { notificationsEnabled: boolean }) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/app`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (!res.ok) throw new Error('Failed to save app settings')
      return res.json()
    },
    getShortcut: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/shortcut`)
      if (!res.ok) throw new Error('Failed to get shortcut')
      return res.json()
    },
    saveShortcut: async (shortcut: string) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/settings/shortcut`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcut })
      })
      if (!res.ok) throw new Error('Failed to save shortcut')
      return res.json()
    }
  },
  monitoring: {
    getStatus: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/monitoring/status`)
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    },
    start: async (config: Record<string, unknown>) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/monitoring/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to start monitoring')
      return res.json()
    },
    stop: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/monitoring/stop`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to stop monitoring')
      return res.json()
    },
    pause: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/monitoring/pause`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to pause monitoring')
      return res.json()
    },
    resume: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/monitoring/resume`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to resume monitoring')
      return res.json()
    }
  },
  database: {
    getInsights: async (limit = 50) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/insights?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch insights')
      return res.json()
    },
    getKnowledgeItems: async (limit = 100) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/knowledge?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch knowledge items')
      return res.json()
    },
    searchKnowledge: async (query: string) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/knowledge/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('Failed to search knowledge')
      return res.json()
    },
    getUser: async (userId: string) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/users/${userId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    createUser: async (userData: Record<string, unknown>) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      if (!res.ok) throw new Error('Failed to create user')
      return res.json()
    },
    deleteKnowledgeItem: async (id: string) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/knowledge/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete knowledge item')
      return res.json()
    }
  },
  plugins: {
    list: async () => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/plugins`)
      if (!res.ok) throw new Error('Failed to fetch plugins')
      return res.json()
    },
    toggle: async (id: string, enabled: boolean) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/plugins/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      })
      if (!res.ok) throw new Error('Failed to toggle plugin')
      return res.json()
    },
    updateConfig: async (id: string, config: Record<string, unknown>) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/plugins/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, config })
      })
      if (!res.ok) throw new Error('Failed to update plugin config')
      return res.json()
    }
  },
  events: {
    getTypes: async (options?: { domain?: string; source?: string }) => {
      const baseUrl = await getBaseUrl()
      const params = new URLSearchParams()
      if (options?.domain) params.append('domain', options.domain)
      if (options?.source) params.append('source', options.source)
      const query = params.toString()
      const res = await fetch(`${baseUrl}/events/types${query ? `?${query}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch event types')
      return res.json()
    },
    getType: async (type: string) => {
      const baseUrl = await getBaseUrl()
      const res = await fetch(`${baseUrl}/events/types/${encodeURIComponent(type)}`)
      if (!res.ok) throw new Error('Failed to fetch event type')
      return res.json()
    },
    getHistory: async (options?: {
      page?: number
      pageSize?: number
      eventType?: string
      startDate?: string
      endDate?: string
      search?: string
    }) => {
      const baseUrl = await getBaseUrl()
      const params = new URLSearchParams()
      if (options?.page) params.append('page', String(options.page))
      if (options?.pageSize) params.append('pageSize', String(options.pageSize))
      if (options?.eventType) params.append('eventType', options.eventType)
      if (options?.startDate) params.append('startDate', options.startDate)
      if (options?.endDate) params.append('endDate', options.endDate)
      if (options?.search) params.append('search', options.search)
      const query = params.toString()
      const res = await fetch(`${baseUrl}/events${query ? `?${query}` : ''}`)
      if (!res.ok) throw new Error('Failed to fetch event history')
      return res.json()
    }
  }
}
