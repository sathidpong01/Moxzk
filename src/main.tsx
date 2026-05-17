import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../app.css'
import './index.css'
import App from './App.tsx'
import { installElectronRuntime } from './runtime/electronRuntime'

installElectronRuntime()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
