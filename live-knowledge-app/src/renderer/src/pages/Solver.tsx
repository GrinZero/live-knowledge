import { useState, useEffect } from 'react'
import { Bot, Sparkles, Loader2 } from 'lucide-react'

export default function Solver(): React.JSX.Element {
  const [problem, setProblem] = useState<string>('')
  const [solution, setSolution] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Listen for problem data from main process
    const handleProblem = (_: unknown, problemText: string) => {
      setProblem(problemText)
      generateSolution(problemText)
    }

    // Check if electron API is available
    // @ts-ignore: Accessing internal electron API
    if (window.electron && window.electron.ipcRenderer) {
      // @ts-ignore: Accessing internal electron API
      window.electron.ipcRenderer.on('solver:problem', handleProblem)
    } else {
      console.warn('IPC Renderer not found. Is preload script loaded?')
    }

    return () => {
      // @ts-ignore: Accessing internal electron API
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore: Accessing internal electron API
        window.electron.ipcRenderer.removeAllListeners('solver:problem')
      }
    }
  }, [])

  const generateSolution = async (text: string) => {
    setLoading(true)
    setSolution('')

    try {
      // Call the plugin backend API
      // @ts-ignore: Accessing internal electron API
      if (window.electron && window.electron.ipcRenderer) {
        // @ts-ignore: Accessing internal electron API
        const result = await window.electron.ipcRenderer.invoke('solver:generate', text)
        setSolution(result)
      } else {
        setSolution('Error: IPC not available')
      }
    } catch (error) {
      setSolution(`Error generating solution: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen bg-white flex flex-col">
      <header className="h-14 border-b border-gray-200 px-4 flex items-center gap-3 bg-white sticky top-0 z-10">
        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
          <Bot className="w-5 h-5" />
        </div>
        <h1 className="font-semibold text-gray-900">AI Problem Solver</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {problem ? (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
              <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Problem Statement</h2>
              <p className="text-lg text-gray-900 leading-relaxed">{problem}</p>
            </div>

            <div className="relative">
              <div className="absolute -left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-200 to-transparent"></div>

              {loading ? (
                <div className="flex items-center gap-3 text-purple-600 animate-pulse pl-6">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Generating solution...</span>
                </div>
              ) : (
                <div className="pl-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h2 className="text-lg font-semibold text-gray-900">AI Solution</h2>
                  </div>
                  <div className="prose prose-purple max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 leading-relaxed bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                      {solution}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Bot className="w-16 h-16 mb-4 opacity-20" />
            <p>Waiting for problem context...</p>
          </div>
        )}
      </div>
    </div>
  )
}
