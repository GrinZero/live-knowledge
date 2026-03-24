/**
 * Screen Check Node
 * Detects screen changes using ScreenWatcher
 */

import type { EventWorkflowState } from '../types'
import { ScreenWatcher } from '../../ScreenWatcher'

export interface ScreenCheckNodeDeps {
  screenWatcher: ScreenWatcher
}

export async function screenCheckNode(
  _state: EventWorkflowState,
  deps: ScreenCheckNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[screenCheck] Checking for screen changes...')

  try {
    const changeResult = await deps.screenWatcher.detectChanges()

    if (!changeResult.hasChanged) {
      console.log('[screenCheck] No significant change detected')
      return {
        workflowState: 'idle',
        currentScreenshot: null
      }
    }

    console.log(`[screenCheck] Screen change detected (similarity: ${changeResult.similarity.toFixed(3)})`)

    return {
      workflowState: 'capturing',
      currentScreenshot: changeResult.screenshot
    }
  } catch (error) {
    console.error('[screenCheck] Error detecting screen changes:', error)
    return {
      workflowState: 'error',
      errorMessage: `Screen check failed: ${error instanceof Error ? error.message : String(error)}`,
      retryCount: 0
    }
  }
}
