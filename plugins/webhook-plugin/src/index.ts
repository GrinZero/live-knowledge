import { LiveKnowledgePlugin, PluginContext } from '@live-knowledge/plugin-sdk'

interface WebhookConfig {
  url: string
  headers?: Record<string, string>
  events?: string[] // If empty, trigger on all events
}

export class WebhookPlugin implements LiveKnowledgePlugin {
  id = 'webhook-plugin'
  name = 'Webhook Integration'
  version = '1.0.0'
  description = 'Triggers external webhooks when knowledge or insights are generated.'

  config: Record<string, unknown> = {}

  configSchema = {
    type: 'object',
    properties: {
      webhooks: {
        type: 'array',
        title: 'Webhook 列表',
        description: '配置需要触发的 Webhook',
        items: {
          type: 'object',
          title: 'Webhook 配置',
          properties: {
            url: { 
              type: 'string', 
              title: 'URL', 
              description: 'Webhook 接口地址' 
            },
            headers: { 
              type: 'object', 
              title: 'Headers', 
              description: 'HTTP 请求头',
              additionalProperties: { type: 'string' } 
            },
            events: {
              type: 'array',
              title: '触发事件',
              description: '监听的事件类型（留空则监听所有）',
              items: { 
                type: 'string', 
                enum: ['insight_generated', 'knowledge_created'] 
              }
            }
          }
        }
      }
    }
  }

  defaultConfig = {
    webhooks: [
      {
        url: 'https://httpbin.org/post',
        headers: {
          'Content-Type': 'application/json'
        },
        events: ['insight_generated', 'knowledge_created']
      }
    ]
  }

  initialize(context: PluginContext) {
    console.log('[WebhookPlugin] Initialized', context)
  }

  hooks = {
    onEvent: async (event: string, payload: Record<string, unknown>) => {
      console.log(`[WebhookPlugin] Received event: ${event}`)
      
      const webhooks = (this.config.webhooks as WebhookConfig[]) || (this.defaultConfig.webhooks as WebhookConfig[])

      if (!Array.isArray(webhooks)) {
        console.error('[WebhookPlugin] Webhooks config must be an array')
        return
      }

      for (const hook of webhooks) {
        if (hook.events && hook.events.length > 0 && !hook.events.includes(event)) {
          continue
        }

        if (!hook.url) continue

        try {
          console.log(`[WebhookPlugin] Triggering webhook: ${hook.url}`)
          fetch(hook.url, {
            method: 'POST',
            headers: hook.headers || { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event,
              timestamp: new Date().toISOString(),
              payload
            })
          }).catch(err => console.error(`[WebhookPlugin] Webhook request failed for ${hook.url}:`, err))
        } catch (error) {
          console.error(`[WebhookPlugin] Error triggering webhook ${hook.url}:`, error)
        }
      }
    }
  }
}
