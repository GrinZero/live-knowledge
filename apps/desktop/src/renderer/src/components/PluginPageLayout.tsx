import { ArrowLeft } from 'lucide-react'
import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  children: ReactNode
  title?: string
}

export function PluginPageLayout({ children, title }: Props) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600 hover:text-gray-900"
          title="Go Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="font-semibold text-lg text-gray-900">{title || 'Plugin Page'}</div>
      </header>
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  )
}
