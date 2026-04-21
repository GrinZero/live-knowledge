export interface PersistedAIConfigInput {
  provider: string
  model: string
  proxyUrl?: string
  baseUrl?: string
  language?: 'zh' | 'en'
}

export function buildAIConfigSettings(config: PersistedAIConfigInput) {
  return {
    provider: config.provider,
    model: config.model,
    proxyUrl: config.proxyUrl,
    baseUrl: config.baseUrl,
    language: config.language
  }
}
