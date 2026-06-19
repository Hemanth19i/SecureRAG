import { useState, useEffect, useCallback, useRef } from 'react'
import { ApiError } from './api'

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

// Generic GET-on-mount hook: runs `fetcher`, exposes {status,data,error,reload}.
// A 401 is handled globally — apiFetch tears the session down on refresh failure,
// which flips the auth gate back to the login screen — so pages don't special-case it.
export function useApiData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(() => {
    setStatus('loading')
    setError('')
    fetcherRef.current().then(
      (d) => {
        setData(d)
        setStatus('ready')
      },
      (e) => {
        setError(e instanceof ApiError ? e.message : 'Request failed — is the backend running?')
        setStatus('error')
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    load()
  }, [load])

  return { status, data, error, reload: load }
}
