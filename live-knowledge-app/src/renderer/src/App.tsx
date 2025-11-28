import { Route, Routes } from 'react-router-dom'
import Monitor from './pages/Monitor'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import History from './pages/History'
import Overlay from './pages/Overlay'
import OverlayPresentation from './pages/presentation/Overlay'
import SidebarPresentation from './pages/presentation/Sidebar'
import BubblePresentation from './pages/presentation/Bubble'
import Layout from './components/Layout'

function App(): React.JSX.Element {
  return (
    <Layout>
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
    </Layout>
  )
}

export default App
