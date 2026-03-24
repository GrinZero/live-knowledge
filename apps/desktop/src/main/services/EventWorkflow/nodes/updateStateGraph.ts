/**
 * Update State Graph Node
 * Updates the ContextStateGraph with the current event
 */

import type { EventWorkflowState } from '../types'
import { ContextStateGraph } from '../ContextStateGraph'

export interface UpdateStateGraphNodeDeps {
  contextGraph: ContextStateGraph
}

export async function updateStateGraphNode(
  state: EventWorkflowState,
  deps: UpdateStateGraphNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[updateStateGraph] Updating state graph...')

  try {
    if (state.capturedFrames.length === 0) {
      console.log('[updateStateGraph] No frames to add to graph')
      return {}
    }

    const lastFrame = state.capturedFrames[state.capturedFrames.length - 1]

    // Add node to graph
    deps.contextGraph.addNode(
      lastFrame.pHash,
      null, // embedding - will be added later when we compute it
      '', // url - not available in current flow
      state.analyzedText.slice(0, 200), // summary (first 200 chars)
      state.analyzedText,
      state.analyzedTags
    )

    console.log(
      `[updateStateGraph] Node added. Graph now has ${deps.contextGraph.getNodeCount()} nodes`
    )

    return {
      checkpointTimestamp: Date.now()
    }
  } catch (error) {
    console.error('[updateStateGraph] Error updating state graph:', error)
    // Don't fail the workflow for graph update errors
    return {}
  }
}
