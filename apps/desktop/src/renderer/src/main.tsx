import './assets/main.css'

import { StrictMode } from 'react'
import { HashRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import App from './App'
import { loadInstalledPlugins } from './plugin-registry'

loadInstalledPlugins().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  )
})
