export type EventDomain = 'knowledge' | 'information' | 'system' | 'unknown'

export interface EventTypeDefinition {
  type: string
  domain: EventDomain
  description?: string
}

const LEGACY_EVENT_ALIASES: Record<string, string> = {
  insight_generated: 'insight.generated',
  knowledge_created: 'knowledge.created',
}

export const DEFAULT_EVENT_TYPES: EventTypeDefinition[] = [
  {
    type: 'knowledge.created',
    domain: 'knowledge',
    description: '知识库新增知识项。',
  },
  {
    type: 'insight.generated',
    domain: 'information',
    description: '首屏信息流新增洞察。',
  },
  {
    type: 'webhook.delivered',
    domain: 'system',
    description: 'Webhook 插件成功发送事件。',
  },
  {
    type: 'webhook.delivery_failed',
    domain: 'system',
    description: 'Webhook 插件发送失败。',
  },
]

export function normalizeEventType(type: string): string {
  const input = (type || '').trim()
  return LEGACY_EVENT_ALIASES[input] || input || 'unknown.event'
}

export function resolveEventDomain(type: string, catalog: EventTypeDefinition[] = []): EventDomain {
  const normalized = normalizeEventType(type)
  const merged = [...catalog, ...DEFAULT_EVENT_TYPES]
  const found = merged.find((item) => item.type === normalized)
  return found?.domain || 'unknown'
}
