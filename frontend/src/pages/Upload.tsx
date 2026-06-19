import { useRef, useState } from 'react'
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { uploadLog, ApiError } from '@/lib/api'
import { useAuth } from '@/lib/auth'

export default function Upload() {
  const { role } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ chunks: number } | null>(null)
  const [error, setError] = useState('')

  const isAdmin = role === 'ADMIN'

  const pick = (f: File | null) => {
    setFile(f)
    setResult(null)
    setError('')
  }

  const submit = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await uploadLog(file)
      setResult({ chunks: res.chunks_stored })
      toast.success('File ingested', { description: `${res.chunks_stored} chunks stored` })
      setFile(null)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Upload failed — is the backend running?'
      setError(msg)
      toast.error('Upload failed', { description: msg })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[760px] p-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <UploadCloud size={18} className="text-sr-accent" />
          <h1 className="font-display text-xl font-bold text-sr-text">Ingest Logs</h1>
        </div>
        <p className="mt-1 text-sm text-sr-text-secondary">
          Upload a log file. It's chunked, embedded, correlated, and made searchable on the AI Investigation page.
        </p>
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-yellow/30 bg-sr-yellow/10 px-4 py-3 text-sm text-sr-yellow">
          <ShieldAlert size={15} className="shrink-0" />
          Ingestion requires an ADMIN session. You're signed in as {role || 'a non-admin role'} — the server will reject the upload.
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files?.[0]) pick(e.dataTransfer.files[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver ? 'border-sr-accent bg-sr-accent/5' : 'border-sr-border bg-sr-surface hover:border-sr-border-focus'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".log,.txt,.json,.csv,text/plain"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <FileText size={28} className="text-sr-accent" />
            <div>
              <div className="text-sm font-medium text-sr-text">{file.name}</div>
              <div className="text-xs text-sr-text-tertiary">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          </>
        ) : (
          <>
            <UploadCloud size={28} className="text-sr-text-tertiary" />
            <div>
              <div className="text-sm text-sr-text">Drop a log file here, or click to browse</div>
              <div className="mt-1 text-xs text-sr-text-tertiary">.log · .txt · .json · .csv</div>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={submit}
          disabled={!file || busy}
          className="bg-sr-accent text-white hover:bg-sr-accent-hover"
        >
          {busy ? <><Loader2 size={15} className="animate-spin" /> Ingesting…</> : <><UploadCloud size={15} /> Ingest file</>}
        </Button>
        {file && !busy && (
          <button onClick={() => pick(null)} className="text-xs text-sr-text-tertiary hover:text-sr-text">
            Clear
          </button>
        )}
      </div>

      {result && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-green/30 bg-sr-green/10 px-4 py-3 text-sm text-sr-green">
          <CheckCircle2 size={15} className="shrink-0" />
          Ingested successfully — {result.chunks} chunks stored and indexed.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-sr-red/30 bg-sr-red/10 px-4 py-3 text-sm text-sr-red">
          <AlertTriangle size={15} className="shrink-0" /> {error}
        </div>
      )}
    </div>
  )
}
