import { RendererPlugin } from '../../plugin-registry'
import Solver from '../../pages/Solver'

export const ProblemSolverRendererPlugin: RendererPlugin = {
  id: 'problem-solver',
  routes: [
    {
      path: '/solver',
      element: <Solver />
    }
  ]
}
