import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './shared/styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.update().catch(() => undefined)
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch(() => undefined)
  })

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}
