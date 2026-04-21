import { describe, expect, it } from 'vitest'
import { resolveMediaFilePath } from './mediaProtocol'

describe('resolveMediaFilePath', () => {
  it('会忽略 cache busting query，只返回真实文件路径', () => {
    const result = resolveMediaFilePath(
      'media:///Users/test/plugins/webhook-plugin/dist/renderer.global.js?v=1',
      'darwin'
    )

    expect(result).toBe('/Users/test/plugins/webhook-plugin/dist/renderer.global.js')
  })

  it('会兼容 Windows 盘符路径', () => {
    const result = resolveMediaFilePath(
      'media:///C:/Users/test/plugin/dist/renderer.global.js?v=2',
      'win32'
    )

    expect(result).toBe('C:/Users/test/plugin/dist/renderer.global.js')
  })
})
