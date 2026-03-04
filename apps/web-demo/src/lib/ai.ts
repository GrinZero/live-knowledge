export async function analyzeWithAI(input: {
  userPrompt: string
  payload: Record<string, unknown>
  attachments: string[]
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return '未配置 OPENAI_API_KEY，当前返回本地回退分析：请配置模型后启用 AI 详细建议。'
  }

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const summaryPrompt = `你是一个屏幕内容分析助手。\n用户问题: ${input.userPrompt}\n事件数据: ${JSON.stringify(
    input.payload,
  )}\n附件文件: ${input.attachments.join(', ') || '无'}\n请输出简洁可执行建议。`

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你擅长理解截图上下文与结构化事件。' },
        { role: 'user', content: summaryPrompt }
      ],
      temperature: 0.2
    })
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
