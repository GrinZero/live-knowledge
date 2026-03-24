/**
 * Analyze Context Node
 * Analyzes captured frames using AIEngine for context understanding
 */

import type { EventWorkflowState, Tag } from '../types'
import { AIEngine } from '../../AIEngine'
import { ContentAnalyzer } from '../../ContentAnalyzer'
import fs from 'fs/promises'

export interface AnalyzeContextNodeDeps {
  aiEngine: AIEngine
  contentAnalyzer: ContentAnalyzer
}

export async function analyzeContextNode(
  state: EventWorkflowState,
  deps: AnalyzeContextNodeDeps
): Promise<Partial<EventWorkflowState>> {
  console.log('[analyzeContext] Analyzing context...')

  try {
    if (state.capturedFrames.length === 0) {
      throw new Error('No captured frames to analyze')
    }

    // Prepare frames data for AI analysis
    const framesData: Array<{ imageBase64: string; text: string }> = []

    for (const frame of state.capturedFrames) {
      try {
        const imageBuffer = await fs.readFile(frame.screenshotPath)
        const imageBase64 = imageBuffer.toString('base64')

        // Also run content analyzer for OCR
        const ocrResult = await deps.contentAnalyzer.analyzeImage(imageBuffer)

        framesData.push({
          imageBase64,
          text: ocrResult.text
        })
      } catch (err) {
        console.warn(`[analyzeContext] Failed to read frame ${frame.screenshotPath}:`, err)
      }
    }

    if (framesData.length === 0) {
      throw new Error('Failed to load any frames for analysis')
    }

    // Use AI to analyze the frames
    const aiResult = await deps.aiEngine.analyzeContextFrames(framesData)

    const analyzedText = aiResult.text
    const analyzedTags: Tag[] = aiResult.tags

    console.log(`[analyzeContext] Analysis complete: "${analyzedText.slice(0, 50)}..." with ${analyzedTags.length} tags`)

    // Update captured frames with analysis results
    const updatedFrames = state.capturedFrames.map((frame, idx) => ({
      ...frame,
      text: framesData[idx]?.text ?? '',
      tags: analyzedTags
    }))

    return {
      workflowState: 'deduplicating',
      capturedFrames: updatedFrames,
      analyzedText,
      analyzedTags
    }
  } catch (error) {
    console.error('[analyzeContext] Error analyzing context:', error)
    return {
      workflowState: 'error',
      errorMessage: `Context analysis failed: ${error instanceof Error ? error.message : String(error)}`,
      retryCount: state.retryCount + 1
    }
  }
}
