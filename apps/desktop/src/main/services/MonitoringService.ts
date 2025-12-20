import { ScreenWatcher } from './ScreenWatcher'
import { ContentAnalyzer } from './ContentAnalyzer'
import { AIEngine } from './AIEngine'
import { DatabaseService } from './DatabaseService'
import { ContextWindow } from '../../renderer/src/types'
import { PresentationService } from './PresentationService'
import {
  MonitoringSession,
  MonitorConfig,
  KnowledgeItem,
  Insight,
  Tag
} from '../../renderer/src/types'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { EventEmitter } from 'events'

import { PluginManager } from './PluginManager'

export class MonitoringService extends EventEmitter {
  private screenWatcher: ScreenWatcher
  private contentAnalyzer: ContentAnalyzer
  private aiEngine: AIEngine
  private database: DatabaseService
  private presentationService: PresentationService
  private pluginManager: PluginManager
  private currentSession: MonitoringSession | null = null
  private isMonitoring: boolean = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map()
  private lastTriggerTime: number = 0
  private screenshotDir: string
  private userId: string = 'default_user' // TODO: Implement proper user authentication
  private isContextCapturing: boolean = false
  private contextWindowStartedAt: number = 0
  private contextFrames: Array<{ screenshotPath: string; text: string; tags: Tag[] }> = []
  private lastContextHash: string | null = null

  constructor(
    screenWatcher: ScreenWatcher,
    contentAnalyzer: ContentAnalyzer,
    aiEngine: AIEngine,
    database: DatabaseService,
    presentationService: PresentationService,
    pluginManager: PluginManager
  ) {
    super()
    // Use app.getPath('userData')/screenshots to persist across restarts
    // When in dev mode, this path is usually stable.
    this.screenshotDir = path.join(app.getPath('userData'), 'screenshots')
    this.screenWatcher = screenWatcher
    this.contentAnalyzer = contentAnalyzer
    this.aiEngine = aiEngine
    this.database = database
    this.presentationService = presentationService
    this.pluginManager = pluginManager

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
        config: config,
        createdAt: new Date().toISOString()
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

      // Apply config to AI Engine
      this.aiEngine.updateConfig({ language: config.language ?? 'zh' })

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
      this.debounceTimers.forEach((timer) => clearTimeout(timer))
      this.debounceTimers.clear()

      // Update session status
      this.currentSession.status = 'stopped'
      this.currentSession.endedAt = new Date().toISOString()

      await this.database.updateMonitoringSessionStatus(this.currentSession.id, 'stopped')

      this.isMonitoring = false
      const sessionId = this.currentSession.id
      this.currentSession = null

      this.emit('statusChanged', {
        status: 'idle',
        sessionId: sessionId
      })

      console.log('Monitoring stopped')
    } catch (error) {
      // Check if error is due to destroyed object, which can happen during app quit
      if (error instanceof TypeError && error.message.includes('Object has been destroyed')) {
        console.log('Monitoring stopped (window closed)')
        return
      }
      console.error('Error stopping monitoring:', error)
      throw error
    }
  }

  private startMonitoringLoop(config: MonitorConfig): void {
    const schedule = async () => {
      if (!this.isMonitoring || !this.currentSession) {
        return
      }
      try {
        await this.performScreenCheck(config)
      } catch (error) {
        console.error('Error during screen check:', error)
      } finally {
        const baseInterval =
          typeof config.captureInterval === 'number' ? config.captureInterval : 15000
        const nextInterval = this.isContextCapturing ? 5000 : baseInterval
        this.monitoringInterval = setTimeout(schedule, nextInterval) as unknown as NodeJS.Timeout
      }
    }
    void schedule()
  }

  private async performScreenCheck(config: MonitorConfig): Promise<void> {
    if (this.isContextCapturing) {
      await this.captureContextFrame(config)
      return
    }

    // Resolve trigger config with safe defaults
    const trigger = config.triggerConfig ?? {
      debounce: 500,
      throttle: 2000,
      similarityThreshold: 0.85
    }
    const throttleMs = typeof trigger.throttle === 'number' ? trigger.throttle : 2000

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

    // Start context capture window after initial change
    this.beginContextCapture(changeResult.screenshot)
  }

  private async processAggregatedContext(
    frames: Array<{ screenshotPath: string; text: string; tags: Tag[] }>
  ): Promise<void> {
    if (!this.currentSession) {
      return
    }

    try {
      console.log('Processing aggregated context...')

      if (frames.length === 0) {
        console.log('No context frames captured')
        return
      }

      const framesData = []
      for (const f of frames) {
        const buf = await fs.readFile(f.screenshotPath)
        const base64 = buf.toString('base64')
        framesData.push({ imageBase64: base64, text: f.text })
      }
      let aiResult: { text: string; tags: Tag[] } | null = null
      try {
        aiResult = await this.aiEngine.analyzeContextFrames(framesData)
      } catch {
        aiResult = null
      }
      let extractedText = ''
      let tags: Tag[] = []
      if (aiResult && (aiResult.text || (aiResult.tags && aiResult.tags.length > 0))) {
        extractedText = aiResult.text || ''
        tags = aiResult.tags || []
      } else {
        const aggregated = this.aggregateContextFrames(frames)
        extractedText = aggregated.text
        tags = aggregated.tags
      }
      const screenshotPaths = frames.map((f) => f.screenshotPath)

      if (!extractedText.trim()) {
        console.log('No text found in screenshot')
        return
      }

      console.log(`Extracted text: ${extractedText.substring(0, 100)}...`)

      if (tags.length === 0) {
        console.log('No relevant content detected')
        return
      }

      console.log(
        `Detected ${tags.length} content tags:`,
        tags.map((tag) => tag.type)
      )

      // Create knowledge item
      const knowledgeItem = await this.createKnowledgeItem(tags, extractedText, screenshotPaths)
      
      // Trigger event
      await this.pluginManager.triggerEvent('knowledge_created', { 
        item: knowledgeItem,
        tags,
        screenshotPaths 
      })

      // Generate insights using AI
      const context = await this.buildContext()
      // Gather extra context from plugins
      const pluginContext = await this.pluginManager.getContexts()
      // Get prompt additions from plugins
      const pluginPromptAdditions = await this.pluginManager.getPromptAdditions(context.session)

      const insights = await this.aiEngine.generateInsights(
        tags,
        context,
        pluginContext,
        pluginPromptAdditions,
        extractedText
      )

      // Store insights and present them
      for (const insight of insights) {
        // Determine primary screenshot
        let primaryScreenshot: string
        const index = (insight.metadata.relatedImageIndex as number) ?? 0

        if (Array.isArray(screenshotPaths)) {
          primaryScreenshot = screenshotPaths[index] || screenshotPaths[0]
        } else {
          primaryScreenshot = screenshotPaths
        }

        // Inject screenshot path into metadata
        insight.metadata = {
          ...insight.metadata,
          screenshotPath: primaryScreenshot
        }

        // Execute plugin actions for each insight
        if (insight.suggestedActions) {
          for (const action of insight.suggestedActions) {
            // Inject screenshot path into action payload
            if (!action.payload) {
              action.payload = {}
            }
            action.payload.screenshotPath = primaryScreenshot

            // Try to execute via plugins first
            await this.pluginManager.executeAction(action)
          }
        }

        await this.createInsight(knowledgeItem.id, insight)

        // Emit insight event for real-time updates (attach screenshot path for renderer)
        this.emit('insightGenerated', { ...insight, screenshotPath: primaryScreenshot })
        
        // Trigger plugin event
        await this.pluginManager.triggerEvent('insight_generated', {
          insight: { ...insight, screenshotPath: primaryScreenshot },
          knowledgeItem
        })

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
      await this.createTriggerEvent('screen_context', {
        tags,
        insights,
        screenshotPath: screenshotPaths,
        extractedText: extractedText.substring(0, 500) // Store first 500 chars
      })

      // Update last trigger time
      this.lastTriggerTime = Date.now()

      console.log(`Successfully processed aggregated context with ${insights.length} insights`)
    } catch (error) {
      console.error('Error processing aggregated context:', error)
      throw error
    }
  }

  private beginContextCapture(initialScreenshot: Buffer): void {
    this.isContextCapturing = true
    this.contextWindowStartedAt = Date.now()
    this.contextFrames = []
    // Push first frame
    void this.pushFrame(initialScreenshot)
    // End window will be decided by performScreenCheck calls
  }

  private async captureContextFrame(config: MonitorConfig): Promise<void> {
    const cc = config.contextCapture ?? { durationMs: 6000, maxFrames: 5 }
    const now = Date.now()
    const elapsed = now - this.contextWindowStartedAt

    // Capture additional frame unconditionally (no similarity gating)
    try {
      const frame = await this.screenWatcher.captureScreen()
      await this.pushFrame(frame)
    } catch (error) {
      console.error('Failed to capture context frame:', error)
    }

    const reachedDuration = elapsed >= cc.durationMs
    const reachedMax = this.contextFrames.length >= cc.maxFrames
    if (reachedDuration || reachedMax) {
      const framesSnapshot = [...this.contextFrames]
      this.isContextCapturing = false
      // Process aggregated frames
      await this.processAggregatedContext(framesSnapshot)
      this.contextFrames = []
    }
  }

  private async pushFrame(screenshot: Buffer): Promise<void> {
    try {
      const hash = await this.screenWatcher.computeHash(screenshot)
      if (this.lastContextHash && hash === this.lastContextHash) {
        return
      }
      this.lastContextHash = hash
    } catch {
      void 0
    }
    const screenshotPath = await this.saveScreenshot(screenshot)
    const { text, tags } = await this.contentAnalyzer.analyzeImage(screenshot)
    this.contextFrames.push({ screenshotPath, text, tags })
  }

  private aggregateContextFrames(
    frames: Array<{ screenshotPath: string; text: string; tags: Tag[] }>
  ): {
    text: string
    tags: Tag[]
    primaryScreenshotPath: string
  } {
    const primaryScreenshotPath = frames[0]?.screenshotPath ?? ''
    // Merge text with line-level dedupe
    const linesSet = new Set<string>()
    for (const f of frames) {
      f.text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .forEach((l) => linesSet.add(l))
    }
    const text = Array.from(linesSet).join('\n')

    // Merge tags by type+title key, keep highest confidence, merge metadata
    const tagMap = new Map<string, Tag>()
    for (const f of frames) {
      for (const t of f.tags) {
        const key = `${t.type}:${t.title}`.toLowerCase()
        if (!tagMap.has(key)) {
          tagMap.set(key, { ...t })
        } else {
          const existing = tagMap.get(key)!
          const merged: Tag = {
            ...existing,
            confidence: Math.max(existing.confidence, t.confidence),
            metadata: this.mergeMetadata(existing.metadata, t.metadata)
          }
          tagMap.set(key, merged)
        }
      }
    }

    const tags = Array.from(tagMap.values())
    return { text, tags, primaryScreenshotPath }
  }

  private mergeMetadata(
    a: Record<string, unknown>,
    b: Record<string, unknown>
  ): Record<string, unknown> {
    const out: Record<string, unknown> = { ...a }
    for (const [k, v] of Object.entries(b)) {
      const ov = out[k]
      if (Array.isArray(ov) && Array.isArray(v)) {
        const set = new Set([...ov, ...v])
        out[k] = Array.from(set)
      } else if (typeof ov === 'object' && ov && typeof v === 'object' && v) {
        out[k] = { ...(ov as Record<string, unknown>), ...(v as Record<string, unknown>) }
      } else {
        out[k] = v
      }
    }
    return out
  }

  private async saveScreenshot(screenshot: Buffer): Promise<string> {
    const filename = `screenshot_${Date.now()}.png`
    const filepath = path.join(this.screenshotDir, filename)

    try {
      // Ensure directory exists
      await fs.mkdir(this.screenshotDir, { recursive: true })
      await fs.writeFile(filepath, screenshot)
      console.log(`Screenshot saved to: ${filepath}`)
    } catch (error) {
      console.error('Failed to save screenshot file:', error)
      throw error
    }

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

  private async createKnowledgeItem(
    tags: Tag[],
    content: string,
    screenshotPath: string | string[]
  ): Promise<KnowledgeItem> {
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
        title: tag.title,
        content: '',
        metadata: {},
        confidence: tag.confidence
      })
    }

    return knowledgeItem
  }

  private async createInsight(itemId: string, insight: Insight): Promise<void> {
    await this.database.createInsight(itemId, {
      type: insight.type,
      title: insight.title,
      content: insight.content,
      priority: insight.priority,
      suggestedActions: insight.suggestedActions,
      metadata: insight.metadata
    })
  }

  private async createTriggerEvent(
    eventType: string,
    content: Record<string, unknown>
  ): Promise<void> {
    const confidence =
      Array.isArray((content as { tags?: Array<{ confidence?: number }> }).tags) &&
      typeof (content as { tags?: Array<{ confidence?: number }> }).tags![0]?.confidence ===
        'number'
        ? ((content as { tags?: Array<{ confidence?: number }> }).tags![0]!.confidence as number)
        : 0.5

    await this.database.createTriggerEvent({
      sessionId: this.currentSession!.id,
      eventType,
      content,
      confidence
    })
  }

  private async buildContext(): Promise<ContextWindow> {
    // Get recent knowledge items for context
    const recentItems = await this.database.getKnowledgeItemsByUser(this.userId, 5)

    return {
      recentContexts: recentItems.map((item) => `${item.type}:${item.title}:${item.createdAt}`),
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
    // paused timestamp can be tracked elsewhere if needed

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
    // resumed timestamp can be tracked elsewhere if needed

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
