import OpenAI from 'openai'
import { Tag, Insight, Action, ContextWindow } from '../../renderer/src/types'
import { ContextMemory } from './ContextMemory'

export class AIEngine {
  private openai: OpenAI | null = null
  private contextStore: ContextMemory
  private isEnabled: boolean = false

  constructor(apiKey?: string) {
    if (apiKey) {
      try {
        this.openai = new OpenAI({
          apiKey: apiKey
        })
        this.isEnabled = true
      } catch (error) {
        console.warn('Failed to initialize OpenAI client:', error)
        this.isEnabled = false
      }
    } else {
      console.warn('OpenAI API key not provided, AI features will be disabled')
      this.isEnabled = false
    }
    this.contextStore = new ContextMemory()
  }

  async generateInsights(tags: Tag[], context: ContextWindow): Promise<Insight[]> {
    // Return empty insights if AI is not enabled
    if (!this.isEnabled || !this.openai) {
      console.warn('AI features are disabled, generating fallback insights')
      return this.generateFallbackInsights(tags, context)
    }

    const prompt = this.buildPrompt(tags, context)
    
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `你是一个智能知识助手，能够根据屏幕内容提取有价值的洞察和行动建议。
            请分析提供的内容，并生成结构化的洞察和建议。
            
            规则：
            1. 只生成有实际价值的洞察
            2. 每个洞察都应该有明确的类型和优先级
            3. 提供具体的建议行动
            4. 考虑上下文信息避免重复
            5. 使用中文回复`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' }
      })
      
      const result = JSON.parse(response.choices[0].message.content)
      const insights = this.parseInsights(result)
      
      // Store insights in context
      insights.forEach(insight => {
        this.contextStore.addInsight(insight)
      })
      
      return insights
    } catch (error) {
      console.error('Failed to generate AI insights:', error)
      return this.generateFallbackInsights(tags, context)
    }
  }

  private generateFallbackInsights(tags: Tag[], context: ContextWindow): Insight[] {
    const insights: Insight[] = []
    
    // Generate basic insights based on tags
    tags.forEach(tag => {
      if (tag.confidence > 0.7) {
        const insight: Insight = {
          id: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: `发现${this.getTypeLabel(tag.type)}`,
          content: `检测到${tag.type}相关内容: ${tag.content}`,
          type: this.getInsightType(tag.type),
          confidence: tag.confidence,
          tags: [tag.type, tag.content],
          createdAt: new Date().toISOString(),
          actions: [{
            id: `action-${Date.now()}`,
            title: `查看${this.getTypeLabel(tag.type)}`,
            description: `进一步了解${tag.content}`,
            type: 'view',
            priority: 'medium',
            dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
          }]
        }
        insights.push(insight)
      }
    })
    
    return insights
  }

  private getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      'meeting': '会议',
      'task': '任务',
      'schedule': '日程',
      'problem': '问题',
      'data': '数据',
      'document': '文档',
      'email': '邮件',
      'code': '代码'
    }
    return labels[type] || type
  }

  private getInsightType(tagType: string): 'task' | 'meeting' | 'reminder' | 'insight' | 'suggestion' {
    const typeMap: Record<string, 'task' | 'meeting' | 'reminder' | 'insight' | 'suggestion'> = {
      'meeting': 'meeting',
      'task': 'task',
      'schedule': 'reminder',
      'problem': 'suggestion',
      'data': 'insight',
      'document': 'insight',
      'email': 'task',
      'code': 'insight'
    }
    return typeMap[tagType] || 'insight'
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

  private parseInsights(result: any): Insight[] {
    if (!result.insights || !Array.isArray(result.insights)) {
      return []
    }

    return result.insights.map((insight: any, index: number) => ({
      id: `insight_${Date.now()}_${index}`,
      type: this.validateInsightType(insight.type),
      title: insight.title || '未命名洞察',
      content: insight.content || '',
      priority: this.validatePriority(insight.priority),
      suggestedActions: this.parseActions(insight.suggestedActions || []),
      metadata: {
        generatedAt: new Date().toISOString(),
        confidence: 0.8,
        source: 'ai_engine'
      }
    }))
  }

  private validateInsightType(type: string): Insight['type'] {
    const validTypes: Insight['type'][] = ['task', 'schedule', 'note', 'analysis', 'reminder']
    return validTypes.includes(type as Insight['type']) ? type as Insight['type'] : 'note'
  }

  private validatePriority(priority: string): Insight['priority'] {
    const validPriorities: Insight['priority'][] = ['low', 'medium', 'high']
    return validPriorities.includes(priority as Insight['priority']) ? priority as Insight['priority'] : 'medium'
  }

  private parseActions(actions: any[]): Action[] {
    return actions.map((action: any, index: number) => ({
      type: this.validateActionType(action.type),
      payload: action.payload || {},
      confirmationRequired: action.confirmationRequired !== false // Default to true
    }))
  }

  private validateActionType(type: string): Action['type'] {
    const validTypes: Action['type'][] = ['create_task', 'add_calendar', 'save_note', 'send_notification']
    return validTypes.includes(type as Action['type']) ? type as Action['type'] : 'save_note'
  }

  async queryContext(window: number = 10, keys?: string[]): Promise<ContextWindow> {
    return this.contextStore.getContext(window, keys)
  }

  async pushInsights(insights: Insight[]): Promise<void> {
    insights.forEach(insight => {
      this.contextStore.addInsight(insight)
    })
  }
}