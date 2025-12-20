import { Route, Routes } from 'react-router-dom'
import Monitor from './pages/Monitor'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import History from './pages/History'
import Plugins from './pages/Plugins'
import Overlay from './pages/Overlay'
import OverlayPresentation from './pages/presentation/Overlay'
import SidebarPresentation from './pages/presentation/Sidebar'
import BubblePresentation from './pages/presentation/Bubble'
import Layout from './components/Layout'
import { getPluginRoutes } from './plugin-registry'
import { initializePlugins } from './plugins'
import { PluginErrorBoundary } from './components/PluginErrorBoundary'

// Initialize plugins before rendering
initializePlugins()

function App(): React.JSX.Element {
  const pluginRoutes = getPluginRoutes()

  return (
    <Routes>
      {/* Plugin Routes */}
      {pluginRoutes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={<PluginErrorBoundary pluginId={route.path}>{route.element}</PluginErrorBoundary>}
        />
      ))}

      {/* Main App Routes */}
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Monitor />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/history" element={<History />} />
              <Route path="/plugins" element={<Plugins />} />
              <Route path="/overlay" element={<Overlay />} />
              <Route path="/presentation/overlay" element={<OverlayPresentation />} />
              <Route path="/presentation/sidebar" element={<SidebarPresentation />} />
              <Route path="/presentation/bubble" element={<BubblePresentation />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}

export default App
