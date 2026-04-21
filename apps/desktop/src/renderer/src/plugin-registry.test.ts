import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetPluginRegistryForTests,
  buildPluginScriptUrl,
  getPluginRoutes,
  loadInstalledPlugins,
  registerRendererPlugin
} from './plugin-registry'

describe('plugin-registry', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    __resetPluginRegistryForTests()
    ;(window as Window & { api: any }).api = {
      plugins: {
        getRendererPlugins: vi.fn().mockResolvedValue([])
      }
    }
  })

  afterEach(() => {
    __resetPluginRegistryForTests()
  })

  it('为插件脚本追加版本参数以绕过旧缓存', () => {
    const firstUrl = buildPluginScriptUrl('media:///tmp/plugin.js')
    const secondUrl = buildPluginScriptUrl('media:///tmp/plugin.js')

    expect(firstUrl).toContain('media:///tmp/plugin.js?v=1')
    expect(secondUrl).toContain('media:///tmp/plugin.js?v=2')
  })

  it('重新加载插件时会清掉旧注册和旧脚本标签', async () => {
    registerRendererPlugin({
      id: 'stale-plugin',
      routes: [{ path: '/stale', element: 'stale route' }]
    })
    const staleScript = document.createElement('script')
    staleScript.id = 'plugin-script-stale-plugin'
    document.body.appendChild(staleScript)

    ;(window as Window & { api: any }).api = {
      plugins: {
        getRendererPlugins: vi.fn().mockResolvedValue([
          {
            id: 'fresh-plugin',
            scriptPath: 'media:///tmp/fresh-plugin.js'
          }
        ])
      }
    }

    await loadInstalledPlugins()

    expect(getPluginRoutes()).toHaveLength(0)
    expect(document.getElementById('plugin-script-stale-plugin')).toBeNull()

    const freshScript = document.getElementById('plugin-script-fresh-plugin') as HTMLScriptElement
    expect(freshScript).not.toBeNull()
    expect(freshScript.src).toContain('fresh-plugin.js?v=1')
  })
})
