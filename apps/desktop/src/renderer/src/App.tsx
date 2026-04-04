import { Route, Routes } from 'react-router-dom'
import Monitor from './pages/Monitor'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import Plugins from './pages/Plugins'
import Overlay from './pages/Overlay'
import OverlayPresentation from './pages/presentation/Overlay'
import SidebarPresentation from './pages/presentation/Sidebar'
import BubblePresentation from './pages/presentation/Bubble'
import EventHistory from './pages/EventHistory'
import Layout from './components/Layout'
import { getPluginRoutes, subscribeToPluginUpdates } from './plugin-registry'
import { initializePlugins } from './plugins'
import { PluginErrorBoundary } from './components/PluginErrorBoundary'
import { PluginPageLayout } from './components/PluginPageLayout'
import { PrivacyOverlay } from './components/PrivacyOverlay'
import { useEffect, useState } from 'react'

// Initialize plugins before rendering
initializePlugins()

function App(): React.JSX.Element {
  const [pluginRoutes, setPluginRoutes] = useState(getPluginRoutes())

  useEffect(() => {
    const unsubscribe = subscribeToPluginUpdates(() => {
      setPluginRoutes(getPluginRoutes())
    })
    return unsubscribe
  }, [])

  const sidebarRoutes = pluginRoutes.filter((r) => !r.layout || r.layout === 'sidebar')
  const pageRoutes = pluginRoutes.filter((r) => r.layout === 'page')

  return (
    <>
      <PrivacyOverlay />
      <Routes>
        {/* Full Page Plugin Routes (Standalone with Back Button) */}
        {pageRoutes.map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={
              <PluginPageLayout title={route.title}>
                <PluginErrorBoundary pluginId={route.pluginId}>{route.element}</PluginErrorBoundary>
              </PluginPageLayout>
            }
          />
        ))}

        {/* Main App Routes & Sidebar Plugin Routes */}
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Monitor />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/events" element={<EventHistory />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/plugins" element={<Plugins />} />
                <Route path="/overlay" element={<Overlay />} />
                <Route path="/presentation/overlay" element={<OverlayPresentation />} />
                <Route path="/presentation/sidebar" element={<SidebarPresentation />} />
                <Route path="/presentation/bubble" element={<BubblePresentation />} />

                {/* Sidebar Plugin Routes (Rendered inside Layout) */}
                {sidebarRoutes.map((route) => (
                  <Route
                    key={route.path}
                    path={route.path}
                    element={
                      <PluginErrorBoundary pluginId={route.pluginId}>
                        {route.element}
                      </PluginErrorBoundary>
                    }
                  />
                ))}
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </>
  )
}

export default App
