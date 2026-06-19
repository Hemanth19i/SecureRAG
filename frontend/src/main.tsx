import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/space-grotesk/700.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from '@/lib/auth'
import { Toaster } from '@/components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
      <Toaster theme="dark" position="bottom-right" />
    </AuthProvider>
  </BrowserRouter>,
)
