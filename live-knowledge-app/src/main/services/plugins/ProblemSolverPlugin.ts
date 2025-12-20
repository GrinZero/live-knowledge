import { LiveKnowledgePlugin, PluginContext } from '../../types/plugin'
import { Action } from '../../../renderer/src/types'
import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

export class ProblemSolverPlugin implements LiveKnowledgePlugin {
  id = 'problem-solver'
  name = 'Problem Solver AI'
  version = '1.0.0'
  description = 'Detects problem-solving scenarios and offers AI-powered solutions in a dedicated window.'

  private solutionWindow: BrowserWindow | null = null
  // private context: PluginContext | null = null

  initialize(context: PluginContext) {
    // this.context = context

    // Register backend API for the renderer to call
    context.ipc.handle('solver:generate', async (_, problem: string) => {
      console.log(`[Problem Solver] Generating solution for: ${problem.substring(0, 50)}...`)
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
        `.trim()

        const solution = await context.ai.generateCompletion(prompt)
        return solution
      } catch (error) {
        console.error('[Problem Solver] Generation failed:', error)
        return `Error generating solution: ${error instanceof Error ? error.message : String(error)}`
      }
    })
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
3. Do NOT provide the full solution in the insight content immediately; offer to "Solve with AI".
      `.trim()
    },

    onAction: async (action: Action) => {
      // @ts-ignore: Custom action type from plugin
      if (action.type === 'solve_problem') {
        const problem = action.payload.problem_statement as string
        console.log(`[Problem Solver] Solving: ${problem}`)

        // Open the solution window
        this.openSolutionWindow(problem)
        return true
      }
      return false
    }
  }

  private openSolutionWindow(problem: string) {
    if (this.solutionWindow && !this.solutionWindow.isDestroyed()) {
      this.solutionWindow.focus()
      this.solutionWindow.webContents.send('solver:problem', problem)
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
      // Send the problem after a short delay to ensure React is ready
      setTimeout(() => {
        this.solutionWindow?.webContents.send('solver:problem', problem)
      }, 1000)
    })

    // Load the specific route for the solution view
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.solutionWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/solver`)
    } else {
      // For production, we need to handle hash routing if file:// protocol is used
      // Or just load index.html and let the router handle the hash
      this.solutionWindow.loadFile(join(__dirname, '../../renderer/index.html'), { hash: 'solver' })
    }
  }
}
