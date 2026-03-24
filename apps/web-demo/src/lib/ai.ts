import type { DetectedType } from './store'

export async function analyzeWithAI(input: {
  userPrompt: string
  payload: Record<string, unknown>
  attachments: string[]
  markdown?: string
  detectedType?: DetectedType
  screenshotBase64?: string
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return '未配置 OPENAI_API_KEY，当前返回本地回退分析：请配置模型后启用 AI 详细建议。'
  }

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const scenarioHint =
    input.detectedType === 'problem_solving'
      ? '这是题解场景，请优先输出解题步骤、关键知识点和最终答案。'
      : '请输出结构化建议，结论优先。'

  const summaryPrompt = `你是一个屏幕内容分析助手。\n用户问题: ${input.userPrompt}\n检测类型: ${input.detectedType || 'unknown'}\n事件数据: ${JSON.stringify(
    input.payload,
  )}\nMarkdown数据: ${input.markdown || '无'}\n附件文件: ${input.attachments.join(', ') || '无'}\n${scenarioHint}`

  // Build messages with image if available (multimodal)
  const messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }> = [
    {
      role: 'system',
      content:
        '你擅长理解截图上下文与结构化事件。输出请简洁、准确，并在题解场景明确给出可执行步骤。',
    },
  ]

  // Prepare user content (text + optional image)
  const userContent: string | Array<Record<string, unknown>> = input.screenshotBase64
    ? [
        { type: 'text', text: summaryPrompt },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${input.screenshotBase64}`,
            detail: 'high',
          },
        },
      ]
    : summaryPrompt

  messages.push({ role: 'user', content: userContent })

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`AI 请求失败: ${response.status} ${text}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  return data.choices?.[0]?.message?.content || 'AI 未返回有效内容'
}
