// App-wide authentication state. Wraps the api.ts token store in React context
// and stays in sync with apiFetch's silent refresh / teardown via AUTH_EVENT.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import {
  AUTH_EVENT,
  getAccessToken,
  getStoredRole,
  getStoredUser,
  login as apiLogin,
  logout as apiLogout,
} from "@/lib/api"

interface AuthState {
  token: string
  role: string
  username: string
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(() => getAccessToken())
  const [role, setRole] = useState<string>(() => getStoredRole())
  const [username, setUsername] = useState<string>(() => getStoredUser())

  // apiFetch fires AUTH_EVENT on silent refresh (new token) and on teardown
  // (empty string). Keep our in-memory state aligned with the token store.
  useEffect(() => {
    const onAuth = (e: Event) => {
      const detail = (e as CustomEvent).detail as string
      setToken(detail || "")
      if (!detail) {
        setRole("")
        setUsername("")
      } else {
        setRole(getStoredRole())
        setUsername(getStoredUser())
      }
    }
    window.addEventListener(AUTH_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_EVENT, onAuth)
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const data = await apiLogin(u, p)
    setToken(data.access_token)
    setRole(data.role)
    setUsername(u)
  }, [])

  const logout = useCallback(() => {
    apiLogout()
    setToken("")
    setRole("")
    setUsername("")
  }, [])

  return (
    <AuthContext.Provider
      value={{ token, role, username, isAuthenticated: !!token, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
