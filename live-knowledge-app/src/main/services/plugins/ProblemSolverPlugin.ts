import { LiveKnowledgePlugin, PluginContext } from '../../types/plugin'
import { Action } from '../../../renderer/src/types'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export class ProblemSolverPlugin implements LiveKnowledgePlugin {
  id = 'problem-solver'
  name = 'Problem Solver AI'
  version = '1.0.0'
  description =
    'Detects problem-solving scenarios and offers AI-powered solutions in a dedicated window.'

  private solutionWindow: BrowserWindow | null = null
  // Map to store context by ID: <id, { problem, screenshotPath }>
  private contextStore: Map<string, { problem: string; screenshotPath: string | null }> = new Map()

  initialize(context: PluginContext) {
    // Register API for the renderer to pull the problem context
    context.http.router.get('/context', async (req, res) => {
      const id = req.query.id as string
      console.log(`[ProblemSolverPlugin] Renderer requested context for ID: ${id}`)
      console.log(
        `[ProblemSolverPlugin] Current store keys: ${Array.from(this.contextStore.keys()).join(', ')}`
      )

      if (!id || !this.contextStore.has(id)) {
        console.error(`[ProblemSolverPlugin] Context not found for ID: ${id}`)
        res.status(404).json({ error: 'Context not found' })
        return
      }

      const ctx = this.contextStore.get(id)
      console.log(`[ProblemSolverPlugin] Returning context for ID: ${id}`, JSON.stringify(ctx))
      res.json(ctx)
    })

    // Register backend API for the renderer to call
    // Route will be mounted at /api/plugins/problem-solver/generate
    context.http.router.post('/generate', async (req, res) => {
      // Log the received body for debugging
      console.log(
        '[Solver Plugin] Received generate request:',
        JSON.stringify({ ...req.body, problem: req.body.problem })
      )

      const { problem, screenshotPath } = req.body
      if (!problem) {
        console.error('[Solver Plugin] Missing problem statement')
        res.status(400).json({ error: 'Problem statement is required' })
        return
      }

      console.log(`[Solver Plugin] Generating solution for: ${problem.substring(0, 50)}...`)

      let images: string[] = []
      if (screenshotPath) {
        try {
          if (fs.existsSync(screenshotPath)) {
            const buffer = fs.readFileSync(screenshotPath)
            images = [buffer.toString('base64')]
            console.log(
              `[Solver Plugin] Loaded screenshot for context (size: ${buffer.length} bytes)`
            )
          } else {
            console.warn(`[Solver Plugin] Screenshot file not found: ${screenshotPath}`)
          }
        } catch (err) {
          console.error('[Solver Plugin] Failed to load screenshot:', err)
        }
      }

      // Set headers for streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')

      try {
        const prompt = `
You are an expert algorithm and problem-solving assistant.
Please provide a comprehensive solution for the following problem:

"${problem}"

Structure your response with:
1. Problem Analysis (Constraints, Edge Cases)
2. Optimal Algorithm Strategy
3. Step-by-Step Implementation Plan
4. Time & Space Complexity Analysis
5. Code Snippet (if applicable, in Python or TypeScript)

IMPORTANT: Use proper Markdown formatting. Use code blocks for code. Do NOT output raw HTML.
        `.trim()

        const stream = context.ai.generateCompletionStream(prompt, images)

        for await (const chunk of stream) {
          res.write(chunk)
        }

        res.end()
      } catch (error) {
        console.error('[Solver Plugin] Generation failed:', error)
        // If headers already sent, we can only end the stream, maybe with an error message appended
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
      // In a real scenario, we might check if a known "problem site" like LeetCode or StackOverflow is open
      // For now, we return a hint that we are active
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
      // Custom action type from plugin
      if (action.type === 'solve_problem') {
        console.log('[ProblemSolverPlugin] Received solve_problem action:', JSON.stringify(action))

        const payload = action.payload as Record<string, unknown>
        // Try multiple keys for robustness
        const problem = (payload.problem_statement ||
          payload.problem ||
          payload.statement ||
          payload.description) as string

        if (!problem) {
          console.error(
            '[ProblemSolverPlugin] No problem statement found in payload:',
            Object.keys(payload)
          )
          return false
        }

        // Pass screenshot path if available in action context/payload (if we enhanced the action payload schema)
        // Currently Action doesn't strictly carry the image path unless we put it in payload.
        // We will rely on the frontend or backend to look it up if needed, but for now let's pass what we have.
        const screenshotPath = action.payload.screenshotPath as string | undefined
        console.log(
          `[Problem Solver] Solving: ${problem.substring(0, 50)}... (Image: ${screenshotPath ? 'Yes' : 'No'})`
        )

        // Open the solution window
        this.openSolutionWindow(problem, screenshotPath)
        return true
      }
      return false
    }
  }

  private openSolutionWindow(problem: string, screenshotPath?: string) {
    // Generate session ID and store context
    const sessionId = uuidv4()
    console.log(
      `[ProblemSolverPlugin] Storing context for session ${sessionId}: problem length=${problem?.length}`
    )
    this.contextStore.set(sessionId, {
      problem,
      screenshotPath: screenshotPath || null
    })

    // Clean up old sessions (optional, but good practice to avoid memory leaks)
    // For now, let's keep it simple or implement a basic cleanup if map gets too big
    if (this.contextStore.size > 10) {
      const firstKey = this.contextStore.keys().next().value
      if (firstKey) this.contextStore.delete(firstKey)
    }

    const urlHash = `#/solver?id=${sessionId}`

    if (this.solutionWindow && !this.solutionWindow.isDestroyed()) {
      this.solutionWindow.focus()
      // Reload the window with new ID
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
      // No need to push here, renderer will pull on mount
    })

    this.solutionWindow.on('closed', () => {
      this.solutionWindow = null
    })

    // Load the specific route for the solution view
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.solutionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}${urlHash}`)
    } else {
      // For production, we need to handle hash routing if file:// protocol is used
      // Or just load index.html and let the router handle the hash
      this.solutionWindow.loadFile(join(__dirname, '../../renderer/index.html'), {
        hash: `solver?id=${sessionId}`
      })
    }
  }
}
