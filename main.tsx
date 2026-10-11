import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'

try { const t = localStorage.getItem('su_theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t } catch { /* theme preference unavailable */ }
createRoot(document.getElementById('root')!).render(<App />)
