const BASE_URL = 'http://localhost:3000/api'

export const apiClient = {
  settings: {
    getAIConfig: async () => {
      const res = await fetch(`${BASE_URL}/settings/ai-config`)
      if (!res.ok) throw new Error('Failed to fetch AI config')
      return res.json()
    },
    saveAIConfig: async (config: any) => {
      const res = await fetch(`${BASE_URL}/settings/ai-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to save AI config')
      return res.json()
    },
    fetchModels: async (config: any) => {
      const res = await fetch(`${BASE_URL}/settings/fetch-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to fetch models')
      return res.json()
    }
  },
  monitoring: {
    getStatus: async () => {
      const res = await fetch(`${BASE_URL}/monitoring/status`)
      if (!res.ok) throw new Error('Failed to fetch status')
      return res.json()
    },
    start: async (config: any) => {
      const res = await fetch(`${BASE_URL}/monitoring/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to start monitoring')
      return res.json()
    },
    stop: async () => {
      const res = await fetch(`${BASE_URL}/monitoring/stop`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to stop monitoring')
      return res.json()
    },
    pause: async () => {
      const res = await fetch(`${BASE_URL}/monitoring/pause`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to pause monitoring')
      return res.json()
    },
    resume: async () => {
      const res = await fetch(`${BASE_URL}/monitoring/resume`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to resume monitoring')
      return res.json()
    }
  },
  database: {
    getInsights: async (limit = 50) => {
      const res = await fetch(`${BASE_URL}/insights?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch insights')
      return res.json()
    },
    getKnowledgeItems: async (limit = 100) => {
      const res = await fetch(`${BASE_URL}/knowledge?limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch knowledge items')
      return res.json()
    },
    searchKnowledge: async (query: string) => {
      const res = await fetch(`${BASE_URL}/knowledge/search?q=${encodeURIComponent(query)}`)
      if (!res.ok) throw new Error('Failed to search knowledge')
      return res.json()
    },
    getUser: async (userId: string) => {
      const res = await fetch(`${BASE_URL}/users/${userId}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error('Failed to fetch user')
      return res.json()
    },
    createUser: async (userData: any) => {
      const res = await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      })
      if (!res.ok) throw new Error('Failed to create user')
      return res.json()
    },
    deleteKnowledgeItem: async (id: string) => {
      const res = await fetch(`${BASE_URL}/knowledge/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete knowledge item')
      return res.json()
    }
  },
  plugins: {
    list: async () => {
      const res = await fetch(`${BASE_URL}/plugins`)
      if (!res.ok) throw new Error('Failed to fetch plugins')
      return res.json()
    },
    toggle: async (id: string, enabled: boolean) => {
      const res = await fetch(`${BASE_URL}/plugins/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      })
      if (!res.ok) throw new Error('Failed to toggle plugin')
      return res.json()
    },
    updateConfig: async (id: string, config: Record<string, unknown>) => {
      const res = await fetch(`${BASE_URL}/plugins/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, config })
      })
      if (!res.ok) throw new Error('Failed to update plugin config')
      return res.json()
    }
  },
  solver: {
    getContext: async (id: string) => {
      const res = await fetch(`${BASE_URL}/plugins/problem-solver/context?id=${id}`)
      if (!res.ok) throw new Error('Failed to fetch solver context')
      return res.json()
    },
    getHistory: async () => {
      const res = await fetch(`${BASE_URL}/plugins/problem-solver/history`)
      if (!res.ok) throw new Error('Failed to fetch solver history')
      return res.json()
    },
    generateStream: async (
      problem: string,
      onChunk: (chunk: string) => void,
      screenshotPath?: string,
      signal?: AbortSignal
    ) => {
      const res = await fetch(`${BASE_URL}/plugins/problem-solver/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem, screenshotPath }),
        signal
      })

      if (!res.ok || !res.body) {
        let errorMsg = 'Failed to generate solution'
        try {
          const errorData = await res.json()
          if (errorData && errorData.error) {
            errorMsg = `Server Error: ${errorData.error}`
          }
        } catch {
          errorMsg = `Server Error: ${res.status} ${res.statusText}`
        }
        throw new Error(errorMsg)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value, { stream: true })
        onChunk(text)
      }
      // Flush any remaining text from the decoder
      const finalText = decoder.decode()
      if (finalText) {
        onChunk(finalText)
      }
    }
  }
}
