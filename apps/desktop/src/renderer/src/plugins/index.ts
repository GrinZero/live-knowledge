import { registerRendererPlugin } from '../plugin-registry'
import { ProblemSolverRendererPlugin } from './ProblemSolver'

// Register built-in plugins
export function initializePlugins() {
  registerRendererPlugin(ProblemSolverRendererPlugin)
  console.log('Renderer plugins initialized')
}
