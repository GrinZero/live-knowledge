import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Tag, Insight, Action, ContextWindow } from '../../renderer/src/types'
import { ContextMemory } from './ContextMemory'

export class AIEngine {
  private openai: OpenAI | null = null
  private gemini: GoogleGenerativeAI | null = null
  private provider: 'openai' | 'gemini' | 'none' = 'none'
  private modelName: string = ''
  private contextStore: ContextMemory
  private isEnabled: boolean = false

  constructor(apiKey?: string, provider?: 'openai' | 'gemini') {
    // Prefer explicit provider; otherwise infer from environment
    const geminiKey = provider === 'gemini' ? apiKey : process.env.GEMINI_API_KEY
    const openaiKey = provider === 'openai' ? apiKey : process.env.OPENAI_API_KEY

    if (geminiKey) {
      try {
        this.gemini = new GoogleGenerativeAI(geminiKey)
        this.provider = 'gemini'
        this.modelName = process.env.AI_MODEL || 'gemini-1.5-flash'
        this.isEnabled = true
      } catch (error) {
        console.warn('Failed to initialize Gemini client:', error)
      }
    }

    if (!this.isEnabled && openaiKey) {
      try {
        this.openai = new OpenAI({ apiKey: openaiKey })
        this.provider = 'openai'
        this.modelName = process.env.AI_MODEL || 'gpt-4-turbo-preview'
        this.isEnabled = true
      } catch (error) {
        console.warn('Failed to initialize OpenAI client:', error)
      }
    }

    if (!this.isEnabled) {
      console.warn('No AI provider configured, AI features will use fallback')
      this.provider = 'none'
    }
    this.contextStore = new ContextMemory()
  }

  async generateInsights(tags: Tag[], context: ContextWindow): Promise<Insight[]> {
    if (!this.isEnabled) {
      console.warn('AI features are disabled, generating fallback insights')
      return this.generateFallbackInsights(tags)
    }

    const prompt = this.buildPrompt(tags, context)

    try {
      let resultJson: unknown = null

      if (this.provider === 'gemini' && this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: this.modelName })
        const response = await model.generateContent(prompt)
        const text = await response.response.text()
        resultJson = JSON.parse(text)
      } else if (this.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: `你是一个智能知识助手，能够根据屏幕内容提取有价值的洞察和行动建议。请生成结构化 JSON。`
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        })
        resultJson = JSON.parse(response.choices[0].message.content ?? '')
      }

      if (!resultJson) return this.generateFallbackInsights(tags)

      const insights = this.parseInsights(resultJson)
      insights.forEach((i) => this.contextStore.addInsight(i))
      return insights
    } catch (error) {
      console.error('Failed to generate AI insights:', error)
      return this.generateFallbackInsights(tags)
    }
  }

  private generateFallbackInsights(tags: Tag[]): Insight[] {
    const insights: Insight[] = []

    // Generate basic insights based on tags
    tags.forEach((tag) => {
      if (tag.confidence > 0.7) {
        insights.push({
          id: `fallback-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          title: `发现${this.getTypeLabel(tag.type)}`,
          content: `检测到相关内容: ${tag.title}`,
          type: this.getInsightType(tag.type),
          priority: 'medium',
          suggestedActions: [
            { type: 'save_note', payload: { source: 'fallback' }, confirmationRequired: false }
          ],
          metadata: { tagType: tag.type, tagTitle: tag.title, confidence: tag.confidence }
        })
      }
    })

    return insights
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      meeting: '会议',
      task: '任务',
      schedule: '日程',
      problem: '问题',
      data: '数据',
      document: '文档',
      email: '邮件',
      code: '代码'
    }
    return labels[type] || type
  }

  private getInsightType(tagType: string): Insight['type'] {
    const typeMap: Record<string, Insight['type']> = {
      meeting: 'note',
      task: 'task',
      schedule: 'schedule',
      problem: 'analysis',
      data: 'analysis',
      document: 'note',
      email: 'note',
      code: 'analysis'
    }
    return typeMap[tagType] || 'note'
  }

  private buildPrompt(tags: Tag[], context: ContextWindow): string {
    const recentInsights = this.contextStore.getRecentInsights(5)

    return `
屏幕内容标签：
${JSON.stringify(tags, null, 2)}

上下文信息：
${JSON.stringify(context.recentContexts, null, 2)}

最近的洞察（避免重复）：
${JSON.stringify(recentInsights, null, 2)}

请生成结构化的洞察和建议，格式如下：
{
  "insights": [
    {
      "type": "task|schedule|note|analysis|reminder",
      "title": "洞察标题",
      "content": "详细内容",
      "priority": "low|medium|high",
      "suggestedActions": [
        {
          "type": "create_task|add_calendar|save_note|send_notification",
          "description": "建议操作描述"
        }
      ]
    }
  ]
}

要求：
1. 每个洞察都应该有实际价值
2. 优先级判断要准确
3. 建议操作要具体可行
4. 避免与最近的洞察重复
5. 考虑上下文连贯性
    `
  }

  private parseInsights(result: unknown): Insight[] {
    type AIResponseAction = {
      type?: string
      payload?: Record<string, unknown>
      confirmationRequired?: boolean
    }

    type AIResponseInsight = {
      type?: string
      title?: string
      content?: string
      priority?: string
      suggestedActions?: AIResponseAction[]
    }

    const r = result as { insights?: AIResponseInsight[] } | null
    if (!r || !Array.isArray(r.insights)) {
      return []
    }

    return r.insights.map((insight, index) => ({
      id: `insight_${Date.now()}_${index}`,
      type: this.validateInsightType(insight.type ?? 'note'),
      title: insight.title ?? '未命名洞察',
      content: insight.content ?? '',
      priority: this.validatePriority(insight.priority ?? 'medium'),
      suggestedActions: this.parseActions(insight.suggestedActions ?? []),
      metadata: {
        generatedAt: new Date().toISOString(),
        confidence: 0.8,
        source: 'ai_engine'
      }
    }))
  }

  private validateInsightType(type: string): Insight['type'] {
    const validTypes: Insight['type'][] = ['task', 'schedule', 'note', 'analysis', 'reminder']
    return validTypes.includes(type as Insight['type']) ? (type as Insight['type']) : 'note'
  }

  private validatePriority(priority: string): Insight['priority'] {
    const validPriorities: Insight['priority'][] = ['low', 'medium', 'high']
    return validPriorities.includes(priority as Insight['priority'])
      ? (priority as Insight['priority'])
      : 'medium'
  }

  private parseActions(actions: unknown[]): Action[] {
    const arr = Array.isArray(actions) ? actions : []
    return arr.map((a) => ({
      type: this.validateActionType((a as { type?: string }).type ?? 'save_note'),
      payload: (a as { payload?: Record<string, unknown> }).payload ?? {},
      confirmationRequired: (a as { confirmationRequired?: boolean }).confirmationRequired !== false
    }))
  }

  private validateActionType(type: string): Action['type'] {
    const validTypes: Action['type'][] = [
      'create_task',
      'add_calendar',
      'save_note',
      'send_notification'
    ]
    return validTypes.includes(type as Action['type']) ? (type as Action['type']) : 'save_note'
  }

  async queryContext(): Promise<ContextWindow> {
    return this.contextStore.getContextWindow()
  }

  async pushInsights(insights: Insight[]): Promise<void> {
    insights.forEach((insight) => {
      this.contextStore.addInsight(insight)
    })
  }
}
