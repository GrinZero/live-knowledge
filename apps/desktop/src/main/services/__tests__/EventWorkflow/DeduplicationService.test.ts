/**
 * DeduplicationService Tests
 */

import { DeduplicationService, createContentHash } from '../../EventWorkflow/DeduplicationService'
import { ContextStateGraph } from '../../EventWorkflow/ContextStateGraph'
import type { EventWorkflowConfig, Tag } from '../EventWorkflow/types'

describe('DeduplicationService', () => {
  let config: EventWorkflowConfig
  let graph: ContextStateGraph
  let deduplicationService: DeduplicationService

  const createTag = (type: string, title: string): Tag => ({
    id: `tag-${Math.random().toString(36).slice(2)}`,
    type: type as Tag['type'],
    title,
    content: 'Test content',
    metadata: {},
    timestamp: new Date().toISOString(),
    confidence: 0.9
  })

  beforeEach(() => {
    config = {
      enabled: true,
      duplicateThreshold: 0.85,
      newEventThreshold: 0.6,
      pHashWeight: 0.4,
      embeddingWeight: 0.4,
      timeDecayWeight: 0.2,
      timeDecayFullWeight: 5 * 60 * 1000,
      timeDecayHalfWeight: 30 * 60 * 1000,
      maxGraphNodes: 1000,
      evictionBatchSize: 100,
      maxRetries: 3,
      retryBaseDelayMs: 1000,
      forcedDispatchAfterSkips: 5
    }

    graph = new ContextStateGraph(100, 10)
    deduplicationService = new DeduplicationService(config, graph)
  })

  afterEach(() => {
    deduplicationService.clearCache()
    graph.clear()
  })

  describe('computeSimilarity', () => {
    it('should return 0 score for first event', () => {
      const result = deduplicationService.computeSimilarity('00010001', null, Date.now())

      expect(result.compositeScore).toBe(0)
      expect(result.shouldDispatch).toBe(true)
    })

    it('should compute higher similarity for similar pHash', () => {
      // Add first node
      graph.addNode('0'.repeat(64), null, 'url', 'summary', 'text', [])

      const result = deduplicationService.computeSimilarity(
        '0'.repeat(64), // Same hash
        null,
        Date.now()
      )

      expect(result.pHashSimilarity).toBe(1.0)
    })

    it('should compute lower similarity for different pHash', () => {
      // 64-bit pHash length
      graph.addNode('0'.repeat(64), null, 'url', 'summary', 'text', [])

      const result = deduplicationService.computeSimilarity(
        '1'.repeat(64), // Different hash
        null,
        Date.now()
      )

      expect(result.pHashSimilarity).toBe(0)
    })
  })

  describe('makeDecision', () => {
    it('should skip when score exceeds duplicate threshold', () => {
      const similarityResult = {
        compositeScore: 0.9,
        pHashSimilarity: 0.9,
        embeddingSimilarity: 0.9,
        timeDecayFactor: 1.0,
        shouldDispatch: false
      }

      const decision = deduplicationService.makeDecision(similarityResult, 'content-hash')

      expect(decision.shouldSkip).toBe(true)
    })

    it('should dispatch when score below new event threshold', () => {
      const similarityResult = {
        compositeScore: 0.5,
        pHashSimilarity: 0.5,
        embeddingSimilarity: 0.5,
        timeDecayFactor: 0.5,
        shouldDispatch: true
      }

      const decision = deduplicationService.makeDecision(similarityResult, 'content-hash')

      expect(decision.shouldSkip).toBe(false)
    })

    it('should force dispatch after consecutive skips', () => {
      const contentHash = 'repeated-content'

      // Simulate 5 consecutive skips
      for (let i = 0; i < 5; i++) {
        deduplicationService.makeDecision(
          {
            compositeScore: 0.9,
            pHashSimilarity: 0.9,
            embeddingSimilarity: 0.9,
            timeDecayFactor: 1.0,
            shouldDispatch: false
          },
          contentHash
        )
      }

      const decision = deduplicationService.makeDecision(
        {
          compositeScore: 0.9,
          pHashSimilarity: 0.9,
          embeddingSimilarity: 0.9,
          timeDecayFactor: 1.0,
          shouldDispatch: false
        },
        contentHash
      )

      expect(decision.shouldForceDispatch).toBe(true)
      expect(decision.shouldSkip).toBe(false)
    })
  })

  describe('createContentHash', () => {
    it('should create consistent hash for same content', () => {
      const tags = [createTag('meeting', 'Meeting Title')]

      const hash1 = createContentHash('Hello world', tags)
      const hash2 = createContentHash('Hello world', tags)

      expect(hash1).toBe(hash2)
    })

    it('should create different hash for different content', () => {
      const tags1 = [createTag('meeting', 'Meeting Title')]
      const tags2 = [createTag('task', 'Task Title')]

      const hash1 = createContentHash('Hello world', tags1)
      const hash2 = createContentHash('Different text', tags2)

      expect(hash1).not.toBe(hash2)
    })
  })
})
