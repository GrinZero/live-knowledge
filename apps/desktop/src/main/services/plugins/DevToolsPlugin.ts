import { LiveKnowledgePlugin } from '../../types/plugin'
import fs from 'fs/promises'
import path from 'path'

export class DevToolsPlugin implements LiveKnowledgePlugin {
  id = 'devtools-plugin'
  name = 'DevTools & Project Analyzer'
  version = '1.0.0'
  description = 'Analyzes project configuration and suggests developer actions'

  // private lastPackageJsonHash: string = ''

  hooks = {
    getContext: async () => {
      // In a real plugin, this would inspect the active window title or file path to determine the project root.
      // For this demo, we'll try to look for package.json in the current working directory of the user if possible,
      // or just simulate some context.
      // Since we are in Electron Main process, process.cwd() might be the app install dir, not the user's project.
      // We'll rely on a simulated environment or try to infer from recent "active window" title if we had access.
      // Let's assume we are monitoring the project we are developing for this demo:
      // /Users/bugyaluwang/project/live-knowledge/live-knowledge-app

      const projectPath = '/Users/bugyaluwang/project/live-knowledge/live-knowledge-app'
      const packageJsonPath = path.join(projectPath, 'package.json')

      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8')
        const pkg = JSON.parse(content)

        return {
          currentProject: {
            name: pkg.name,
            version: pkg.version,
            dependencies: Object.keys(pkg.dependencies || {}).slice(0, 5), // Top 5 deps
            isElectron: true,
            framework: 'react'
          }
        }
      } catch {
        return {
          currentProject: null
        }
      }
    },

    enrichPrompt: async (context: Record<string, unknown>) => {
      const project = (context as any).currentProject
      if (project) {
        return `
[DevTools Plugin]
User is working on project "${project.name}" (v${project.version}).
Tech Stack: Electron, React, Dependencies: ${project.dependencies.join(', ')}.
If the screen shows package.json or dependency errors, suggest "run_npm_install".
If the screen shows UI bugs, suggest "check_renderer_logs".
        `.trim()
      }
      return undefined
    },

    onAction: async (action: any) => {
      if (action.type === 'run_npm_install') {
        console.log('[DevTools Plugin] Executing npm install (simulated)...')
        return true
      }
      if (action.type === 'check_renderer_logs') {
        console.log('[DevTools Plugin] Opening renderer logs (simulated)...')
        return true
      }
      return false
    }
  }
}
