/**
 * Event Workflow Types
 * Type definitions for the LangGraph-based event workflow orchestration
 */

import type { Tag } from '../../../renderer/src/types'

export type { Tag }

export type WorkflowState =
  | 'idle'
  | 'capturing'
  | 'analyzing'
  | 'deduplicating'
  | 'dispatching'
  | 'skipping'
  | 'error'

export interface EventNodeData {
  id: string
  timestamp: number
  pHash: string
  embedding: number[] | null
  url: string
  summary: string
  text: string
  tags: Tag[]
}

export interface SimilarityResult {
  compositeScore: number
  pHashSimilarity: number
  embeddingSimilarity: number
  timeDecayFactor: number
  shouldDispatch: boolean
  skipReason?: string
}

export interface DeduplicationDecision {
  shouldSkip: boolean
  shouldForceDispatch: boolean
  score: number
  reason: string
}

export interface EventWorkflowState {
  // Current workflow state
  workflowState: WorkflowState

  // Screen capture data
  currentScreenshot: Buffer | null
  capturedFrames: Array<{
    screenshotPath: string
    text: string
    tags: Tag[]
    pHash: string
  }>

  // Analysis results
  analyzedText: string
  analyzedTags: Tag[]

  // Deduplication
  similarityResult: SimilarityResult | null
  consecutiveSkips: number
  lastSkipContentHash: string | null

  // Event data for dispatch
  eventPayload: {
    item: unknown
    tags: Tag[]
    screenshotPaths: string[]
    normalizedMarkdown: string[]
  } | null

  // Error handling
  errorMessage: string | null
  retryCount: number

  // Checkpoint
  checkpointTimestamp: number
}

export interface EventWorkflowConfig {
  // Feature flag
  enabled: boolean

  // Deduplication thresholds
  duplicateThreshold: number // > 0.85 = duplicate
  newEventThreshold: number // < 0.6 = new event

  // Weights for similarity computation
  pHashWeight: number // 0.4
  embeddingWeight: number // 0.4
  timeDecayWeight: number // 0.2

  // Time decay settings (in milliseconds)
  timeDecayFullWeight: number // 5 minutes
  timeDecayHalfWeight: number // 30 minutes

  // Node limits
  maxGraphNodes: number // 1000
  evictionBatchSize: number // 100

  // Retry settings
  maxRetries: number // 3
  retryBaseDelayMs: number // 1000

  // Forced dispatch after N consecutive skips
  forcedDispatchAfterSkips: number // 5
}

export const DEFAULT_WORKFLOW_CONFIG: EventWorkflowConfig = {
  enabled: process.env.ENABLE_EVENT_WORKFLOW === 'true',
  duplicateThreshold: 0.85,
  newEventThreshold: 0.6,
  pHashWeight: 0.4,
  embeddingWeight: 0.4,
  timeDecayWeight: 0.2,
  timeDecayFullWeight: 5 * 60 * 1000, // 5 minutes
  timeDecayHalfWeight: 30 * 60 * 1000, // 30 minutes
  maxGraphNodes: 1000,
  evictionBatchSize: 100,
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  forcedDispatchAfterSkips: 5
}
