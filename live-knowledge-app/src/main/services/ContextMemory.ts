import { KnowledgeItem, ContextWindow, Insight } from '../../renderer/src/types'

export class ContextMemory {
  private recentKnowledge: KnowledgeItem[] = []
  private recentInsights: Insight[] = []
  private maxContextItems: number = 10
  private sessionStartedAt: string = new Date().toISOString()

  constructor() {
    this.initializeContext()
  }

  private initializeContext(): void {
    this.recentKnowledge = []
    this.recentInsights = []
    this.sessionStartedAt = new Date().toISOString()
  }

  addKnowledgeItem(item: KnowledgeItem): void {
    this.recentKnowledge.unshift(item)

    // Keep only the most recent items
    if (this.recentKnowledge.length > this.maxContextItems) {
      this.recentKnowledge = this.recentKnowledge.slice(0, this.maxContextItems)
    }
  }

  addInsight(insight: Insight): void {
    this.recentInsights.unshift(insight)
    if (this.recentInsights.length > this.maxContextItems) {
      this.recentInsights = this.recentInsights.slice(0, this.maxContextItems)
    }
  }

  getRecentInsights(limit: number = 5): Insight[] {
    return this.recentInsights.slice(0, limit)
  }

  getContextWindow(): ContextWindow {
    return {
      recentContexts: this.recentInsights.map((i) => i.title).slice(0, 5),
      knowledgeItems: [...this.recentKnowledge],
      session: { id: 'local', startedAt: this.sessionStartedAt }
    }
  }

  getRecentKnowledge(): KnowledgeItem[] {
    return [...this.recentKnowledge]
  }

  clearContext(): void {
    this.recentKnowledge = []
    this.recentInsights = []
    this.sessionStartedAt = new Date().toISOString()
  }

  updateUserPreferences(): void {
    // no-op placeholder for future user preferences
  }

  getUserPreferences(): Record<string, unknown> {
    return {}
  }

  // Find similar knowledge items based on content similarity
  findSimilarKnowledge(content: string, threshold: number = 0.3): KnowledgeItem[] {
    return this.recentKnowledge.filter((item) => {
      const similarity = this.calculateSimilarity(content, item.content)
      return similarity >= threshold
    })
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)

    const intersection = words1.filter((word) => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]

    return intersection.length / union.length
  }

  // Get context summary for AI prompts
  getContextSummary(): string {
    const recentInsights = this.recentInsights.slice(0, 3)
    const recentKnowledge = this.recentKnowledge.slice(0, 3)

    let summary = `Session started at: ${new Date(this.sessionStartedAt).toLocaleString()}\n`

    if (recentInsights.length > 0) {
      summary += `Recent insights:\n`
      recentInsights.forEach((insight, index) => {
        summary += `${index + 1}. ${insight.title || insight.content?.substring(0, 50)}...\n`
      })
    }

    if (recentKnowledge.length > 0) {
      summary += `Recent knowledge items:\n`
      recentKnowledge.forEach((item, index) => {
        summary += `${index + 1}. ${item.title || item.content?.substring(0, 50)}...\n`
      })
    }

    return summary
  }
}
