import { spawn } from 'node:child_process'
import path from 'node:path'

export async function convertWithMarkItDown(localUploadPath?: string): Promise<string | null> {
  if (!localUploadPath) return null
  if (process.env.MARKITDOWN_AUTO_CONVERT !== 'true') return null

  const absolute = path.join(process.cwd(), 'public', localUploadPath.replace(/^\//, ''))

  return await new Promise((resolve) => {
    const child = spawn('python', ['-m', 'markitdown', absolute], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      if (code === 0 && stdout.trim().length > 0) {
        resolve(stdout.trim())
        return
      }

      if (stderr.trim()) {
        console.warn('[web-demo] markitdown conversion skipped:', stderr)
      }
      resolve(null)
    })

    child.on('error', () => resolve(null))
  })
}
