/**
 * Deduplicate Node
 * Makes deduplication decision based on similarity result
 */

import type { EventWorkflowState } from '../types'
import { DeduplicationService, createContentHash } from '../DeduplicationService'

export interface DeduplicateNodeDeps {
  deduplicationService: DeduplicationService
}

export async function deduplicateNode(
  state: EventWorkflowState,
  deps: DeduplicateNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[deduplicate] Making deduplication decision...')

  try {
    if (!state.similarityResult) {
      throw new Error('No similarity result available')
    }

    const contentHash = createContentHash(state.analyzedText, state.analyzedTags)
    const decision = deps.deduplicationService.makeDecision(state.similarityResult, contentHash)

    console.log(
      `[deduplicate] Decision: ${decision.shouldSkip ? 'SKIP' : 'DISPATCH'} ` +
        `- ${decision.reason}`
    )

    // Determine workflow state based on decision
    const workflowState = decision.shouldSkip ? 'skipping' : 'dispatching'

    return {
      workflowState,
      consecutiveSkips: decision.shouldSkip
        ? deps.deduplicationService.getConsecutiveSkipCount(contentHash)
        : 0,
      lastSkipContentHash: decision.shouldSkip ? contentHash : null
    }
  } catch (error) {
    console.error('[deduplicate] Error making deduplication decision:', error)
    return {
      workflowState: 'error',
      errorMessage: `Deduplication failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
