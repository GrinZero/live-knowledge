import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('apiClient dynamic port handling', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it('主进程端口变化后，请求仍会使用最新端口', async () => {
    const getPort = vi.fn().mockResolvedValueOnce(3001).mockResolvedValueOnce(3002)
    ;(window as Window & { api: any }).api = {
      apiServer: {
        getPort
      }
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ notificationsEnabled: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { apiClient } = await import('./api-client')

    await apiClient.settings.getAppSettings()
    await apiClient.settings.getAppSettings()

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3001/api/settings/app')
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3002/api/settings/app')
  })
})
