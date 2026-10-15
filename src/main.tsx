import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Lets :active styles show on iOS taps.
document.addEventListener('touchstart', () => {}, { passive: true })

if (import.meta.env.DEV) {
  // Handy from the browser console while developing.
  void Promise.all([import('./data/db'), import('./data/repo'), import('./lib/scryfall')]).then(([{ db }, repo, scryfall]) =>
    Object.assign(window, { db, repo, scryfall }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
