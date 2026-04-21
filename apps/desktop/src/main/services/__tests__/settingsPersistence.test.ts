import { describe, expect, it } from 'vitest'
import { buildAIConfigSettings } from '../settingsPersistence'

describe('buildAIConfigSettings', () => {
  it('会保留 language、baseUrl 和 proxyUrl 字段', () => {
    const settings = buildAIConfigSettings({
      provider: 'openai',
      model: 'gpt-5.1',
      proxyUrl: 'http://127.0.0.1:7890',
      baseUrl: 'https://example.com/v1',
      language: 'en'
    })

    expect(settings).toEqual({
      provider: 'openai',
      model: 'gpt-5.1',
      proxyUrl: 'http://127.0.0.1:7890',
      baseUrl: 'https://example.com/v1',
      language: 'en'
    })
  })
})
