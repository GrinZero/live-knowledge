/**
 * Trigger Event Node
 * Triggers the event via PluginManager
 */

import type { EventWorkflowState } from '../types'
import { PluginManager } from '../../PluginManager'
import type { KnowledgeItem } from '../../../../renderer/src/types'

export interface TriggerEventNodeDeps {
  pluginManager: PluginManager
  createKnowledgeItem: (
    tags: EventWorkflowState['analyzedTags'],
    content: string,
    screenshotPaths: string[]
  ) => Promise<KnowledgeItem>
}

export async function triggerEventNode(
  state: EventWorkflowState,
  deps: TriggerEventNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[triggerEvent] Triggering event...')

  try {
    if (!state.analyzedText || state.analyzedTags.length === 0) {
      console.log('[triggerEvent] No significant content to dispatch')
      return {
        workflowState: 'idle',
        eventPayload: null
      }
    }

    const screenshotPaths = state.capturedFrames.map((f) => f.screenshotPath)

    // Create knowledge item
    const knowledgeItem = await deps.createKnowledgeItem(
      state.analyzedTags,
      state.analyzedText,
      screenshotPaths
    )

    // Build event payload
    const eventPayload = {
      item: knowledgeItem,
      tags: state.analyzedTags,
      screenshotPaths,
      normalizedMarkdown: [] as string[]
    }

    // Trigger the event via PluginManager
    await deps.pluginManager.triggerEvent('knowledge.created', eventPayload, 'event-workflow')

    console.log(`[triggerEvent] Event dispatched with ${state.analyzedTags.length} tags`)

    return {
      workflowState: 'idle',
      eventPayload
    }
  } catch (error) {
    console.error('[triggerEvent] Error triggering event:', error)
    return {
      workflowState: 'error',
      errorMessage: `Event trigger failed: ${error instanceof Error ? error.message : String(error)}`,
      retryCount: state.retryCount + 1
    }
  }
}
