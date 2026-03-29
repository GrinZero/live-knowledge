/**
 * Analyze an event payload using OpenAI API.
 * If payload contains screenshotBase64, uses Vision API for multimodal analysis.
 */
export async function analyzeEvent(
  payload: Record<string, unknown>,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "未配置 OPENAI_API_KEY，无法执行 AI 分析。";
  }

  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o";

  const screenshotBase64 =
    typeof payload.screenshotBase64 === "string"
      ? payload.screenshotBase64
      : undefined;

  const { screenshotBase64: _unused, ...senPayload } = payload;
  console.debug('Screenshot removed from payload', !!_unused);

  const contextText = `你是一个屏幕内容分析助手。以下是一条 raw.created 事件的 payload 数据，请分析屏幕内容并给出结构化建议。\n\n事件数据:\n${JSON.stringify(senPayload, null, 2)}
  
  为了方便用户阅读，你应当用以下结构去返回

  [上下文] 用最简短的方式描述当前上下文。
  [建议] 如果存在算法、代码相关问题，应当给出具体的思路，然后给出代码建议(优先使用 TypeScript)
  [注意] 建议应当是具体的、可执行的代码，不能只是理论。
  `;

  const userContent: string | Array<Record<string, unknown>> = screenshotBase64
    ? [
        { type: "text", text: contextText },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${screenshotBase64}`,
            detail: "high",
          },
        },
      ]
    : contextText;

  const messages = [
    {
      role: "system" as const,
      content: "你擅长理解截图上下文与结构化事件。输出请简洁、准确，结论优先。",
    },
    {
      role: "user" as const,
      content: userContent,
    },
  ];

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 请求失败: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return data.choices?.[0]?.message?.content || "AI 未返回有效内容";
}
