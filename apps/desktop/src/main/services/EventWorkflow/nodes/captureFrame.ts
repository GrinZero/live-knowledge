/**
 * Capture Frame Node
 * Captures current frame and computes pHash
 */

import type { EventWorkflowState } from '../types'
import { ScreenWatcher } from '../../ScreenWatcher'
import { v4 as uuidv4 } from 'uuid'

export interface CaptureFrameNodeDeps {
  screenWatcher: ScreenWatcher
  screenshotDir: string
}

export async function captureFrameNode(
  state: EventWorkflowState,
  deps: CaptureFrameNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[captureFrame] Capturing frame...')

  try {
    const screenshot = state.currentScreenshot
    if (!screenshot) {
      throw new Error('No current screenshot available')
    }

    // Compute pHash
    const pHash = await deps.screenWatcher.computeHash(screenshot)

    // Save screenshot
    const filename = `screenshot_${Date.now()}_${uuidv4().slice(0, 8)}.png`
    const screenshotPath = `${deps.screenshotDir}/${filename}`

    console.log(`[captureFrame] Frame captured with pHash: ${pHash.slice(0, 16)}...`)

    return {
      capturedFrames: [
        ...state.capturedFrames,
        {
          screenshotPath,
          text: '', // Will be filled by ContentAnalyzer
          tags: [],
          pHash
        }
      ]
    }
  } catch (error) {
    console.error('[captureFrame] Error capturing frame:', error)
    return {
      workflowState: 'error',
      errorMessage: `Frame capture failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}
