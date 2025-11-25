import { KnowledgeItem, ContextWindow } from '../renderer/src/types'

export class ContextMemory {
  private recentKnowledge: KnowledgeItem[] = []
  private maxContextItems: number = 10
  private contextWindow: ContextWindow = {
    recentInsights: [],
    sessionStartTime: new Date().toISOString(),
    userPreferences: {}
  }

  constructor() {
    this.initializeContext()
  }

  private initializeContext(): void {
    this.contextWindow = {
      recentInsights: [],
      sessionStartTime: new Date().toISOString(),
      userPreferences: {}
    }
  }

  addKnowledgeItem(item: KnowledgeItem): void {
    this.recentKnowledge.unshift(item)
    
    // Keep only the most recent items
    if (this.recentKnowledge.length > this.maxContextItems) {
      this.recentKnowledge = this.recentKnowledge.slice(0, this.maxContextItems)
    }
  }

  addInsight(insight: any): void {
    this.contextWindow.recentInsights.unshift(insight)
    
    // Keep only the most recent insights
    if (this.contextWindow.recentInsights.length > this.maxContextItems) {
      this.contextWindow.recentInsights = this.contextWindow.recentInsights.slice(0, this.maxContextItems)
    }
  }

  getContextWindow(): ContextWindow {
    return {
      ...this.contextWindow,
      recentInsights: [...this.contextWindow.recentInsights]
    }
  }

  getRecentKnowledge(): KnowledgeItem[] {
    return [...this.recentKnowledge]
  }

  clearContext(): void {
    this.recentKnowledge = []
    this.contextWindow.recentInsights = []
    this.contextWindow.sessionStartTime = new Date().toISOString()
  }

  updateUserPreferences(preferences: Record<string, any>): void {
    this.contextWindow.userPreferences = {
      ...this.contextWindow.userPreferences,
      ...preferences
    }
  }

  getUserPreferences(): Record<string, any> {
    return { ...this.contextWindow.userPreferences }
  }

  // Find similar knowledge items based on content similarity
  findSimilarKnowledge(content: string, threshold: number = 0.3): KnowledgeItem[] {
    return this.recentKnowledge.filter(item => {
      const similarity = this.calculateSimilarity(content, item.content)
      return similarity >= threshold
    })
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const intersection = words1.filter(word => words2.includes(word))
    const union = [...new Set([...words1, ...words2])]
    
    return intersection.length / union.length
  }

  // Get context summary for AI prompts
  getContextSummary(): string {
    const recentInsights = this.contextWindow.recentInsights.slice(0, 3)
    const recentKnowledge = this.recentKnowledge.slice(0, 3)
    
    let summary = `Session started at: ${new Date(this.contextWindow.sessionStartTime).toLocaleString()}\n`
    
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