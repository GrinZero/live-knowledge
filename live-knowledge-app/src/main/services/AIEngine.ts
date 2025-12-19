import { v4 as uuidv4 } from 'uuid'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import nodeFetch from 'node-fetch'
import { Tag, Insight, Action, ContextWindow } from '../../renderer/src/types'
import { ContextMemory } from './ContextMemory'

import { HttpsProxyAgent } from 'https-proxy-agent'

const originalFetch = global.fetch

export class AIEngine {
  private openai: OpenAI | null = null
  private gemini: GoogleGenerativeAI | null = null
  private provider: 'openai' | 'gemini' | 'none' = 'none'
  private modelName: string = ''
  private contextStore: ContextMemory
  private isEnabled: boolean = false
  private httpAgent: HttpsProxyAgent<string> | undefined
  private language: 'zh' | 'en' = 'zh'

  constructor(apiKey?: string, provider?: 'openai' | 'gemini') {
    // Configure proxy agent
    const proxyUrl = process.env.https_proxy || process.env.http_proxy

    console.log('proxyUrl', proxyUrl)
    if (proxyUrl) {
      this.httpAgent = new HttpsProxyAgent(proxyUrl)
    }

    // Initial configuration can be passed or left empty
    if (apiKey && provider) {
      this.updateConfig({ apiKey, provider })
    }
    this.contextStore = new ContextMemory()
  }

  async analyzeContextFrames(
    frames: Array<{ imageBase64: string; text?: string }>
  ): Promise<{ text: string; tags: Tag[] }> {
    if (!this.isEnabled) {
      return { text: '', tags: [] }
    }
    const langInstruction =
      this.language === 'zh'
        ? '输出必须使用中文。融合多帧图像与文本，进行场景理解与实体合并，避免重复。'
        : 'Output must be in English. Fuse multi-frame images and text, perform scene understanding and entity merging, avoid duplicates.'
    const prompt = `
      You receive multiple consecutive frames of a screen with optional text for each frame.
      Perform temporal scene understanding:
      1) Infer the ongoing activity, intent and apps across frames.
      2) Merge entities and deduplicate across frames.
      3) Produce concise scene summary and unified tags.
      ${langInstruction}
      Return ONLY valid JSON with:
      {
        "text": "scene summary",
        "tags": [
          {
            "type": "meeting_schedule|task_todo|topic_discussion|data_table|problem_solving|insight_context",
            "title": "Short descriptive title",
            "content": "Key evidence from frames",
            "confidence": 0.0-1.0,
            "metadata": {
              "apps": string[]|null,
              "activity": string|null,
              "intent": string|null,
              "time": string|null,
              "participants": string[]|null,
              "priority": "low|medium|high"|null,
              "extra": Record<string, unknown>
            }
          }
        ]
      }
    `
    try {
      let resultJson: { text?: string; tags?: unknown[] } | null = null
      if (this.provider === 'gemini' && this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: this.modelName })
        const parts: Array<unknown> = [prompt]
        for (const [idx, f] of frames.entries()) {
          parts.push({
            inlineData: {
              data: f.imageBase64,
              mimeType: 'image/png'
            }
          })
          if (f.text) {
            parts.push(`Frame ${idx + 1} text: ${f.text.slice(0, 1000)}`)
          }
        }
        const response = await model.generateContent(parts as Array<string | { inlineData: { data: string; mimeType: string } }>)
        const text = await response.response.text()
        resultJson = this.parseJsonSafe(text)
      } else if (this.provider === 'openai' && this.openai) {
        const userContent: Array<
          | { type: 'text'; text: string }
          | { type: 'image_url'; image_url: { url: string } }
        > = [{ type: 'text', text: prompt }]
        frames.forEach((f, idx) => {
          if (f.text) {
            userContent.push({ type: 'text', text: `Frame ${idx + 1} text: ${f.text.slice(0, 1000)}` })
          }
          userContent.push({
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${f.imageBase64}` }
          })
        })
        const response = await this.openai.chat.completions.create({
          model: this.modelName,
          messages: [
            { role: 'system', content: 'You are a visual-temporal analysis engine. Output valid JSON only.' },
            { role: 'user', content: userContent as unknown as string }
          ],
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
        resultJson = this.parseJsonSafe(response.choices[0].message.content ?? '{}')
      }
      const text = resultJson?.text || ''
      const tags =
        (resultJson?.tags as Record<string, unknown>[])?.map((t) => ({
          id: uuidv4(),
          type: (t.type as Tag['type']) || 'insight_context',
          title: (t.title as string) || 'Untitled',
          content: (t.content as string) || '',
          metadata: (t.metadata as Record<string, unknown>) || {},
          timestamp: new Date().toISOString(),
          confidence: (t.confidence as number) || 0.8
        })) || []
      return { text, tags }
    } catch (error) {
      console.error('AI Multimodal Context Analysis failed:', error)
      return { text: '', tags: [] }
    }
  }
  async analyzeImage(imageBuffer: Buffer): Promise<{ text: string; tags: Tag[] }> {
    if (!this.isEnabled) {
      console.warn('AI Image Analysis is disabled')
      return { text: '', tags: [] }
    }

    const base64Image = imageBuffer.toString('base64')
    const langInstruction =
      this.language === 'zh'
        ? '输出必须使用中文。聚焦对用户当前场景与活动的理解，不必逐字转写。'
        : 'Output must be in English. Focus on understanding the user’s current scene and activity; do not transcribe verbatim.'

    const prompt = `
      You are a screen scene-understanding agent.
      1) Infer what the user is doing now (activity, intent, apps).
      2) Summarize the scene concisely.
      3) Extract structured tags aligned to the schema below.
      ${langInstruction}

      Return ONLY valid JSON in this schema:
      {
        "text": "Concise scene summary focusing on user activity",
        "tags": [
          {
            "type": "meeting_schedule|task_todo|topic_discussion|data_table|problem_solving|insight_context",
            "title": "Short descriptive title",
            "content": "Key context or salient text from the scene",
            "confidence": 0.0-1.0,
            "metadata": {
              "apps": string[],
              "activity": string,
              "intent": string,
              "time": string|null,
              "participants": string[]|null,
              "priority": "low|medium|high"|null,
              "extra": Record<string, unknown>
            }
          }
        ]
      }
    `

    try {
      let resultJson: { text?: string; tags?: unknown[] } | null = null

      if (this.provider === 'gemini' && this.gemini) {
        // Use a model that supports vision (e.g., gemini-1.5-flash or gemini-pro-vision)
        // Assuming the configured model supports it or falling back/overriding if needed.
        // For safety, if modelName is 'gemini-pro' (text only), we might want to use 'gemini-1.5-flash' or similar.
        // But let's trust the user config or the default for now, or maybe check.
        const model = this.gemini.getGenerativeModel({ model: this.modelName })

        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: 'image/png'
          }
        }

        const response = await model.generateContent([prompt, imagePart])
        const text = await response.response.text()
        resultJson = this.parseJsonSafe(text)
      } else if (this.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: this.modelName, // Must be gpt-4o, gpt-4-turbo, etc.
          messages: [
            {
              role: 'system',
              content: 'You are a visual analysis engine. Output valid JSON only.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000,
          response_format: { type: 'json_object' }
        })
        resultJson = this.parseJsonSafe(response.choices[0].message.content ?? '{}')
      }

      const text = resultJson?.text || ''
      const tags =
        (resultJson?.tags as Record<string, unknown>[])?.map((t) => ({
          id: uuidv4(),
          type: (t.type as Tag['type']) || 'insight_context',
          title: (t.title as string) || 'Untitled',
          content: (t.content as string) || '',
          metadata: (t.metadata as Record<string, unknown>) || {},
          timestamp: new Date().toISOString(),
          confidence: (t.confidence as number) || 0.8
        })) || []

      return { text, tags }
    } catch (error) {
      console.error('AI Image Analysis failed:', error)
      return { text: '', tags: [] }
    }
  }

  updateConfig(config: {
    apiKey?: string
    provider?: 'openai' | 'gemini'
    model?: string
    proxyUrl?: string
    language?: 'zh' | 'en'
  }): void {
    const { apiKey, provider, model, proxyUrl, language } = config

    if (language) {
      this.language = language
    }

    // Update proxy agent if provided
    if (proxyUrl !== undefined) {
      if (proxyUrl) {
        this.httpAgent = new HttpsProxyAgent(proxyUrl)
        // Patch global fetch for Gemini SDK which relies on it
        const agent = this.httpAgent
        // @ts-ignore: Patching global fetch to support proxy agent
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        global.fetch = async (url: any, init: any) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return nodeFetch(url, { ...init, agent }) as any
        }
      } else {
        this.httpAgent = undefined
        // Restore original fetch if available
        if (originalFetch) {
          global.fetch = originalFetch
        }
      }
    }

    // If only language is updated, don't reset the engine
    if (!apiKey && !provider && !model && proxyUrl === undefined) {
      return
    }

    // Reset current instances
    this.gemini = null
    this.openai = null
    this.isEnabled = false
    this.provider = 'none'

    if (provider === 'gemini' && apiKey) {
      try {
        // Gemini SDK automatically uses fetch, but for Node environment we might need to handle proxy via global agent or custom fetch
        // Currently Gemini SDK doesn't support direct agent injection easily in v0.1.
        // However, setting global dispatcher or using fetch with agent is possible if we override fetch.
        // For now, relying on global fetch which might not pick up env vars automatically in all node versions.
        // We will pass a custom fetch implementation if needed, but the SDK doesn't expose it in constructor options easily.
        // Actually, for Gemini REST calls (fetchModels), we use `fetch` directly, so we can inject agent there.
        this.gemini = new GoogleGenerativeAI(apiKey)
        this.provider = 'gemini'
        this.modelName = model || 'gemini-1.5-flash'
        this.isEnabled = true
        console.log(`AIEngine: Switched to Gemini (Model: ${this.modelName})`)
      } catch (error) {
        console.warn('Failed to initialize Gemini client:', error)
      }
    } else if (provider === 'openai' && apiKey) {
      try {
        this.openai = new OpenAI({
          apiKey,
          httpAgent: this.httpAgent
        })
        this.provider = 'openai'
        this.modelName = model || 'gpt-4.1'
        this.isEnabled = true
        console.log(`AIEngine: Switched to OpenAI (Model: ${this.modelName})`)
      } catch (error) {
        console.warn('Failed to initialize OpenAI client:', error)
      }
    } else {
      console.warn('AIEngine: No valid provider configured.')
    }
  }

  async fetchModels(config: {
    apiKey: string
    provider: string
    proxyUrl?: string
  }): Promise<string[]> {
    const { apiKey, provider, proxyUrl } = config
    if (!apiKey || !provider) return []

    let agent = this.httpAgent
    if (proxyUrl) {
      agent = new HttpsProxyAgent(proxyUrl)
    }

    try {
      if (provider === 'gemini') {
        // Use REST API to list models for Gemini as the SDK might not expose a simple list method yet
        // or it's cleaner to just fetch.
        // Use node-fetch to support proxy agent
        const response = await nodeFetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
          { agent }
        )
        if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`)
        const data = (await response.json()) as { models?: { name: string }[] }
        return (
          data.models
            ?.map((m) => m.name.replace('models/', ''))
            .filter((n) => n.includes('gemini')) || []
        )
      } else if (provider === 'openai') {
        const openai = new OpenAI({
          apiKey,
          httpAgent: agent
        })
        const list = await openai.models.list()
        return list.data.map((m) => m.id).filter((id) => id.includes('gpt'))
      }
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error)
      throw error // Re-throw to show error in UI
    }
    return []
  }

  async analyzeContent(text: string): Promise<Tag[]> {
    if (!this.isEnabled) {
      return []
    }

    const langInstruction =
      this.language === 'zh'
        ? '输出必须使用中文。关注用户正在进行的场景、活动和意图。'
        : 'Output must be in English. Focus on user scene, activity and intent.'

    const prompt = `
      You are a semantic scene analyzer.
      Text:
      "${text.slice(0, 2000)}"

      Extract tags aligned to this schema:
      {
        "tags": [
          {
            "type": "meeting_schedule|task_todo|topic_discussion|data_table|problem_solving|insight_context",
            "title": "Short descriptive title",
            "content": "Key segment supporting the tag",
            "confidence": 0.0-1.0,
            "metadata": {
              "apps": string[]|null,
              "activity": string|null,
              "intent": string|null,
              "time": string|null,
              "participants": string[]|null,
              "priority": "low|medium|high"|null,
              "extra": Record<string, unknown>
            }
          }
        ]
      }
      ${langInstruction}
      Return ONLY valid JSON.
    `

    try {
      let resultJson: { tags?: unknown[] } | null = null

      if (this.provider === 'gemini' && this.gemini) {
        const model = this.gemini.getGenerativeModel({ model: this.modelName })
        const response = await model.generateContent(prompt)
        const text = await response.response.text()
        resultJson = this.parseJsonSafe(text)
      } else if (this.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: 'You are a semantic analysis engine. Output valid JSON only.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
        resultJson = this.parseJsonSafe(response.choices[0].message.content ?? '{}')
      }

      if (resultJson && Array.isArray(resultJson.tags)) {
        return resultJson.tags.map((tag: unknown) => {
          const t = tag as Record<string, unknown>
          return {
            id: uuidv4(),
            type: (t.type as Tag['type']) || 'insight_context',
            title: (t.title as string) || 'Untitled',
            content: (t.content as string) || '',
            metadata: (t.metadata as Record<string, unknown>) || {},
            timestamp: new Date().toISOString(),
            confidence: (t.confidence as number) || 0.8
          }
        })
      }
      return []
    } catch (error) {
      console.error('AI Analysis failed:', error)
      return []
    }
  }

  private parseJsonSafe(text: string): Record<string, unknown> {
    try {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
      return JSON.parse(cleaned)
    } catch {
      try {
        const start = text.indexOf('{')
        const end = text.lastIndexOf('}')
        if (start >= 0 && end > start) {
          const slice = text.slice(start, end + 1)
          return JSON.parse(slice)
        }
      } catch { void 0 }
      return {}
    }
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
        const systemPrompt =
          this.language === 'zh'
            ? '你是一个智能知识助手，能够根据屏幕内容提取有价值的洞察和行动建议。请生成结构化 JSON。'
            : 'You are an intelligent knowledge assistant capable of extracting valuable insights and actionable suggestions from screen content. Please generate structured JSON.'

        const response = await this.openai.chat.completions.create({
          model: this.modelName,
          messages: [
            {
              role: 'system',
              content: systemPrompt
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

    if (this.language === 'en') {
      return `
Screen Content Tags:
${JSON.stringify(tags, null, 2)}

Context Information:
${JSON.stringify(context.recentContexts, null, 2)}

Recent Insights (Avoid Duplicates):
${JSON.stringify(recentInsights, null, 2)}

Please generate structured insights and suggestions in the following format:
{
  "insights": [
    {
      "type": "task|schedule|note|analysis|reminder",
      "title": "Insight Title",
      "content": "Detailed Content",
      "priority": "low|medium|high",
      "suggestedActions": [
        {
          "type": "create_task|add_calendar|save_note|send_notification",
          "description": "Suggested Action Description"
        }
      ]
    }
  ]
}

Requirements:
1. Each insight should have practical value.
2. Priority assessment must be accurate.
3. Suggested actions must be specific and actionable.
4. Avoid repetition with recent insights.
5. Consider context coherence.
6. ALL OUTPUT MUST BE IN ENGLISH.
      `
    }

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
6. 所有输出必须使用中文。
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
