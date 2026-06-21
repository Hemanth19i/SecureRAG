import { useState } from 'react'
import { Lock, AlertTriangle, Loader2, Eye, EyeOff, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/lib/auth'
import { ApiError, wasSessionExpired } from '@/lib/api'

export default function LoginScreen() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Read once on mount: was the user bounced here by an expired/invalid session
  // (vs. a deliberate logout)? The flag is cleared on a successful login.
  const [expired] = useState(() => wasSessionExpired())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username, password)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401 ? 'Invalid credentials'
            : err.status === 429 ? (err.message || 'Too many login attempts. Please try again later.')
            : err.message,
        )
      } else {
        setError('Login failed — is the backend running?')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-sr-bg px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(255,122,0,0.06), transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <svg width="44" height="44" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14 2L3 7.5V14.5C3 20.5 7.8 26.1 14 27.5C20.2 26.1 25 20.5 25 14.5V7.5L14 2Z" stroke="#FF7A00" strokeWidth="1.5" fill="none" />
              <text x="14" y="17" textAnchor="middle" fill="#FF7A00" fontSize="9" fontWeight="700" fontFamily="Space Grotesk">SR</text>
            </svg>
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-sr-accent" />
          </div>
          <div className="text-center">
            <h1 className="font-display text-xl font-bold tracking-tight text-sr-text">SecureRAG</h1>
            <p className="mt-1 text-xs text-sr-text-secondary">AI-powered threat investigation platform</p>
          </div>
        </div>

        {/* Session-expired notice (shown only when bounced here by an expired session) */}
        {expired && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-sr-yellow/30 bg-sr-yellow/10 px-3 py-2 text-xs text-sr-yellow">
            <Clock size={13} className="shrink-0" />
            <span>Session expired — please log in again.</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 rounded-lg border border-sr-border bg-sr-surface p-6 card-shadow">
          <div className="flex items-center gap-2 text-xs text-sr-text-secondary">
            <Lock size={13} className="text-sr-accent" />
            <span>Authentication required — ADMIN or ANALYST session.</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username" className="text-xs text-sr-text-secondary">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="analyst"
              className="bg-sr-elevated border-sr-border font-mono text-sr-text"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-sr-text-secondary">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-sr-elevated border-sr-border pr-9 font-mono text-sr-text"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-sr-text-tertiary hover:text-sr-text"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded border border-sr-red/30 bg-sr-red/10 px-3 py-2 text-xs text-sr-red">
              <AlertTriangle size={13} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy || !username || !password}
            className="w-full bg-sr-accent text-white hover:bg-sr-accent-hover"
          >
            {busy ? (
              <><Loader2 size={15} className="animate-spin" /> Connecting…</>
            ) : (
              'Connect'
            )}
          </Button>

          {/* Honest: no public signup / forgot-password — accounts are admin-provisioned. */}
          <p className="text-center text-[11px] text-sr-text-tertiary">
            Accounts are provisioned by an administrator.
          </p>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] text-sr-text-tertiary">
          © 2026 SecureRAG · Developed by Hemanth A R
        </p>
      </div>
    </div>
  )
}
