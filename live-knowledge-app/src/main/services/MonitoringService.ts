import { ScreenWatcher } from './ScreenWatcher'
import { ContentAnalyzer } from './ContentAnalyzer'
import { AIEngine } from './AIEngine'
import { DatabaseService } from './DatabaseService'
import { ContextMemory } from './ContextMemory'
import { PresentationService } from './PresentationService'
import { 
  MonitoringSession, 
  MonitorConfig, 
  KnowledgeItem, 
  Insight, 
  Tag,
  Rectangle,
  Screenshot,
  TriggerEvent
} from '../../renderer/src/types'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { EventEmitter } from 'events'

export class MonitoringService extends EventEmitter {
  private screenWatcher: ScreenWatcher
  private contentAnalyzer: ContentAnalyzer
  private aiEngine: AIEngine
  private database: DatabaseService
  private contextMemory: ContextMemory
  private presentationService: PresentationService
  private currentSession: MonitoringSession | null = null
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private lastTriggerTime: number = 0
  private screenshotDir: string
  private userId: string = 'default_user' // TODO: Implement proper user authentication

  constructor(
    screenWatcher: ScreenWatcher,
    contentAnalyzer: ContentAnalyzer,
    aiEngine: AIEngine,
    database: DatabaseService,
    contextMemory: ContextMemory,
    presentationService: PresentationService
  ) {
    super()
    this.screenshotDir = path.join(app.getPath('userData'), 'screenshots')
    this.screenWatcher = screenWatcher
    this.contentAnalyzer = contentAnalyzer
    this.aiEngine = aiEngine
    this.database = database
    this.contextMemory = contextMemory
    this.presentationService = presentationService
    
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure screenshot directory exists
      await fs.mkdir(this.screenshotDir, { recursive: true })
      
      // Initialize database
      await this.database.initialize()
      
      // Initialize content analyzer
      await this.contentAnalyzer.initialize()
      
      console.log('Monitoring service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize monitoring service:', error)
      throw error
    }
  }

  async startMonitoring(config: MonitorConfig): Promise<MonitoringSession> {
    if (this.isMonitoring) {
      throw new Error('Monitoring is already active')
    }

    try {
      // Create new monitoring session
      const session: MonitoringSession = {
        id: uuidv4(),
        userId: this.userId,
        startedAt: new Date().toISOString(),
        status: 'active',
        config: config
      }

      // Store session in database
      await this.database.createMonitoringSession(session)
      this.currentSession = session
      this.isMonitoring = true

      // Apply config to screen watcher
      if (config.region) {
        this.screenWatcher.setCaptureRegion(config.region)
      }
      if (config.triggerConfig && typeof config.triggerConfig.similarityThreshold === 'number') {
        this.screenWatcher.setSimilarityThreshold(config.triggerConfig.similarityThreshold)
      }
      this.screenWatcher.reset()

      // Start monitoring loop
      this.startMonitoringLoop(config)

      this.emit('statusChanged', {
        status: 'running',
        sessionId: session.id
      })

      console.log(`Monitoring started with session ${session.id}`)
      return session
    } catch (error) {
      console.error('Failed to start monitoring:', error)
      throw error
    }
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring || !this.currentSession) {
      return
    }

    try {
      // Stop monitoring loop
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval)
        this.monitoringInterval = null
      }

      // Clear all debounce timers
      this.debounceTimers.forEach(timer => clearTimeout(timer))
      this.debounceTimers.clear()

      // Update session status
      this.currentSession.status = 'completed'
      this.currentSession.endedAt = new Date().toISOString()
      
      await this.database.updateMonitoringSession(this.currentSession.id, {
        status: 'completed',
        endedAt: this.currentSession.endedAt
      })

      this.isMonitoring = false
      const sessionId = this.currentSession.id
      this.currentSession = null

      this.emit('statusChanged', {
        status: 'idle',
        sessionId: sessionId
      })

      console.log('Monitoring stopped')
    } catch (error) {
      console.error('Error stopping monitoring:', error)
      throw error
    }
  }

  private startMonitoringLoop(config: MonitorConfig): void {
    const checkInterval = (config as any).captureInterval ?? 3000 // Default 3 seconds

    this.monitoringInterval = setInterval(async () => {
      if (!this.isMonitoring || !this.currentSession) {
        return
      }

      try {
        await this.performScreenCheck(config)
      } catch (error) {
        console.error('Error during screen check:', error)
      }
    }, checkInterval)
  }

  private async performScreenCheck(config: MonitorConfig): Promise<void> {
    // Resolve trigger config with safe defaults
    const trigger = config.triggerConfig ?? { debounce: 500, throttle: 2000, similarityThreshold: 0.85 }
    const throttleMs = typeof trigger.throttle === 'number' ? trigger.throttle : 2000
    const debounceMs = typeof trigger.debounce === 'number' ? trigger.debounce : 500

    // Check throttle
    const now = Date.now()
    const timeSinceLastTrigger = now - this.lastTriggerTime
    
    if (timeSinceLastTrigger < throttleMs) {
      return
    }

    // Detect changes
    const changeResult = await this.screenWatcher.detectChanges()
    
    if (!changeResult.hasChanged) {
      return
    }

    console.log(`Screen change detected (similarity: ${(1 - changeResult.similarity).toFixed(2)})`)

    // Create debounce key based on content similarity
    const debounceKey = `screen_check_${Math.round(changeResult.similarity * 100)}`
    
    // Clear existing debounce timer for this key
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey)!)
    }

    // Set new debounce timer
    const debounceTimer = setTimeout(async () => {
      try {
        await this.processScreenChange(changeResult.screenshot, config)
        this.debounceTimers.delete(debounceKey)
      } catch (error) {
        console.error('Error processing screen change:', error)
        this.debounceTimers.delete(debounceKey)
      }
    }, debounceMs)

    this.debounceTimers.set(debounceKey, debounceTimer)
  }

  private async processScreenChange(screenshot: Buffer, config: MonitorConfig): Promise<void> {
    if (!this.currentSession) {
      return
    }

    try {
      console.log('Processing screen change...')
      
      // Save screenshot
      const screenshotPath = await this.saveScreenshot(screenshot)
      
      // Extract text from image
      const extractedText = await this.contentAnalyzer.extractTextFromImage(screenshot)
      
      if (!extractedText.trim()) {
        console.log('No text found in screenshot')
        return
      }

      console.log(`Extracted text: ${extractedText.substring(0, 100)}...`)

      // Extract structured content
      const tags = await this.contentAnalyzer.extractStructuredContent(extractedText)
      
      if (tags.length === 0) {
        console.log('No relevant content detected')
        return
      }

      console.log(`Detected ${tags.length} content tags:`, tags.map(tag => tag.type))

      // Create knowledge item
      const knowledgeItem = await this.createKnowledgeItem(tags, extractedText, screenshotPath)
      
      // Generate insights using AI
      const context = await this.buildContext()
      const insights = await this.aiEngine.generateInsights(tags, context)
      
      // Store insights and present them
      for (const insight of insights) {
        await this.createInsight(knowledgeItem.id, insight)
        
        // Emit insight event for real-time updates
        this.emit('insightGenerated', insight)
        
        // Present the insight using presentation service
        if (this.presentationService) {
          try {
            await this.presentationService.showInsight(insight)
          } catch (error) {
            console.error('Failed to present insight:', error)
          }
        }
      }

      // Create trigger event
      await this.createTriggerEvent('screen_change', {
        tags,
        insights,
        screenshotPath,
        extractedText: extractedText.substring(0, 500) // Store first 500 chars
      })

      // Update last trigger time
      this.lastTriggerTime = Date.now()

      console.log(`Successfully processed screen change with ${insights.length} insights`)
    } catch (error) {
      console.error('Error processing screen change:', error)
      throw error
    }
  }

  private async saveScreenshot(screenshot: Buffer): Promise<string> {
    const filename = `screenshot_${Date.now()}.png`
    const filepath = path.join(this.screenshotDir, filename)
    
    await fs.writeFile(filepath, screenshot)
    
    // Store screenshot record in database
    await this.database.createScreenshot({
      sessionId: this.currentSession!.id,
      imagePath: filepath,
      metadata: {
        size: screenshot.length,
        format: 'png'
      }
    })
    
    return filepath
  }

  private async createKnowledgeItem(tags: Tag[], content: string, screenshotPath: string): Promise<KnowledgeItem> {
    const primaryTag = tags.reduce((prev, current) => 
      prev.confidence > current.confidence ? prev : current
    )

    const knowledgeItem = await this.database.createKnowledgeItem({
      userId: this.userId,
      type: primaryTag.type,
      title: primaryTag.title,
      content: content,
      metadata: {
        tags: tags,
        screenshotPath: screenshotPath,
        sessionId: this.currentSession!.id
      },
      confidence: primaryTag.confidence
    })

    // Create tags
    for (const tag of tags) {
      await this.database.createTag({
        itemId: knowledgeItem.id,
        type: tag.type,
        value: tag.title,
        confidence: tag.confidence
      })
    }

    return knowledgeItem
  }

  private async createInsight(itemId: string, insight: Insight): Promise<void> {
    await this.database.createInsight({
      itemId,
      type: insight.type,
      title: insight.title,
      content: insight.content,
      priority: insight.priority,
      suggestedActions: insight.suggestedActions
    })
  }

  private async createTriggerEvent(eventType: string, content: any): Promise<void> {
    await this.database.createTriggerEvent({
      sessionId: this.currentSession!.id,
      eventType,
      content,
      confidence: content.tags?.[0]?.confidence || 0.5
    })
  }

  private async buildContext(): Promise<any> {
    // Get recent knowledge items for context
    const recentItems = await this.database.getKnowledgeItemsByUser(this.userId, 5)
    
    return {
      recentContexts: recentItems.map(item => ({
        type: item.type,
        title: item.title,
        timestamp: item.createdAt
      })),
      knowledgeItems: recentItems,
      session: {
        id: this.currentSession!.id,
        startedAt: this.currentSession!.startedAt
      }
    }
  }

  async getStatus(): Promise<{
    status: string
    startTime?: string
    lastCapture?: string
    totalCaptures: number
    totalInsights: number
    error?: string
  }> {
    if (!this.isMonitoring) {
      return {
        status: this.currentSession ? 'idle' : 'not_initialized',
        totalCaptures: 0,
        totalInsights: 0
      }
    }

    const stats = await this.getUserStatistics()
    
    return {
      status: this.isMonitoring ? 'running' : 'idle',
      startTime: this.currentSession?.startedAt,
      lastCapture: this.lastTriggerTime ? new Date(this.lastTriggerTime).toISOString() : undefined,
      totalCaptures: stats.totalKnowledgeItems,
      totalInsights: stats.totalInsights
    }
  }

  async pauseMonitoring(): Promise<void> {
    if (!this.isMonitoring || !this.currentSession) {
      throw new Error('No active monitoring session to pause')
    }

    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }

    // Update session status
    this.currentSession.status = 'paused'
    this.currentSession.pausedAt = new Date().toISOString()

    this.emit('statusChanged', {
      status: 'paused',
      sessionId: this.currentSession.id
    })

    console.log('Monitoring paused')
  }

  async resumeMonitoring(): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No monitoring session to resume')
    }

    if (this.isMonitoring) {
      return // Already running
    }

    this.isMonitoring = true
    this.currentSession.status = 'active'
    this.currentSession.resumedAt = new Date().toISOString()

    // Restart monitoring loop
    const config = this.currentSession.config
    if (config) {
      this.startMonitoringLoop(config)
    }

    this.emit('statusChanged', {
      status: 'running',
      sessionId: this.currentSession.id
    })

    console.log('Monitoring resumed')
  }

  async getRecentInsights(limit: number = 10): Promise<Insight[]> {
    const items = await this.database.getKnowledgeItemsByUser(this.userId, limit)
    const insights: Insight[] = []
    
    for (const item of items) {
      const itemInsights = await this.database.getInsightsByItem(item.id)
      insights.push(...itemInsights)
    }
    
    return insights.slice(0, limit)
  }

  async getUserStatistics(): Promise<{
    totalKnowledgeItems: number
    totalInsights: number
    totalActions: number
    activeSessions: number
  }> {
    return this.database.getUserStatistics(this.userId)
  }

  async cleanup(): Promise<void> {
    if (this.isMonitoring) {
      await this.stopMonitoring()
    }
    
    await this.contentAnalyzer.terminate()
    await this.database.close()
    
    console.log('Monitoring service cleaned up')
  }
}