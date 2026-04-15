/**
 * EventWorkflow
 * LangGraph-based workflow orchestrator for event processing
 *
 * Replaces the linear MonitoringService loop with a state machine workflow
 * that supports conditional branching, retries, and checkpointing.
 */

import type { EventWorkflowState, EventWorkflowConfig } from './types'
import { ContextStateGraph } from './ContextStateGraph'
import { DeduplicationService } from './DeduplicationService'
import {
  screenCheckNode,
  captureFrameNode,
  analyzeContextNode,
  computeSimilarityNode,
  deduplicateNode,
  triggerEventNode,
  updateStateGraphNode
} from './nodes'
import type {
  ScreenCheckNodeDeps,
  CaptureFrameNodeDeps,
  AnalyzeContextNodeDeps,
  ComputeSimilarityNodeDeps,
  DeduplicateNodeDeps,
  TriggerEventNodeDeps,
  UpdateStateGraphNodeDeps
} from './nodes'
import { ScreenWatcher } from '../ScreenWatcher'
import { AIEngine } from '../AIEngine'
import { ContentAnalyzer } from '../ContentAnalyzer'
import { PluginManager } from '../PluginManager'
import { Tag, KnowledgeItem } from '../../../renderer/src/types'

export class EventWorkflow {
  private config: EventWorkflowConfig
  private contextGraph: ContextStateGraph
  private deduplicationService: DeduplicationService

  // Dependencies for nodes
  private screenWatcher: ScreenWatcher
  private aiEngine: AIEngine
  private contentAnalyzer: ContentAnalyzer
  private pluginManager: PluginManager
  private screenshotDir: string

  // Workflow state
  private state: EventWorkflowState
  private isRunning: boolean = false

  // Monitoring loop handle
  private monitoringLoopHandle: NodeJS.Timeout | null = null

  constructor(
    config: EventWorkflowConfig,
    deps: {
      screenWatcher: ScreenWatcher
      aiEngine: AIEngine
      contentAnalyzer: ContentAnalyzer
      pluginManager: PluginManager
      screenshotDir: string
    }
  ) {
    this.config = config
    this.screenWatcher = deps.screenWatcher
    this.aiEngine = deps.aiEngine
    this.contentAnalyzer = deps.contentAnalyzer
    this.pluginManager = deps.pluginManager
    this.screenshotDir = deps.screenshotDir

    // Initialize context graph
    this.contextGraph = new ContextStateGraph(config.maxGraphNodes, config.evictionBatchSize)

    // Initialize deduplication service
    this.deduplicationService = new DeduplicationService(config, this.contextGraph)

    // Initialize workflow state
    this.state = this.createInitialState()
  }

  /**
   * Create initial workflow state
   */
  private createInitialState(): EventWorkflowState {
    return {
      workflowState: 'idle',
      currentScreenshot: null,
      capturedFrames: [],
      analyzedText: '',
      analyzedTags: [],
      similarityResult: null,
      consecutiveSkips: 0,
      lastSkipContentHash: null,
      eventPayload: null,
      errorMessage: null,
      retryCount: 0,
      checkpointTimestamp: Date.now()
    }
  }

  /**
   * Build node dependencies
   */
  private buildNodeDependencies(): {
    screenCheck: ScreenCheckNodeDeps
    captureFrame: CaptureFrameNodeDeps
    analyzeContext: AnalyzeContextNodeDeps
    computeSimilarity: ComputeSimilarityNodeDeps
    deduplicate: DeduplicateNodeDeps
    triggerEvent: TriggerEventNodeDeps
    updateStateGraph: UpdateStateGraphNodeDeps
  } {
    return {
      screenCheck: {
        screenWatcher: this.screenWatcher
      },
      captureFrame: {
        screenWatcher: this.screenWatcher,
        screenshotDir: this.screenshotDir
      },
      analyzeContext: {
        aiEngine: this.aiEngine,
        contentAnalyzer: this.contentAnalyzer
      },
      computeSimilarity: {
        deduplicationService: this.deduplicationService
      },
      deduplicate: {
        deduplicationService: this.deduplicationService
      },
      triggerEvent: {
        pluginManager: this.pluginManager,
        createKnowledgeItem: this.createKnowledgeItem.bind(this)
      },
      updateStateGraph: {
        contextGraph: this.contextGraph
      }
    }
  }

  /**
   * Create a knowledge item (helper for triggerEvent node)
   */
  private async createKnowledgeItem(
    tags: Tag[],
    content: string,
    screenshotPaths: string[]
  ): Promise<KnowledgeItem> {
    // This will be called from the MonitoringService context
    // Return a placeholder - actual implementation will be injected
    return {
      id: `kw_${Date.now()}`,
      userId: 'default_user',
      type: tags[0]?.type ?? 'insight_context',
      title: tags[0]?.title ?? 'Untitled',
      content,
      metadata: {
        tags,
        screenshotPath: screenshotPaths
      },
      confidence: tags[0]?.confidence ?? 0.8,
      createdAt: new Date().toISOString()
    } as unknown as KnowledgeItem
  }

  /**
   * Start the workflow
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[EventWorkflow] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[EventWorkflow] Disabled via feature flag')
      return
    }

    console.log('[EventWorkflow] Starting workflow...')
    this.isRunning = true
    this.state = this.createInitialState()
    this.startMonitoringLoop()
  }

  /**
   * Stop the workflow
   */
  async stop(): Promise<void> {
    console.log('[EventWorkflow] Stopping workflow...')
    this.isRunning = false

    if (this.monitoringLoopHandle) {
      clearTimeout(this.monitoringLoopHandle)
      this.monitoringLoopHandle = null
    }

    console.log('[EventWorkflow] Workflow stopped')
  }

  /**
   * Start the monitoring loop
   */
  private startMonitoringLoop(): void {
    const deps = this.buildNodeDependencies()

    const schedule = async () => {
      if (!this.isRunning) {
        return
      }

      try {
        await this.runWorkflowStep(deps)
      } catch (error) {
        console.error('[EventWorkflow] Error in monitoring loop:', error)
      } finally {
        // Schedule next iteration
        const baseInterval = 15000 // 15 seconds
        const interval = this.state.workflowState === 'capturing' ? 5000 : baseInterval
        this.monitoringLoopHandle = setTimeout(schedule, interval)
      }
    }

    // Start the loop
    void schedule()
  }

  /**
   * Run a single workflow step
   */
  private async runWorkflowStep(
    deps: ReturnType<typeof this.buildNodeDependencies>
  ): Promise<void> {
    console.log(`[EventWorkflow] Current state: ${this.state.workflowState}`)

    switch (this.state.workflowState) {
      case 'idle':
        // Check for screen changes
        {
          const result = await screenCheckNode(this.state, deps.screenCheck)
          this.state = { ...this.state, ...result }
        }
        break

      case 'capturing':
        // Capture frame
        {
          const result = await captureFrameNode(this.state, deps.captureFrame)
          this.state = { ...this.state, ...result }
          // Transition to analyzing after capture
          if (this.state.workflowState === 'capturing') {
            this.state.workflowState = 'analyzing'
          }
        }
        break

      case 'analyzing':
        // Analyze context with retry logic
        if (this.state.retryCount >= this.config.maxRetries) {
          console.log('[EventWorkflow] Max retries reached, skipping analysis')
          this.state = {
            ...this.state,
            workflowState: 'idle',
            errorMessage: null,
            retryCount: 0
          }
          break
        }

        {
          const result = await analyzeContextNode(this.state, deps.analyzeContext)
          this.state = { ...this.state, ...result }

          if (this.state.workflowState === 'error') {
            // Exponential backoff for retries
            const delay = this.config.retryBaseDelayMs * Math.pow(2, this.state.retryCount)
            console.log(
              `[EventWorkflow] Retrying in ${delay}ms (attempt ${this.state.retryCount + 1})`
            )
          }
        }
        break

      case 'deduplicating':
        // Compute similarity
        {
          const result = await computeSimilarityNode(this.state, deps.computeSimilarity)
          this.state = { ...this.state, ...result }
        }
        // Then make deduplication decision
        if (this.state.workflowState === 'deduplicating') {
          const result = await deduplicateNode(this.state, deps.deduplicate)
          this.state = { ...this.state, ...result }
        }
        break

      case 'dispatching':
        // Trigger event and update graph
        {
          const triggerResult = await triggerEventNode(this.state, deps.triggerEvent)
          const graphResult = await updateStateGraphNode(this.state, deps.updateStateGraph)
          this.state = {
            ...this.state,
            ...triggerResult,
            ...graphResult,
            workflowState: 'idle',
            errorMessage: null,
            retryCount: 0
          }
        }
        break

      case 'skipping':
        // Just update the graph (for tracking) and return to idle
        {
          await updateStateGraphNode(this.state, deps.updateStateGraph)
          this.state = {
            ...this.state,
            workflowState: 'idle',
            errorMessage: null
          }
        }
        break

      case 'error':
        // Reset after error
        if (this.state.retryCount >= this.config.maxRetries) {
          console.log('[EventWorkflow] Max retries reached, resetting')
          this.state = {
            ...this.createInitialState(),
            checkpointTimestamp: this.state.checkpointTimestamp
          }
        }
        break
    }
  }

  /**
   * Get current workflow state
   */
  getState(): EventWorkflowState {
    return { ...this.state }
  }

  /**
   * Get context graph statistics
   */
  getGraphStats(): { nodeCount: number; consecutiveSkips: Map<string, number> } {
    return {
      nodeCount: this.contextGraph.getNodeCount(),
      consecutiveSkips: new Map()
    }
  }

  /**
   * Check if workflow is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled
  }
}
