import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (no external CDN, nothing leaks).
import '@fontsource/archivo/400.css'
import '@fontsource/archivo/500.css'
import '@fontsource/archivo/600.css'
import '@fontsource/archivo/700.css'
import '@fontsource/spline-sans-mono/400.css'
import '@fontsource/spline-sans-mono/500.css'
import '@fontsource/spline-sans-mono/600.css'
import '@fontsource/noto-naskh-arabic/400.css'
import '@fontsource/noto-naskh-arabic/700.css'

import 'maplibre-gl/dist/maplibre-gl.css'

import './design/tokens.css'
import './design/base.css'
import './design/ui.css'
import './design/app.css'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
