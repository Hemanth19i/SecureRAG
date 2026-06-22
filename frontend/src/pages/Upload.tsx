import { useRef, useState } from 'react'
import { UploadCloud, FileText, Loader2, CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react'
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
  const [duplicate, setDuplicate] = useState<string | null>(null)
  const [error, setError] = useState('')

  const isAdmin = role === 'ADMIN'

  // The backend ingests plain UTF-8 text and decodes uploads as UTF-8. Validate
  // client-side so a binary / non-UTF-8 file gets a friendly message instead of
  // being sent and failing server-side. Returns an error string, or null if OK.
  const validateTextFile = async (f: File): Promise<string | null> => {
    if (f.size === 0) return 'This file is empty — there’s nothing to ingest.'
    try {
      const buf = await f.arrayBuffer()
      new TextDecoder('utf-8', { fatal: true }).decode(buf)
      return null
    } catch {
      return 'This file isn’t valid UTF-8 text. SecureRAG ingests plain-text logs (e.g. .log, .txt) — binary or non-UTF-8 files can’t be parsed.'
    }
  }

  const pick = (f: File | null) => {
    setFile(f)
    setResult(null)
    setDuplicate(null)
    setError('')
  }

  const submit = async () => {
    if (!file) return
    setBusy(true)
    setError('')
    setDuplicate(null)
    setResult(null)
    try {
      const invalid = await validateTextFile(file)
      if (invalid) {
        setError(invalid)
        toast.error('Unsupported file', { description: invalid })
        return
      }
      const res = await uploadLog(file)
      setResult({ chunks: res.chunks_stored })
      toast.success('File ingested', { description: `${res.chunks_stored} chunks stored` })
      setFile(null)
    } catch (err) {
      // A 409 isn't a failure — it's the SHA-256 dedup confirming this exact file
      // is already in the system. Surface it as an informational state the analyst
      // can act on, not a red error.
      if (err instanceof ApiError && err.status === 409) {
        const uid = (err.data as { upload_id?: string } | null)?.upload_id
        setDuplicate(
          uid
            ? `This exact file is already ingested (upload ${uid.slice(0, 8)}). Nothing new was stored.`
            : 'This exact file is already ingested. Nothing new was stored.',
        )
        toast('Already ingested', { description: 'This file is already in the system — no duplicate created.' })
      } else {
        const msg = err instanceof ApiError ? err.message : 'Upload failed — is the backend running?'
        setError(msg)
        toast.error('Upload failed', { description: msg })
      }
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
      {duplicate && (
        <div className="flex items-start gap-2 rounded-lg border border-sr-blue/30 bg-sr-blue/10 px-4 py-3 text-sm text-sr-blue">
          <Info size={15} className="mt-0.5 shrink-0" />
          <div>
            {duplicate}
            <div className="mt-1 text-xs text-sr-text-tertiary">
              Duplicate detection is working as intended — pick a different file to ingest new evidence.
            </div>
          </div>
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
