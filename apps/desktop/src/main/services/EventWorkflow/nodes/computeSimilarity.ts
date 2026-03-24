/**
 * Compute Similarity Node
 * Computes multi-dimensional similarity between current event and history
 */

import type { EventWorkflowState } from '../types'
import { DeduplicationService } from '../DeduplicationService'

export interface ComputeSimilarityNodeDeps {
  deduplicationService: DeduplicationService
}

export async function computeSimilarityNode(
  state: EventWorkflowState,
  deps: ComputeSimilarityNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[computeSimilarity] Computing similarity...')

  try {
    if (state.capturedFrames.length === 0) {
      throw new Error('No captured frames to compare')
    }

    // Get pHash from the most recent frame
    const currentPHash = state.capturedFrames[state.capturedFrames.length - 1].pHash
    const currentTimestamp = Date.now()

    // Compute similarity (embedding will be computed later if needed)
    const similarityResult = deps.deduplicationService.computeSimilarity(
      currentPHash,
      null, // embedding - will be added when we have URL
      currentTimestamp
    )

    console.log(
      `[computeSimilarity] Composite score: ${similarityResult.compositeScore.toFixed(3)} ` +
        `(pHash: ${similarityResult.pHashSimilarity.toFixed(3)}, ` +
        `timeDecay: ${similarityResult.timeDecayFactor.toFixed(3)})`
    )

    return {
      similarityResult
    }
  } catch (error) {
    console.error('[computeSimilarity] Error computing similarity:', error)
    return {
      workflowState: 'error',
      errorMessage: `Similarity computation failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
