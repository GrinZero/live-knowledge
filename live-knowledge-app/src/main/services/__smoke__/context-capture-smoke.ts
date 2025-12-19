import { MonitoringService } from '../MonitoringService'
import { ScreenWatcher } from '../ScreenWatcher'
import { ContentAnalyzer } from '../ContentAnalyzer'
import { AIEngine } from '../AIEngine'
import { DatabaseService } from '../DatabaseService'
import { PresentationService } from '../PresentationService'
import { EventEmitter } from 'events'
import { Tag, Insight } from '../../../renderer/src/types'

class MockScreenWatcher {
  private counter = 0
  private threshold = 0.85
  private regionSet = false
  async captureScreen(): Promise<Buffer> {
    this.counter++
    const buf = Buffer.from(`image_${this.counter}`)
    return buf
  }
  async detectChanges(): Promise<{ hasChanged: boolean; screenshot: Buffer; similarity: number }> {
    const shot = await this.captureScreen()
    const hasChanged = this.counter === 1 || this.counter % 3 === 0
    const similarity = hasChanged ? 0.5 : (this.regionSet ? this.threshold : 0.95)
    return { hasChanged, screenshot: shot, similarity }
  }
  async computeHash(imageBuffer: Buffer): Promise<string> {
    return imageBuffer.toString('hex')
  }
  reset(): void {
    this.counter = 0
  }
  setCaptureRegion(): void { this.regionSet = true }
  setSimilarityThreshold(threshold: number): void {
    this.threshold = Math.max(0, Math.min(1, threshold))
  }
}

class MockContentAnalyzer {
  private initialized = false
  async initialize(): Promise<void> {
    this.initialized = true
  }
  async terminate(): Promise<void> {
    this.initialized = false
  }
  async analyzeImage(image: Buffer): Promise<{ text: string; tags: Tag[] }> {
    return {
      text: `mock_text_${image.length}_${this.initialized ? 'on' : 'off'}`,
      tags: [
        {
          id: `t_${Math.random()}`,
          type: 'insight_context',
          title: 'Mock',
          content: 'C',
          metadata: {},
          timestamp: new Date().toISOString(),
          confidence: 0.8
        }
      ]
    }
  }
  async extractTextFromImage(image: Buffer): Promise<string> {
    return `mock_text_${image.length}`
  }
  async extractStructuredContent(text: string): Promise<Tag[]> {
    return text.length > 0 ? [] : []
  }
}

class MockAIEngine {
  private cfg: unknown
  updateConfig(cfg: unknown): void { this.cfg = cfg }
  async generateInsights(tags: Tag[]): Promise<Insight[]> {
    return tags.map((t) => ({
      id: `i_${Math.random()}`,
      type: 'note',
      title: `Insight:${t.title}`,
      content: typeof this.cfg === 'object' ? 'mock_cfg' : 'mock',
      priority: 'medium',
      suggestedActions: [],
      metadata: {}
    }))
  }
  async analyzeContextFrames(frames: Array<{ imageBase64: string; text?: string }>): Promise<{ text: string; tags: Tag[] }> {
    const text = frames.map((f) => f.text ?? '').join('\n')
    const tags: Tag[] = [
      {
        id: `t_${Math.random()}`,
        type: 'insight_context',
        title: 'Merged',
        content: 'MergedC',
        metadata: {},
        timestamp: new Date().toISOString(),
        confidence: 0.9
      }
    ]
    return { text, tags }
  }
}

class MockDatabase extends EventEmitter {
  async initialize(): Promise<void> { return }
  async close(): Promise<void> { return }
  async createMonitoringSession(session: unknown): Promise<void> { this.emit('session', session as Record<string, unknown>) }
  async updateMonitoringSessionStatus(): Promise<void> { return }
  async createScreenshot(): Promise<void> { return }
  async createKnowledgeItem(item: Record<string, unknown>): Promise<Record<string, unknown>> { return { id: `k_${Math.random()}`, ...item } }
  async createTag(): Promise<void> { return }
  async createInsight(): Promise<void> { return }
  async createTriggerEvent(): Promise<void> { return }
  async getKnowledgeItemsByUser(): Promise<Record<string, unknown>[]> { return [] }
  async getInsightsByItem(): Promise<Record<string, unknown>[]> { return [] }
  async getUserStatistics(): Promise<{ totalKnowledgeItems: number; totalInsights: number; totalActions: number; activeSessions: number }> {
    return { totalKnowledgeItems: 0, totalInsights: 0, totalActions: 0, activeSessions: 1 }
  }
}

class MockPresentation {
  async showInsight(): Promise<void> { return }
}

async function run() {
  const screen = new MockScreenWatcher() as unknown as ScreenWatcher
  const analyzer = new MockContentAnalyzer() as unknown as ContentAnalyzer
  const ai = new MockAIEngine() as unknown as AIEngine
  const db = new MockDatabase() as unknown as DatabaseService
  const pres = new MockPresentation() as unknown as PresentationService
  const svc = new MonitoringService(screen, analyzer, ai, db, pres)
  const session = await svc.startMonitoring({
    mode: 'full',
    triggerConfig: { debounce: 200, throttle: 500, similarityThreshold: 0.85 },
    captureInterval: 500,
    contextCapture: { durationMs: 1500, maxFrames: 3 },
    language: 'zh'
  })
  console.log('session', session.id)
  await new Promise((r) => setTimeout(r, 3500))
  await svc.stopMonitoring()
  console.log('done')
}

run().catch((e) => {
  console.error('smoke_error', e)
  process.exit(1)
})
