import { Link, Route, Routes } from 'react-router-dom'
import Monitor from './pages/Monitor'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import History from './pages/History'
import Overlay from './pages/Overlay'
import OverlayPresentation from './pages/presentation/Overlay'
import SidebarPresentation from './pages/presentation/Sidebar'
import BubblePresentation from './pages/presentation/Bubble'

function App(): React.JSX.Element {
  return (
    <div className="min-h-screen text-white">
      <header className="flex items-center justify-between px-4 py-3 md:px-6 bg-black/60">
        <div className="font-semibold">Live Knowledge</div>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="hover:underline">
            监控
          </Link>
          <Link to="/dashboard" className="hover:underline">
            展示
          </Link>
          <Link to="/settings" className="hover:underline">
            设置
          </Link>
          <Link to="/history" className="hover:underline">
            历史
          </Link>
          <Link to="/overlay" className="hover:underline">
            悬浮窗
          </Link>
        </nav>
      </header>

      <main className="px-4 py-4 md:px-6">
        <Routes>
          <Route path="/" element={<Monitor />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/presentation/overlay" element={<OverlayPresentation />} />
          <Route path="/presentation/sidebar" element={<SidebarPresentation />} />
          <Route path="/presentation/bubble" element={<BubblePresentation />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
