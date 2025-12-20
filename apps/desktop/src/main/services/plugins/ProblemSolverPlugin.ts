import { LiveKnowledgePlugin, PluginContext, Action } from '../../types/plugin'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export class ProblemSolverPlugin implements LiveKnowledgePlugin {
  id = 'problem-solver'
  name = 'Problem Solver AI'
  version = '1.1.0'
  description =
    'Detects problem-solving scenarios and offers AI-powered solutions in a dedicated window.'

  config: Record<string, any> = {}

  configSchema = {
    type: 'object',
    properties: {
      systemPrompt: {
        type: 'string',
        title: '系统提示词 (System Prompt)',
        description: 'AI 解决问题时使用的核心指令模板。可以使用 {problem} 作为占位符。',
        format: 'textarea'
      }
    }
  }

  defaultConfig = {
    systemPrompt: `You are an expert algorithm and problem-solving assistant.
Please provide a comprehensive solution for the following problem:

"{problem}"

Structure your response with:
1. Problem Analysis (Constraints, Edge Cases)
2. Optimal Algorithm Strategy
3. Step-by-Step Implementation Plan
4. Time & Space Complexity Analysis
5. Code Snippet (if applicable, in Python or TypeScript)

IMPORTANT: Use proper Markdown formatting. Use code blocks for code. Do NOT output raw HTML.`
  }

  private solutionWindow: BrowserWindow | null = null
  // Map to store context by ID: <id, { problem, screenshotPath }>
  private contextStore: Map<string, { problem: string; screenshotPath: string | null }> = new Map()

  private lastProblemContext: { problem: string; sessionId: string; timestamp: number } | null =
    null
  private pluginContext: PluginContext | null = null

  initialize(context: PluginContext) {
    this.pluginContext = context

    // Register API for the renderer to pull the problem context
    context.http.router.get('/context', async (req, res) => {
      const id = req.query.id as string

      if (!id || !this.contextStore.has(id)) {
        res.status(404).json({ error: 'Context not found' })
        return
      }

      const ctx = this.contextStore.get(id)
      res.json(ctx)
    })

    // Register API for history
    context.http.router.get('/history', async (_req, res) => {
      try {
        // Fetch recent items and filter by type 'problem_history'
        // Ideally we should add a specific DB method, but this works for now
        const items = await context.database.getKnowledgeItems(100)
        const history = items
          .filter((item) => item.type === 'problem_history')
          .map((item) => {
            try {
              const content = JSON.parse(item.content)
              return {
                id: item.id,
                problem: content.problem,
                solution: content.solution,
                createdAt: item.createdAt,
                screenshotPath: item.metadata?.screenshotPath
              }
            } catch {
              return null
            }
          })
          .filter(Boolean)

        res.json(history)
      } catch (error) {
        console.error('[Solver Plugin] Failed to fetch history:', error)
        res.status(500).json({ error: 'Failed to fetch history' })
      }
    })

    // Register backend API for the renderer to call
    context.http.router.post('/generate', async (req, res) => {
      const { problem, screenshotPath } = req.body
      if (!problem) {
        res.status(400).json({ error: 'Problem statement is required' })
        return
      }

      console.log(`[Solver Plugin] Generating solution for: ${problem.substring(0, 50)}...`)

      let images: string[] = []
      if (screenshotPath && fs.existsSync(screenshotPath)) {
        try {
          const buffer = fs.readFileSync(screenshotPath)
          images = [buffer.toString('base64')]
        } catch (err) {
          console.error('[Solver Plugin] Failed to load screenshot:', err)
        }
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')

      try {
        const promptTemplate =
          (this.config.systemPrompt as string) || this.defaultConfig.systemPrompt
        const prompt = promptTemplate.replace('{problem}', problem)

        const stream = context.ai.generateCompletionStream(prompt, images)
        let fullSolution = ''

        for await (const chunk of stream) {
          res.write(chunk)
          fullSolution += chunk
        }

        res.end()

        // Save to history
        try {
          await context.database.createKnowledgeItem({
            userId: 'default_user',
            type: 'problem_history',
            title: problem.substring(0, 50) + '...',
            content: JSON.stringify({ problem, solution: fullSolution }),
            metadata: { screenshotPath },
            confidence: 1.0
          })
          console.log('[Solver Plugin] Saved solution to history')
        } catch (dbError) {
          console.error('[Solver Plugin] Failed to save history:', dbError)
        }
      } catch (error) {
        console.error('[Solver Plugin] Generation failed:', error)
        res.write(
          `\n\nError generating solution: ${error instanceof Error ? error.message : String(error)}`
        )
        res.end()
      }
    })

    console.log('[ProblemSolverPlugin] Initialized and registered routes')
  }

  hooks = {
    getContext: async () => {
      return {
        problemSolverActive: true
      }
    },

    enrichPrompt: async () => {
      return `
[Problem Solver Plugin]
If the user appears to be solving a technical problem, coding challenge, or math question:
1. Identify the problem statement clearly.
2. Suggest an action with type "solve_problem" and payload containing the "problem_statement".
3. Include the relevant screenshot (relatedImageIndex) in the insight.
4. Do NOT provide the full solution in the insight content immediately; offer to "Solve with AI".
      `.trim()
    },

    onAction: async (action: Action) => {
      if (action.type === 'solve_problem') {
        const payload = action.payload as Record<string, unknown>
        const problem = (payload.problem_statement ||
          payload.problem ||
          payload.statement ||
          payload.description) as string

        if (!problem) return false

        const screenshotPath = action.payload.screenshotPath as string | undefined

        // Duplicate Detection
        if (await this.isDuplicateTask(problem)) {
          console.log('[ProblemSolverPlugin] Duplicate task detected, reusing existing session.')
          if (this.solutionWindow && !this.solutionWindow.isDestroyed()) {
            this.solutionWindow.focus()
            // If we had a stored session ID for this problem, we could potentially reload it,
            // but currently we just focus the window which likely shows the last result if it wasn't closed.
            // If it was closed, we open a new one anyway.
          } else {
            // If window is closed but it's a duplicate task, we might want to open it with the OLD context?
            // But we only store `lastProblemContext` in memory.
            // Let's just proceed to open window but maybe we could skip generation if we had the result?
            // For now, focusing the window is the main benefit if it's open.
            // If it's closed, we open a new one (re-solving is fine if the user closed the previous one).
            this.openSolutionWindow(problem, screenshotPath)
          }
          return true
        }

        this.openSolutionWindow(problem, screenshotPath)
        return true
      }
      return false
    }
  }

  private async isDuplicateTask(newProblem: string): Promise<boolean> {
    if (!this.lastProblemContext) return false

    // Check if within reasonable time (e.g. 1 hour)
    if (Date.now() - this.lastProblemContext.timestamp > 3600000) return false

    // Exact match
    if (this.lastProblemContext.problem === newProblem) return true

    // AI Check
    if (this.pluginContext) {
      try {
        const prompt = `Compare these two problem statements and determine if they describe the exact same task or coding problem.

Problem 1: "${this.lastProblemContext.problem}"

Problem 2: "${newProblem}"

Reply with only "YES" or "NO".`
        const result = await this.pluginContext.ai.generateCompletion(prompt)
        return result.trim().toUpperCase().includes('YES')
      } catch (e) {
        console.error('Duplicate check failed', e)
      }
    }

    return false
  }

  private openSolutionWindow(problem: string, screenshotPath?: string) {
    const sessionId = uuidv4()
    this.contextStore.set(sessionId, {
      problem,
      screenshotPath: screenshotPath || null
    })

    // Update last problem context
    this.lastProblemContext = {
      problem,
      sessionId,
      timestamp: Date.now()
    }

    if (this.contextStore.size > 10) {
      const firstKey = this.contextStore.keys().next().value
      if (firstKey) this.contextStore.delete(firstKey)
    }

    const urlHash = `#/solver?id=${sessionId}`

    if (this.solutionWindow && !this.solutionWindow.isDestroyed()) {
      this.solutionWindow.focus()
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        this.solutionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${urlHash}`)
      } else {
        this.solutionWindow.loadFile(join(__dirname, '../../renderer/index.html'), {
          hash: `solver?id=${sessionId}`
        })
      }
      return
    }

    this.solutionWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    this.solutionWindow.on('ready-to-show', () => {
      this.solutionWindow?.show()
    })

    this.solutionWindow.on('closed', () => {
      this.solutionWindow = null
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.solutionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${urlHash}`)
    } else {
      this.solutionWindow.loadFile(join(__dirname, '../../renderer/index.html'), {
        hash: `solver?id=${sessionId}`
      })
    }
  }
}
