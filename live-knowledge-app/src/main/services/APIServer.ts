import express from 'express'
import cors from 'cors'
import { DatabaseService } from '../services/DatabaseService'
import { MonitoringService } from '../services/MonitoringService'
import { PresentationService } from '../services/PresentationService'

export class APIServer {
  private app: express.Application
  private databaseService: DatabaseService
  private monitoringService: MonitoringService
  private presentationService: PresentationService
  private port: number

  constructor(
    databaseService: DatabaseService,
    monitoringService: MonitoringService,
    presentationService: PresentationService,
    port: number = 3000
  ) {
    this.app = express()
    this.databaseService = databaseService
    this.monitoringService = monitoringService
    this.presentationService = presentationService
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

    // Monitoring endpoints
    this.setupMonitoringRoutes()

    // Database endpoints
    this.setupDatabaseRoutes()

    // Presentation endpoints
    this.setupPresentationRoutes()

    // Knowledge endpoints
    this.setupKnowledgeRoutes()

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
    // Get monitoring status
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

    // Start monitoring
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

    // Stop monitoring
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

    // Pause monitoring
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

    // Resume monitoring
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
    // Get user by ID
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

    // Create user
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

    // Get insights
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

    // Get knowledge items
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

    // Search knowledge
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

    // Get user stats
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
    // Show presentation
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

    // Hide presentation
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

    // Get presentation config
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

    // Update presentation config
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
    // Get knowledge item by ID
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

    // Export knowledge item
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

    // Delete knowledge item
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
