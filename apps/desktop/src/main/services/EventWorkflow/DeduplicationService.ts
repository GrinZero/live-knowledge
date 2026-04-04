/**
 * DeduplicationService
 * Multi-dimensional smart deduplication for event dispatch
 *
 * Computes similarity using:
 * - Visual pHash (40%)
 * - Semantic embedding (40%)
 * - Time decay (20%)
 */

import type { EventWorkflowConfig, SimilarityResult, DeduplicationDecision, Tag } from './types'
import { ContextStateGraph } from './ContextStateGraph'

export class DeduplicationService {
  private config: EventWorkflowConfig
  private contextGraph: ContextStateGraph
  private embeddingCache: Map<string, number[]> = new Map()
  private consecutiveSkipCounts: Map<string, number> = new Map()

  constructor(config: EventWorkflowConfig, contextGraph: ContextStateGraph) {
    this.config = config
    this.contextGraph = contextGraph
  }

  /**
   * Compute multi-dimensional similarity between current event and history
   */
  computeSimilarity(
    currentPHash: string,
    currentEmbedding: number[] | null,
    currentTimestamp: number
  ): SimilarityResult {
    // Find the most recent node in the graph
    const recentNodes = this.contextGraph.getRecentNodes(1)
    if (recentNodes.length === 0) {
      // First event ever - no similarity to compute
      return {
        compositeScore: 0,
        pHashSimilarity: 0,
        embeddingSimilarity: 0,
        timeDecayFactor: 1,
        shouldDispatch: true
      }
    }

    const lastNode = recentNodes[0]
    const timeDiff = currentTimestamp - lastNode.timestamp

    // 1. Compute pHash similarity
    const pHashSimilarity = this.pHashSimilarity(currentPHash, lastNode.pHash)

    // 2. Compute embedding similarity (with cache lookup)
    let embeddingSimilarity = 0
    if (currentEmbedding && lastNode.embedding) {
      embeddingSimilarity = this.cosineSimilarity(currentEmbedding, lastNode.embedding)
    } else if (currentEmbedding && !lastNode.embedding) {
      // Try to use cached embedding for last node URL
      const cachedEmbedding = this.embeddingCache.get(lastNode.url)
      if (cachedEmbedding) {
        embeddingSimilarity = this.cosineSimilarity(currentEmbedding, cachedEmbedding)
      }
    }

    // 3. Compute time decay factor
    const timeDecayFactor = this.computeTimeDecay(timeDiff)

    // 4. Compute weighted composite score
    const compositeScore =
      this.config.pHashWeight * pHashSimilarity +
      this.config.embeddingWeight * embeddingSimilarity +
      this.config.timeDecayWeight * timeDecayFactor

    const shouldDispatch = compositeScore < this.config.newEventThreshold

    return {
      compositeScore,
      pHashSimilarity,
      embeddingSimilarity,
      timeDecayFactor,
      shouldDispatch
    }
  }

  /**
   * Make deduplication decision based on similarity result
   */
  makeDecision(similarityResult: SimilarityResult, contentHash: string): DeduplicationDecision {
    const { compositeScore } = similarityResult

    // Check if this content has been skipped multiple times (forced dispatch)
    const consecutiveSkips = this.consecutiveSkipCounts.get(contentHash) ?? 0

    if (consecutiveSkips >= this.config.forcedDispatchAfterSkips) {
      // Reset counter and force dispatch
      this.consecutiveSkipCounts.set(contentHash, 0)
      return {
        shouldSkip: false,
        shouldForceDispatch: true,
        score: compositeScore,
        reason: `Forced dispatch after ${consecutiveSkips} consecutive skips`
      }
    }

    // Check thresholds
    if (compositeScore >= this.config.duplicateThreshold) {
      // Increment skip count
      const newCount = consecutiveSkips + 1
      this.consecutiveSkipCounts.set(contentHash, newCount)

      return {
        shouldSkip: true,
        shouldForceDispatch: false,
        score: compositeScore,
        reason: `Similarity score ${compositeScore.toFixed(3)} exceeds threshold ${this.config.duplicateThreshold}`
      }
    }

    if (compositeScore < this.config.newEventThreshold) {
      // Reset skip count for this content
      this.consecutiveSkipCounts.set(contentHash, 0)

      return {
        shouldSkip: false,
        shouldForceDispatch: false,
        score: compositeScore,
        reason: `Similarity score ${compositeScore.toFixed(3)} below threshold ${this.config.newEventThreshold}`
      }
    }

    // In the gray zone (0.6 - 0.85) - skip but don't increment counter
    return {
      shouldSkip: true,
      shouldForceDispatch: false,
      score: compositeScore,
      reason: `Similarity score ${compositeScore.toFixed(3)} in gray zone, conservative skip`
    }
  }

  /**
   * Cache an embedding by URL
   */
  cacheEmbedding(url: string, embedding: number[]): void {
    this.embeddingCache.set(url, embedding)
  }

  /**
   * Get cached embedding by URL
   */
  getCachedEmbedding(url: string): number[] | null {
    return this.embeddingCache.get(url) ?? null
  }

  /**
   * Get consecutive skip count for content
   */
  getConsecutiveSkipCount(contentHash: string): number {
    return this.consecutiveSkipCounts.get(contentHash) ?? 0
  }

  /**
   * Reset consecutive skip count for content
   */
  resetSkipCount(contentHash: string): void {
    this.consecutiveSkipCounts.set(contentHash, 0)
  }

  /**
   * Clear all cached data (for testing or reset)
   */
  clearCache(): void {
    this.embeddingCache.clear()
    this.consecutiveSkipCounts.clear()
  }

  /**
   * Compute pHash similarity using Hamming distance
   */
  private pHashSimilarity(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      return 0
    }

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++
      }
    }

    // Normalize: distance 0 = 1.0, distance 64 = 0.0
    return Math.max(0, 1 - distance / 64)
  }

  /**
   * Compute cosine similarity between two embedding vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2)
    if (denominator === 0) {
      return 0
    }

    return dotProduct / denominator
  }

  /**
   * Compute time decay factor based on time difference
   *
   * - Within 5 minutes: full weight (1.0)
   * - Between 5-30 minutes: half weight (0.5)
   * - Beyond 30 minutes: minimal weight (0.1)
   */
  private computeTimeDecay(timeDiffMs: number): number {
    const { timeDecayFullWeight, timeDecayHalfWeight } = this.config

    if (timeDiffMs <= timeDecayFullWeight) {
      return 1.0
    }

    if (timeDiffMs <= timeDecayHalfWeight) {
      // Linear interpolation from 1.0 to 0.5
      const ratio = (timeDiffMs - timeDecayFullWeight) / (timeDecayHalfWeight - timeDecayFullWeight)
      return 1.0 - 0.5 * ratio
    }

    // Beyond 30 minutes, drop to 0.1
    return 0.1
  }
}

/**
 * Create a simple content hash from text and tags for tracking consecutive skips
 */
export function createContentHash(text: string, tags: Tag[]): string {
  // Simple hash based on first few chars of text and tag types
  const textPrefix = text.slice(0, 50).toLowerCase().replace(/\s+/g, '')
  const tagKey = tags
    .map((t) => `${t.type}:${t.title}`)
    .sort()
    .join('|')
  return `${textPrefix}#${tagKey}`.slice(0, 100)
}
