import express from 'express'
import cors from 'cors'
import fs from 'fs'
import { DatabaseService } from '../services/DatabaseService'
import { MonitoringService } from '../services/MonitoringService'
import { PresentationService } from '../services/PresentationService'
import { PluginManager } from '../services/PluginManager'
import { AIEngine } from '../services/AIEngine'

// 本地 TriggerEvent 类型定义
interface TriggerEvent {
  id: string
  sessionId: string
  eventType: string
  content: Record<string, unknown>
  confidence: number
  triggeredAt: string
}

export class APIServer {
  private app: express.Application
  private databaseService: DatabaseService
  private monitoringService: MonitoringService
  private presentationService: PresentationService
  private pluginManager: PluginManager
  private aiEngine: AIEngine
  private port: number
  private sseClients: Map<string, { res: express.Response; lastEventId: string | null }> = new Map()
  private ssePollInterval: NodeJS.Timeout | null = null

  constructor(
    databaseService: DatabaseService,
    monitoringService: MonitoringService,
    presentationService: PresentationService,
    pluginManager: PluginManager,
    aiEngine: AIEngine,
    port: number = 3000
  ) {
    this.app = express()
    this.databaseService = databaseService
    this.monitoringService = monitoringService
    this.presentationService = presentationService
    this.pluginManager = pluginManager
    this.aiEngine = aiEngine
    this.port = port

    this.setupMiddleware()
    this.setupRoutes()
  }

  private setupMiddleware(): void {
    this.app.use(cors())
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))

    // Request logging middleware
    this.app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
      next()
    })
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req: express.Request, res: express.Response) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      })
    })

    this.setupMonitoringRoutes()
    this.setupDatabaseRoutes()
    this.setupPresentationRoutes()
    this.setupKnowledgeRoutes()
    this.setupSettingsRoutes()
    this.setupPluginRoutes()

    // Error handling middleware
    this.app.use((err: unknown, _req: express.Request, res: express.Response) => {
      console.error('API Error:', err)
      const message = (err as Error)?.message || 'An unexpected error occurred'
      res.status(500).json({
        error: 'Internal server error',
        message
      })
    })

    // 404 handler
    this.app.use((_req: express.Request, res: express.Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${_req.method} ${_req.path} not found`
      })
    })
  }

  private setupMonitoringRoutes(): void {
    this.app.get('/api/monitoring/status', async (_req: express.Request, res: express.Response) => {
      try {
        const status = await this.monitoringService.getStatus()
        res.json(status)
      } catch (error) {
        res
          .status(500)
          .json({ error: 'Failed to get monitoring status', message: (error as Error).message })
      }
    })

    this.app.post('/api/monitoring/start', async (req: express.Request, res: express.Response) => {
      try {
        const config = req.body
        const session = await this.monitoringService.startMonitoring(config)
        res.json({ success: true, session })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to start monitoring', message: (error as Error).message })
      }
    })

    this.app.post('/api/monitoring/stop', async (_req: express.Request, res: express.Response) => {
      try {
        await this.monitoringService.stopMonitoring()
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to stop monitoring', message: (error as Error).message })
      }
    })

    this.app.post('/api/monitoring/pause', async (_req: express.Request, res: express.Response) => {
      try {
        await this.monitoringService.pauseMonitoring()
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to pause monitoring', message: (error as Error).message })
      }
    })

    this.app.post(
      '/api/monitoring/resume',
      async (_req: express.Request, res: express.Response) => {
        try {
          await this.monitoringService.resumeMonitoring()
          res.json({ success: true })
        } catch (error) {
          res
            .status(400)
            .json({ error: 'Failed to resume monitoring', message: (error as Error).message })
        }
      }
    )
  }

  private setupDatabaseRoutes(): void {
    this.app.get(
      '/api/users/:userId',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const user = await this.databaseService.getUser(req.params.userId)
          if (!user) {
            res.status(404).json({ error: 'User not found' })
            return
          }
          res.json(user)
        } catch (error) {
          res.status(500).json({ error: 'Failed to get user', message: (error as Error).message })
        }
      }
    )

    this.app.post(
      '/api/users',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const userData = req.body
          const user = await this.databaseService.createUser(userData)
          res.status(201).json(user)
        } catch (error) {
          res
            .status(400)
            .json({ error: 'Failed to create user', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/insights',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const limit = parseInt(req.query.limit as string) || 50
          const insights = await this.databaseService.getInsights(limit)
          res.json(insights)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get insights', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/knowledge',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const limit = parseInt(req.query.limit as string) || 100
          const items = await this.databaseService.getKnowledgeItems(limit)
          res.json(items)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get knowledge items', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/knowledge/search',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const query = req.query.q as string
          if (!query) {
            res.status(400).json({ error: 'Query parameter is required' })
            return
          }
          const results = await this.databaseService.searchKnowledge(query)
          res.json(results)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to search knowledge', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/users/:userId/stats',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const stats = await this.databaseService.getUserStatistics(req.params.userId)
          res.json(stats)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get user stats', message: (error as Error).message })
        }
      }
    )
  }

  private setupPresentationRoutes(): void {
    this.app.post(
      '/api/presentation/show',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const { insight, config } = req.body
          await this.presentationService.showInsight(insight, config)
          res.json({ success: true })
        } catch (error) {
          res
            .status(400)
            .json({ error: 'Failed to show presentation', message: (error as Error).message })
        }
      }
    )

    this.app.post(
      '/api/presentation/hide',
      async (_req: express.Request, res: express.Response): Promise<void> => {
        try {
          await this.presentationService.hidePresentation()
          res.json({ success: true })
        } catch (error) {
          res
            .status(400)
            .json({ error: 'Failed to hide presentation', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/presentation/config',
      async (_req: express.Request, res: express.Response): Promise<void> => {
        try {
          const config = this.presentationService.getConfig()
          res.json(config)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get presentation config', message: (error as Error).message })
        }
      }
    )

    this.app.put(
      '/api/presentation/config',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const config = req.body
          this.presentationService.updateConfig(config)
          res.json({ success: true })
        } catch (error) {
          res.status(400).json({
            error: 'Failed to update presentation config',
            message: (error as Error).message
          })
        }
      }
    )
  }

  private setupKnowledgeRoutes(): void {
    this.app.get(
      '/api/knowledge/:id',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const item = await this.databaseService.getKnowledgeItemById(req.params.id)
          if (!item) {
            res.status(404).json({ error: 'Knowledge item not found' })
            return
          }
          res.json(item)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get knowledge item', message: (error as Error).message })
        }
      }
    )

    this.app.get(
      '/api/knowledge/:id/export',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          const item = await this.databaseService.getKnowledgeItemById(req.params.id)
          if (!item) {
            res.status(404).json({ error: 'Knowledge item not found' })
            return
          }

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Content-Disposition', `attachment; filename="knowledge-${item.id}.json"`)
          res.json(item)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to export knowledge item', message: (error as Error).message })
        }
      }
    )

    this.app.delete(
      '/api/knowledge/:id',
      async (req: express.Request, res: express.Response): Promise<void> => {
        try {
          await this.databaseService.deleteKnowledgeItem(req.params.id)
          res.json({ success: true })
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to delete knowledge item', message: (error as Error).message })
        }
      }
    )
  }

  private setupSettingsRoutes(): void {
    this.app.get(
      '/api/settings/ai-config',
      async (_req: express.Request, res: express.Response) => {
        try {
          const config = await this.databaseService.getAIConfig('default_user')
          if (!config) {
            res.json(null)
            return
          }
          res.json({
            apiKey: config.credentials.apiKey,
            provider: config.settings.provider,
            model: config.settings.model,
            proxyUrl: config.settings.proxyUrl,
            baseUrl: config.settings.baseUrl,
            language: config.settings.language
          })
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to get AI config', message: (error as Error).message })
        }
      }
    )

    this.app.post(
      '/api/settings/ai-config',
      async (req: express.Request, res: express.Response) => {
        try {
          const config = req.body
          await this.databaseService.saveAIConfig('default_user', config)

          // Update running instance
          if (this.aiEngine) {
            this.aiEngine.updateConfig({
              ...config,
              provider: config.provider as 'openai' | 'gemini'
            })
          }
          res.json({ success: true })
        } catch (error) {
          res
            .status(400)
            .json({ error: 'Failed to save AI config', message: (error as Error).message })
        }
      }
    )

    this.app.post(
      '/api/settings/fetch-models',
      async (req: express.Request, res: express.Response) => {
        try {
          const config = req.body
          const models = await this.aiEngine.fetchModels(config)
          res.json(models)
        } catch (error) {
          res
            .status(500)
            .json({ error: 'Failed to fetch models', message: (error as Error).message })
        }
      }
    )

    this.app.get('/api/settings/app', async (_req: express.Request, res: express.Response) => {
      try {
        const settings = await this.databaseService.getAppSettings('default_user')
        res.json(settings)
      } catch (error) {
        res
          .status(500)
          .json({ error: 'Failed to get app settings', message: (error as Error).message })
      }
    })

    this.app.post('/api/settings/app', async (req: express.Request, res: express.Response) => {
      try {
        const settings = req.body
        await this.databaseService.saveAppSettings('default_user', settings)

        // Sync to running PresentationService
        if (this.presentationService) {
          this.presentationService.setNotificationsEnabled(settings.notificationsEnabled !== false)
        }
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to save app settings', message: (error as Error).message })
      }
    })

    // Shortcut settings routes
    this.app.get('/api/settings/shortcut', async (_req: express.Request, res: express.Response) => {
      try {
        const settings = await this.databaseService.getAppSettings('default_user')
        res.json({ shortcut: settings.quickCaptureShortcut || 'CommandOrControl+Shift+S' })
      } catch (error) {
        res.status(500).json({ error: 'Failed to get shortcut', message: (error as Error).message })
      }
    })

    this.app.post('/api/settings/shortcut', async (req: express.Request, res: express.Response) => {
      try {
        const { shortcut } = req.body
        if (!shortcut || shortcut.trim() === '') {
          res.status(400).json({ error: 'Shortcut cannot be empty' })
          return
        }
        await this.databaseService.saveAppSettings('default_user', {
          quickCaptureShortcut: shortcut
        })
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to save shortcut', message: (error as Error).message })
      }
    })
  }

  private setupPluginRoutes(): void {
    this.app.get('/api/plugins', async (_req: express.Request, res: express.Response) => {
      try {
        const status = this.pluginManager.getPluginStatus()
        res.json(status)
      } catch (error) {
        res.status(500).json({ error: 'Failed to get plugins', message: (error as Error).message })
      }
    })

    this.app.post('/api/plugins/toggle', async (req: express.Request, res: express.Response) => {
      try {
        const { id, enabled } = req.body
        this.pluginManager.togglePlugin(id, enabled)
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to toggle plugin', message: (error as Error).message })
      }
    })

    this.app.post('/api/plugins/config', async (req: express.Request, res: express.Response) => {
      try {
        const { id, config } = req.body
        this.pluginManager.updatePluginConfig(id, config)
        res.json({ success: true })
      } catch (error) {
        res
          .status(400)
          .json({ error: 'Failed to update plugin config', message: (error as Error).message })
      }
    })

    // Mount plugin routers dynamically
    // Note: In a real hot-reloading scenario, we'd need to handle updates.
    // For now, we assume plugins are registered before server start or we mount them here.
    // However, since express middleware stack is linear, adding routes after start works but order matters.
    // Better to use a "plugin router" that delegates.

    // We can iterate over existing plugins and mount them.
    // Also, we can expose a general wildcard route that delegates to PluginManager if needed,
    // but mounting valid express Routers is cleaner.

    // Mount all plugin routers under /api/plugins/:pluginId/
    // This allows plugins to define their own sub-routes like /generate, /config, etc.
    // e.g. /api/plugins/problem-solver/generate

    // Since plugins might be registered after APIServer starts (though currently it's before),
    // we can use a middleware that looks up the router.
    this.app.use('/api/plugins/:pluginId', (req, res, next) => {
      const pluginId = req.params.pluginId
      const router = this.pluginManager.pluginRouters.get(pluginId)
      if (router) {
        router(req, res, next)
      } else {
        next()
      }
    })

    // Event types endpoints
    this.app.get('/api/events/types', (req: express.Request, res: express.Response) => {
      try {
        const { domain, source } = req.query
        const types = this.pluginManager.getEventTypes({
          domain: domain as 'core' | 'knowledge' | 'information' | 'system' | undefined,
          source: source as 'core' | 'plugin' | undefined
        })
        res.json({
          total: types.length,
          types
        })
      } catch (error) {
        res
          .status(500)
          .json({ error: 'Failed to get event types', message: (error as Error).message })
      }
    })

    this.app.get('/api/events/types/:type', (req: express.Request, res: express.Response) => {
      try {
        const eventType = this.pluginManager.getEventType(req.params.type)
        if (!eventType) {
          res.status(404).json({ error: 'Event type not found' })
          return
        }
        res.json(eventType)
      } catch (error) {
        res
          .status(500)
          .json({ error: 'Failed to get event type', message: (error as Error).message })
      }
    })

    // Event history endpoint
    this.app.get('/api/events', async (req: express.Request, res: express.Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1
        const pageSize = parseInt(req.query.pageSize as string) || 20
        const eventType = req.query.eventType as string | undefined
        const startDate = req.query.startDate as string | undefined
        const endDate = req.query.endDate as string | undefined
        const search = req.query.search as string | undefined

        const result = await this.databaseService.getTriggerEvents({
          page,
          pageSize,
          eventType,
          startDate,
          endDate,
          search
        })

        // 处理截图路径，转为 base64
        const processedEvents = this.processEventScreenshots(result.events)
        res.json({ ...result, events: processedEvents })
      } catch (error) {
        res.status(500).json({ error: 'Failed to get events', message: (error as Error).message })
      }
    })

    // SSE 实时事件流
    this.app.get('/api/events/stream', async (req: express.Request, res: express.Response) => {
      const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const sinceEventId = req.query.since as string | undefined

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })

      // 注册客户端
      this.sseClients.set(clientId, { res, lastEventId: sinceEventId || null })

      // 发送初始数据
      try {
        const events = await this.databaseService.getLatestEventsSince(sinceEventId)
        if (events.length > 0) {
          const processedEvents = this.processEventScreenshots(events)
          res.write(`data: ${JSON.stringify({ type: 'init', events: processedEvents })}\n\n`)
          this.sseClients.set(clientId, { res, lastEventId: events[0].id })
        }
      } catch (error) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: (error as Error).message })}\n\n`
        )
      }

      // 启动轮询（如果还没启动）
      this.startSsePolling()

      // 客户端断开时清理
      req.on('close', () => {
        this.sseClients.delete(clientId)
        if (this.sseClients.size === 0) {
          this.stopSsePolling()
        }
      })
    })
  }

  // SSE 轮询推送新事件
  private startSsePolling(): void {
    if (this.ssePollInterval) return

    this.ssePollInterval = setInterval(async () => {
      if (this.sseClients.size === 0) return

      for (const [clientId, client] of this.sseClients) {
        try {
          const events = await this.databaseService.getLatestEventsSince(
            client.lastEventId || undefined
          )
          if (events.length > 0) {
            // 过滤掉已经在 lastEventId 之前的
            const newEvents = client.lastEventId
              ? events.filter((e) => e.id !== client.lastEventId)
              : events

            if (newEvents.length > 0) {
              const processedEvents = this.processEventScreenshots(newEvents)
              client.res.write(
                `data: ${JSON.stringify({ type: 'update', events: processedEvents })}\n\n`
              )
              client.lastEventId = newEvents[0].id
            }
          }
        } catch (error) {
          console.error(`SSE poll error for client ${clientId}:`, error)
        }
      }
    }, 2000) // 每 2 秒检查一次
  }

  private stopSsePolling(): void {
    if (this.ssePollInterval) {
      clearInterval(this.ssePollInterval)
      this.ssePollInterval = null
    }
  }

  // 处理事件中的截图路径：读取文件转 base64 字符串
  private processEventScreenshots(
    events: TriggerEvent[]
  ): Array<TriggerEvent & { screenshotBase64?: string }> {
    return events.map((event) => {
      const eventData: Record<string, unknown> = { ...event }
      if (event.content?.screenshotPath) {
        const screenshotPath = event.content.screenshotPath as string
        try {
          if (fs.existsSync(screenshotPath)) {
            const buffer = fs.readFileSync(screenshotPath)
            // Buffer 转 base64 字符串，避免 JSON.stringify 性能问题
            eventData.screenshotBase64 = buffer.toString('base64')
            // 从 content 中移除路径，避免重复
            eventData.content = { ...event.content, screenshotPath: undefined }
          }
        } catch (err) {
          console.error(`[APIServer] Failed to read screenshot: ${screenshotPath}`, err)
        }
      }
      return eventData as unknown as TriggerEvent & { screenshotBase64?: string }
    })
  }

  // Removed setupSolverRoutes as it is now handled by the plugin itself

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.app.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error)
        } else {
          console.log(`API server started on port ${this.port}`)
          resolve()
        }
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Implementation for graceful shutdown
      console.log('API server stopped')
      resolve()
    })
  }
}
