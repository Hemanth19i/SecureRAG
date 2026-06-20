import { useState } from 'react'
import { Users, UserPlus, X, Loader2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { register, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'

// Settings intentionally contains only what's backed by a real endpoint: ADMIN
// user creation via POST /auth/register. The previous General / API Keys /
// Notifications / Appearance sections were cosmetic (no persistence) and were
// removed in the Phase B honesty pass rather than ship dead controls.
export default function Settings() {
  const { role } = useAuth()
  const isAdmin = role === 'ADMIN'

  // Create-user modal (wired to the ADMIN-only POST /auth/register).
  const [showCreate, setShowCreate] = useState(false)
  const [cuUser, setCuUser] = useState('')
  const [cuPass, setCuPass] = useState('')
  const [cuRole, setCuRole] = useState('ANALYST')
  const [cuBusy, setCuBusy] = useState(false)
  const [cuError, setCuError] = useState('')

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cuUser.trim().length < 3 || cuPass.length < 8) {
      setCuError('Username ≥ 3 chars and password ≥ 8 chars required.')
      return
    }
    setCuBusy(true)
    setCuError('')
    try {
      await register(cuUser.trim(), cuPass, cuRole)
      toast.success(`User "${cuUser.trim()}" created`, { description: `Role: ${cuRole}. They can now log in.` })
      setShowCreate(false)
      setCuUser(''); setCuPass(''); setCuRole('ANALYST')
    } catch (err) {
      setCuError(
        err instanceof ApiError
          ? (err.status === 409 ? 'Username already exists.'
            : err.status === 403 ? 'Only ADMIN can create users.'
            : err.message)
          : 'Could not create user.',
      )
    } finally {
      setCuBusy(false)
    }
  }

  return (
    <div className="mx-auto h-full max-w-[900px] p-8">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-sr-text">Settings</h1>
        <p className="mt-1 text-sm text-sr-text-secondary">Account and user management.</p>
      </div>

      {/* Users — the only real settings surface */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-sr-text">
            <Users size={16} className="text-sr-accent" /> Users
          </h2>
          <button
            onClick={() => { setCuError(''); setShowCreate(true) }}
            disabled={!isAdmin}
            title={isAdmin ? undefined : 'Only ADMIN can create users'}
            className="flex items-center gap-1.5 rounded-md bg-sr-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sr-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <UserPlus size={14} /> Add User
          </button>
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-sr-yellow/30 bg-sr-yellow/10 px-4 py-3 text-sm text-sr-yellow">
            <ShieldAlert size={15} className="shrink-0" />
            User management requires an ADMIN session. You're signed in as {role || 'a non-admin role'}.
          </div>
        )}

        {/* No GET /users endpoint exists in the backend, so we don't fabricate a
            directory. Created users authenticate via /auth/login. */}
        <div className="rounded-lg border border-sr-border bg-sr-surface p-6 text-sm text-sr-text-secondary card-shadow">
          <Users size={18} className="mb-2 text-sr-text-tertiary" />
          <p>The backend has no user-directory endpoint, so existing users aren't listed here.</p>
          <p className="mt-1 text-sr-text-tertiary">
            {isAdmin
              ? 'Use “Add User” to create an account (ADMIN/ANALYST/VIEWER). New users sign in from the login screen.'
              : 'Ask an ADMIN to create accounts.'}
          </p>
        </div>
      </div>

      {/* Create User modal (ADMIN-only; POST /auth/register) */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <form
            onSubmit={createUser}
            className="fixed left-1/2 top-1/2 z-50 w-[400px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-sr-border bg-sr-surface p-6 card-shadow"
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold text-sr-text">
                <UserPlus size={16} className="text-sr-accent" /> Create User
              </h3>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded p-1 text-sr-text-tertiary hover:bg-sr-elevated hover:text-sr-text">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cu-user" className="text-xs text-sr-text-secondary">Username</Label>
              <Input id="cu-user" value={cuUser} onChange={(e) => setCuUser(e.target.value)} autoComplete="off"
                placeholder="analyst2" className="border-sr-border bg-sr-elevated font-mono text-sr-text" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-pass" className="text-xs text-sr-text-secondary">Password</Label>
              <Input id="cu-pass" type="password" value={cuPass} onChange={(e) => setCuPass(e.target.value)} autoComplete="new-password"
                placeholder="≥ 8 characters" className="border-sr-border bg-sr-elevated font-mono text-sr-text" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-role" className="text-xs text-sr-text-secondary">Role</Label>
              <select id="cu-role" value={cuRole} onChange={(e) => setCuRole(e.target.value)}
                className="w-full rounded-md border border-sr-border bg-sr-elevated px-3 py-2 text-sm text-sr-text focus:border-sr-accent focus:outline-none">
                <option value="ANALYST">ANALYST</option>
                <option value="VIEWER">VIEWER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            {cuError && (
              <div className="flex items-center gap-2 rounded border border-sr-red/30 bg-sr-red/10 px-3 py-2 text-xs text-sr-red">
                <AlertTriangle size={13} className="shrink-0" /> {cuError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-sr-border">Cancel</Button>
              <Button type="submit" disabled={cuBusy} className="bg-sr-accent text-white hover:bg-sr-accent-hover">
                {cuBusy ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : 'Create user'}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  )
}
