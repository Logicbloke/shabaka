import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { initApp, setOnReady } from './state/store'
import { startNetwork } from './state/network'
import './ui/styles.css'

setOnReady(startNetwork)
void initApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
