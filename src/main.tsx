import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../app.css'
import './index.css'
import App from './App.tsx'
import { installElectronRuntimeIfAvailable } from './runtime/electronRuntime'

installElectronRuntimeIfAvailable()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
