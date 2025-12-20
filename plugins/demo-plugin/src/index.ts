import { LiveKnowledgePlugin, PluginContext, Action } from '@live-knowledge/plugin-sdk'

export class DemoPlugin implements LiveKnowledgePlugin {
  id = 'demo-plugin'
  name = 'Demo Plugin'
  version = '1.0.0'
  description = 'A demonstration plugin to show the plugin system capabilities.'

  defaultConfig = {
    greeting: 'Hello from Demo Plugin!'
  }
  
  config: Record<string, unknown> = {}

  initialize(context: PluginContext) {
    console.log('[DemoPlugin] Initializing...')
    
    // Register a simple HTTP route
    context.http.router.get('/hello', (_req, res) => {
      const greeting = this.config.greeting || this.defaultConfig.greeting
      res.json({ message: greeting })
    })

    console.log('[DemoPlugin] Registered route GET /hello')
  }

  hooks = {
    enrichPrompt: async () => {
      return `[Demo Plugin] This is a context injected by the demo plugin.`
    },
    
    onAction: async (action: Action) => {
      if (action.type === 'demo_action') {
        console.log('[DemoPlugin] Handled demo_action:', action.payload)
        return true
      }
      return false
    }
  }
}
