import { createWorker, Worker } from 'tesseract.js'
import { v4 as uuidv4 } from 'uuid'
import { Tag } from '../../renderer/src/types'

export class ContentAnalyzer {
  private tesseractWorker: Worker | null = null
  private isWorkerInitialized: boolean = false

  async initialize(): Promise<void> {
    if (this.isWorkerInitialized) return

    try {
      this.tesseractWorker = await createWorker('chi_sim+eng')
      if (this.tesseractWorker?.setParameters) {
        await this.tesseractWorker.setParameters({
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        })
      }
      this.isWorkerInitialized = true
    } catch (error) {
      console.error('Failed to initialize Tesseract worker:', error)
      throw error
    }
  }

  async extractTextFromImage(imageBuffer: Buffer): Promise<string> {
    if (!this.isWorkerInitialized) {
      await this.initialize()
    }

    try {
      const result = await this.tesseractWorker!.recognize(imageBuffer)
      const raw = result.data.text || ''
      const normalized = raw
        .replace(/[\t\r]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .replace(/[^\S\n]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      return normalized
    } catch (error) {
      console.error('OCR extraction failed:', error)
      throw error
    }
  }

  async extractStructuredContent(text: string): Promise<Tag[]> {
    const tags: Tag[] = []

    // Define patterns for different content types
    const patterns = {
      meeting: {
        regex: /(会议|meeting|讨论|discuss|zoom|teams|google meet)/gi,
        title: this.extractMeetingTitle.bind(this),
        metadata: this.extractMeetingMetadata.bind(this)
      },
      task: {
        regex: /(任务|task|待办|todo|完成|complete|做|干|处理)/gi,
        title: this.extractTaskTitle.bind(this),
        metadata: this.extractTaskMetadata.bind(this)
      },
      schedule: {
        regex: /(日程|schedule|时间|time|日期|date|明天|今天|后天|下周|下月)/gi,
        title: this.extractScheduleTitle.bind(this),
        metadata: this.extractScheduleMetadata.bind(this)
      },
      problem: {
        regex: /(问题|problem|bug|错误|error|故障|修复|fix)/gi,
        title: this.extractProblemTitle.bind(this),
        metadata: this.extractProblemMetadata.bind(this)
      },
      data: {
        regex: /(数据|data|表格|table|图表|chart|统计|analysis|报告|report)/gi,
        title: this.extractDataTitle.bind(this),
        metadata: this.extractDataMetadata.bind(this)
      }
    }

    // Check each pattern
    for (const [type, config] of Object.entries(patterns)) {
      const matches = text.match(config.regex)
      if (matches && matches.length > 0) {
        const confidence = this.calculateConfidence(text, config.regex)
        if (confidence > 0.3) {
          // Minimum confidence threshold
          tags.push({
            id: uuidv4(),
            type: type as Tag['type'],
            title: config.title(text, matches),
            content: text,
            metadata: config.metadata(text, matches),
            timestamp: new Date().toISOString(),
            confidence
          })
        }
      }
    }

    return tags
  }

  private calculateConfidence(text: string, pattern: RegExp): number {
    const matches = text.match(pattern)
    if (!matches) return 0

    // Calculate confidence based on match frequency and text length
    const matchCount = matches.length
    const textLength = text.length
    const keywordDensity = matchCount / (textLength / 100) // matches per 100 characters

    // Confidence increases with keyword density, capped at 0.95
    return Math.min(0.95, keywordDensity * 2)
  }

  private extractMeetingTitle(text: string, matches: RegExpMatchArray): string {
    // Look for meeting titles after meeting keywords
    const lines = text.split('\n')
    for (const line of lines) {
      if (matches.some((match) => line.toLowerCase().includes(match.toLowerCase()))) {
        // Extract what comes after the meeting keyword
        const cleanedLine = line.replace(/^(会议|meeting|讨论|discuss)\s*[:：]\s*/i, '')
        if (cleanedLine.length > 5 && cleanedLine.length < 100) {
          return cleanedLine.trim()
        }
      }
    }
    return '会议讨论'
  }

  private extractMeetingMetadata(text: string, matches: RegExpMatchArray): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      detectedKeywords: matches,
      participants: this.extractParticipants(text),
      time: this.extractTime(text),
      platform: this.detectMeetingPlatform(text)
    }
    return metadata
  }

  private extractTaskTitle(text: string, matches: RegExpMatchArray): string {
    const lines = text.split('\n')
    for (const line of lines) {
      if (matches.some((match) => line.toLowerCase().includes(match.toLowerCase()))) {
        // Look for task descriptions
        const taskLine = line.replace(/^(任务|task|待办|todo)\s*[:：]\s*/i, '')
        if (taskLine.length > 3 && taskLine.length < 150) {
          return taskLine.trim()
        }
      }
    }
    return '待办任务'
  }

  private extractTaskMetadata(text: string, matches: RegExpMatchArray): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      detectedKeywords: matches,
      priority: this.detectTaskPriority(text),
      deadline: this.extractDeadline(text),
      assignee: this.extractAssignee(text)
    }
    return metadata
  }

  private extractScheduleTitle(text: string, matches: RegExpMatchArray): string {
    const lines = text.split('\n')
    for (const line of lines) {
      if (matches.some((match) => line.toLowerCase().includes(match.toLowerCase()))) {
        const scheduleLine = line.replace(/^(日程|schedule)\s*[:：]\s*/i, '')
        if (scheduleLine.length > 5 && scheduleLine.length < 100) {
          return scheduleLine.trim()
        }
      }
    }
    return '日程安排'
  }

  private extractScheduleMetadata(
    text: string,
    matches: RegExpMatchArray
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      detectedKeywords: matches,
      time: this.extractTime(text),
      duration: this.extractDuration(text),
      location: this.extractLocation(text)
    }
    return metadata
  }

  private extractProblemTitle(text: string, matches: RegExpMatchArray): string {
    const lines = text.split('\n')
    for (const line of lines) {
      if (matches.some((match) => line.toLowerCase().includes(match.toLowerCase()))) {
        const problemLine = line.replace(/^(问题|problem|bug|错误|error)\s*[:：]\s*/i, '')
        if (problemLine.length > 5 && problemLine.length < 150) {
          return problemLine.trim()
        }
      }
    }
    return '问题反馈'
  }

  private extractProblemMetadata(text: string, matches: RegExpMatchArray): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      detectedKeywords: matches,
      severity: this.detectProblemSeverity(text),
      category: this.categorizeProblem(text),
      affectedComponent: this.extractAffectedComponent(text)
    }
    return metadata
  }

  private extractDataTitle(text: string, matches: RegExpMatchArray): string {
    const lines = text.split('\n')
    for (const line of lines) {
      if (matches.some((match) => line.toLowerCase().includes(match.toLowerCase()))) {
        const dataLine = line.replace(/^(数据|data|表格|table|图表|chart)\s*[:：]\s*/i, '')
        if (dataLine.length > 3 && dataLine.length < 100) {
          return dataLine.trim()
        }
      }
    }
    return '数据分析'
  }

  private extractDataMetadata(text: string, matches: RegExpMatchArray): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      detectedKeywords: matches,
      dataType: this.detectDataType(text),
      metrics: this.extractMetrics(text),
      timeRange: this.extractTimeRange(text)
    }
    return metadata
  }

  // Helper methods for metadata extraction
  private extractParticipants(text: string): string[] {
    const participantPatterns = [
      /(\w+)\s*[:：]/g, // Name followed by colon
      /参与者[：:]\s*([^\n]+)/i,
      /参会人员[：:]\s*([^\n]+)/i
    ]

    const participants: string[] = []
    participantPatterns.forEach((pattern) => {
      const matches = text.match(pattern)
      if (matches) {
        matches.forEach((match) => {
          const cleaned = match.replace(/[:：]/g, '').trim()
          if (cleaned.length > 1 && cleaned.length < 50) {
            participants.push(cleaned)
          }
        })
      }
    })

    return [...new Set(participants)] // Remove duplicates
  }

  private extractTime(text: string): string | null {
    const timePatterns = [
      /(\d{1,2}):(\d{2})/g, // 14:30
      /(\d{1,2})点(\d{1,2})分/g, // 14点30分
      /(\d{4})-(\d{1,2})-(\d{1,2})/g, // 2024-11-21
      /(今天|明天|后天|下周|下月)/g // Relative time
    ]

    for (const pattern of timePatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[0]
      }
    }

    return null
  }

  private detectMeetingPlatform(text: string): string | null {
    const platforms = ['zoom', 'teams', 'google meet', '腾讯会议', '钉钉']
    const lowerText = text.toLowerCase()

    for (const platform of platforms) {
      if (lowerText.includes(platform)) {
        return platform
      }
    }

    return null
  }

  private detectTaskPriority(text: string): 'low' | 'medium' | 'high' {
    const highKeywords = ['紧急', 'urgent', '重要', 'important', '立即', 'immediately', 'asap']
    const lowKeywords = ['低优先级', 'low priority', '不急', 'not urgent']

    const lowerText = text.toLowerCase()

    if (highKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      return 'high'
    }

    if (lowKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      return 'low'
    }

    return 'medium'
  }

  private extractDeadline(text: string): string | null {
    return this.extractTime(text) // Reuse time extraction
  }

  private extractAssignee(text: string): string | null {
    const assigneePatterns = [
      /分配给[：:]\s*([^\n]+)/i,
      /负责人[：:]\s*([^\n]+)/i,
      /@(\w+)/g // @username format
    ]

    for (const pattern of assigneePatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[1] || match[0]
      }
    }

    return null
  }

  private extractDuration(text: string): string | null {
    const durationPatterns = [
      /(\d+)小时/g, // X hours
      /(\d+)分钟/g, // X minutes
      /(\d+)h/g, // Xh
      /(\d+)min/g // Xmin
    ]

    for (const pattern of durationPatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[0]
      }
    }

    return null
  }

  private extractLocation(text: string): string | null {
    const locationPatterns = [
      /地点[：:]\s*([^\n]+)/i,
      /位置[：:]\s*([^\n]+)/i,
      /在([^\n，。]+)举行/i
    ]

    for (const pattern of locationPatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[1] || match[0]
      }
    }

    return null
  }

  private detectProblemSeverity(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalKeywords = ['严重', 'critical', '崩溃', 'crash', '数据丢失']
    const highKeywords = ['重要', 'high', '主要', 'major', '无法使用']
    const lowKeywords = ['轻微', 'low', '小问题', 'minor', '建议']

    const lowerText = text.toLowerCase()

    if (criticalKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      return 'critical'
    }

    if (highKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      return 'high'
    }

    if (lowKeywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
      return 'low'
    }

    return 'medium'
  }

  private categorizeProblem(text: string): string {
    const categories = {
      ui: ['界面', 'ui', '显示', 'display', '按钮', 'button'],
      performance: ['性能', 'performance', '慢', 'slow', '卡顿', 'lag'],
      functionality: ['功能', 'functionality', '无法', 'cannot', '失效', 'broken'],
      data: ['数据', 'data', '丢失', 'lost', '错误', 'error']
    }

    const lowerText = text.toLowerCase()

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
        return category
      }
    }

    return 'general'
  }

  private extractAffectedComponent(text: string): string | null {
    const componentPatterns = [
      /(登录|login|注册|register|首页|home|设置|settings)/gi,
      /(数据库|database|api|接口)/gi
    ]

    for (const pattern of componentPatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[0]
      }
    }

    return null
  }

  private detectDataType(text: string): string {
    const dataTypes = {
      table: ['表格', 'table', 'excel', 'csv'],
      chart: ['图表', 'chart', '图形', 'graph'],
      report: ['报告', 'report', '总结', 'summary'],
      metrics: ['指标', 'metrics', 'kpi', 'performance']
    }

    const lowerText = text.toLowerCase()

    for (const [type, keywords] of Object.entries(dataTypes)) {
      if (keywords.some((keyword) => lowerText.includes(keyword.toLowerCase()))) {
        return type
      }
    }

    return 'general'
  }

  private extractMetrics(text: string): string[] {
    const metricPatterns = [
      /(\d+(?:\.\d+)?)%/g, // Percentages
      /(\d+(?:\.\d+)?)万/g, // Chinese large numbers
      /(\d+(?:\.\d+)?)亿/g, // Chinese large numbers
      /(\d+(?:\.\d+)?)[kK]/g, // K notation
      /(\d+(?:\.\d+)?)[mM]/g // M notation
    ]

    const metrics: string[] = []
    metricPatterns.forEach((pattern) => {
      const matches = text.match(pattern)
      if (matches) {
        metrics.push(...matches)
      }
    })

    return [...new Set(metrics)] // Remove duplicates
  }

  private extractTimeRange(text: string): string | null {
    const timeRangePatterns = [
      /(\d{4})-(\d{4})/g, // Year ranges
      /(本月|上月|本季度|上季度)/g, // Chinese relative time
      /(最近|last)\s*(\d+)\s*(天|周|月|年)/g // Relative time ranges
    ]

    for (const pattern of timeRangePatterns) {
      const match = text.match(pattern)
      if (match && match.length > 0) {
        return match[0]
      }
    }

    return null
  }

  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate()
      this.isWorkerInitialized = false
    }
  }
}
