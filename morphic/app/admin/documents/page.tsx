'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || ''

interface Namespace {
  value: string
  label: string
}

interface DocEntry {
  filename: string
  namespace: string
  chunk_count: number
  timestamp: string
}

interface QueuedFile {
  file: File
  id: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  chunks?: number
  pages?: number
  error?: string
}

const DEFAULT_NAMESPACES: Namespace[] = [
  { value: 'general-namespace', label: 'General Namespace' },
  { value: 'sales-namespace', label: 'Sales Namespace' },
  { value: 'support-namespace', label: 'Support Namespace' },
  { value: 'operations-namespace', label: 'Operations Namespace' },
  { value: 'accounting-namespace', label: 'Accounting Namespace' },
]

const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.csv', '.doc', '.docx']

function isAcceptedFile(file: File) {
  const name = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))
}

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [namespaces, setNamespaces] = useState<Namespace[]>(DEFAULT_NAMESPACES)
  const [loading, setLoading] = useState(false)
  const [filterNs, setFilterNs] = useState('')
  const [uploadNs, setUploadNs] = useState('general-namespace')
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const [viewingDoc, setViewingDoc] = useState<DocEntry | null>(null)
  const [docChunks, setDocChunks] = useState<string[]>([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean
    type: 'file' | 'namespace'
    data: { filename?: string; namespace: string }
  }>({ open: false, type: 'file', data: { namespace: '' } })

  const fetchNamespaces = useCallback(async () => {
    try {
      const res = await fetch(`${RAG_URL}/admin/namespaces`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      if (data.namespaces) {
        const nsList = data.namespaces.map((ns: string) => ({
          value: ns,
          label: ns.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        }))
        setNamespaces(nsList)
      }
    } catch {
      // fallback to defaults
    }
  }, [])

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterNs
        ? `${RAG_URL}/admin/documents?namespace=${filterNs}`
        : `${RAG_URL}/admin/documents`
      const res = await fetch(url, { headers: { 'X-Admin-Key': ADMIN_KEY } })
      const data = await res.json()
      setDocs(data.documents || [])
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [filterNs])

  useEffect(() => {
    fetchNamespaces()
    fetchDocs()
  }, [fetchDocs, fetchNamespaces])

  // ── Queue helpers ────────────────────────────────────────────────
  const addFilesToQueue = (files: File[]) => {
    const valid = files.filter(isAcceptedFile)
    const invalid = files.filter(f => !isAcceptedFile(f))
    if (invalid.length > 0) {
      toast({
        title: 'Unsupported file type',
        description: `Skipped: ${invalid.map(f => f.name).join(', ')}. Use PDF, TXT, DOC, or DOCX.`,
        variant: 'destructive',
      })
    }
    if (valid.length === 0) return
    setFileQueue(prev => [
      ...prev,
      ...valid.map(f => ({
        file: f,
        id: `${f.name}-${Date.now()}-${Math.random()}`,
        status: 'pending' as const,
      })),
    ])
  }

  const removeFromQueue = (id: string) =>
    setFileQueue(prev => prev.filter(f => f.id !== id))

  const clearCompleted = () =>
    setFileQueue(prev => prev.filter(f => f.status === 'pending' || f.status === 'uploading'))

  // ── Drag & drop handlers ─────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    addFilesToQueue(Array.from(e.dataTransfer.files))
  }
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFilesToQueue(Array.from(e.target.files || []))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Upload ───────────────────────────────────────────────────────
  const uploadSingleFile = async (qf: QueuedFile, ns: string) => {
    setFileQueue(prev =>
      prev.map(f => (f.id === qf.id ? { ...f, status: 'uploading' } : f))
    )

    const form = new FormData()
    form.append('file', qf.file)
    form.append('namespace', ns)
    form.append('timestamp', new Date().toISOString())

    const name = qf.file.name.toLowerCase()
    let endpoint = `${RAG_URL}/upload-text`
    if (name.endsWith('.pdf')) endpoint = `${RAG_URL}/upload-pdf`
    else if (name.endsWith('.doc') || name.endsWith('.docx')) endpoint = `${RAG_URL}/upload-docx`

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-Admin-Key': ADMIN_KEY },
        body: form,
      })
      const data = await res.json()
      if (res.ok) {
        setFileQueue(prev =>
          prev.map(f =>
            f.id === qf.id
              ? { ...f, status: 'done', chunks: data.chunks_stored, pages: data.pages_processed }
              : f
          )
        )
      } else {
        setFileQueue(prev =>
          prev.map(f =>
            f.id === qf.id ? { ...f, status: 'error', error: data.detail || 'Upload failed' } : f
          )
        )
      }
    } catch (e: unknown) {
      setFileQueue(prev =>
        prev.map(f =>
          f.id === qf.id
            ? { ...f, status: 'error', error: e instanceof Error ? e.message : 'Network error' }
            : f
        )
      )
    }
  }

  const handleUploadAll = async () => {
    const pending = fileQueue.filter(f => f.status === 'pending')
    if (pending.length === 0) return
    setIsUploading(true)
    const ns = uploadNs
    for (const qf of pending) {
      await uploadSingleFile(qf, ns)
    }
    setIsUploading(false)
    toast({ title: 'Upload complete', description: `Processed ${pending.length} file(s) into ${ns}` })
    fetchDocs()
  }

  // ── View handler ─────────────────────────────────────────────────
  const handleView = async (doc: DocEntry) => {
    setViewingDoc(doc)
    setDocChunks([])
    setLoadingChunks(true)
    try {
      const res = await fetch(
        `${RAG_URL}/admin/document-chunks?filename=${encodeURIComponent(doc.filename)}&namespace=${doc.namespace}`,
        { headers: { 'X-Admin-Key': ADMIN_KEY } }
      )
      if (res.ok) {
        const data = await res.json()
        setDocChunks(data.chunks || [])
      }
    } catch {
      // endpoint may not exist — modal still opens showing metadata
    } finally {
      setLoadingChunks(false)
    }
  }

  // ── Delete handlers ──────────────────────────────────────────────
  const handleDelete = (filename: string, namespace: string) =>
    setConfirmDelete({ open: true, type: 'file', data: { filename, namespace } })

  const handleDeleteNamespace = () => {
    if (!filterNs) return
    setConfirmDelete({ open: true, type: 'namespace', data: { namespace: filterNs } })
  }

  const executeDelete = async () => {
    const { type, data } = confirmDelete
    setConfirmDelete(prev => ({ ...prev, open: false }))

    if (type === 'file' && data.filename) {
      setDeletingDoc(data.filename)
      try {
        const res = await fetch(
          `${RAG_URL}/delete-by-filename?filename=${encodeURIComponent(data.filename)}&namespace=${data.namespace}`,
          { method: 'DELETE', headers: { 'X-Admin-Key': ADMIN_KEY } }
        )
        if (res.ok) {
          toast({ title: 'Document deleted', description: `"${data.filename}" removed.` })
          fetchDocs()
        } else {
          toast({ title: 'Delete failed', variant: 'destructive', description: 'Could not delete document.' })
        }
      } catch {
        toast({ title: 'Error', variant: 'destructive', description: 'An error occurred.' })
      } finally {
        setDeletingDoc(null)
      }
    } else if (type === 'namespace') {
      setLoading(true)
      try {
        const res = await fetch(`${RAG_URL}/delete-namespace?namespace=${data.namespace}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Key': ADMIN_KEY },
        })
        if (res.ok) {
          toast({ title: 'Namespace cleared', description: `All docs in ${data.namespace} deleted.` })
          fetchDocs()
        } else {
          const err = await res.json()
          toast({ title: 'Failed', variant: 'destructive', description: err.detail || 'Error clearing namespace.' })
        }
      } catch {
        toast({ title: 'Error', variant: 'destructive', description: 'Failed to clear namespace.' })
      } finally {
        setLoading(false)
      }
    }
  }

  // ── Derived state ────────────────────────────────────────────────
  const pendingCount = fileQueue.filter(f => f.status === 'pending').length
  const hasCompleted = fileQueue.some(f => f.status === 'done' || f.status === 'error')
  const nsLabel = namespaces.find(n => n.value === uploadNs)?.label ?? uploadNs

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Admin Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">Document Management</h1>
      <p className="text-muted-foreground mb-8">
        Upload PDFs and documents — they are embedded with OpenAI and stored in Pinecone for RAG retrieval.
      </p>

      {/* ── Upload card ── */}
      <div className="bg-foreground rounded-xl border border-foreground shadow-lg p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
          <h2 className="text-base font-semibold text-background">Upload Documents</h2>
          <div>
            <label className="block text-xs font-medium text-background/60 mb-1">Target Namespace</label>
            <select
              value={uploadNs}
              onChange={e => setUploadNs(e.target.value)}
              className="border border-white/20 rounded-lg px-3 py-1.5 text-sm bg-white/10 text-background focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
            >
              {namespaces.map(ns => (
                <option key={ns.value} value={ns.value} className="text-foreground bg-background">
                  {ns.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag & drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200',
            isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            isDragOver
              ? 'border-white bg-white/20 scale-[1.01]'
              : 'border-white/30 hover:border-white/60 hover:bg-white/5',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.csv,.doc,.docx"
            multiple
            onChange={handleFileInput}
            disabled={isUploading}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3 pointer-events-none">
            <div
              className={[
                'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
                isDragOver ? 'bg-white/30' : 'bg-white/10',
              ].join(' ')}
            >
              <svg className="w-7 h-7 text-background/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div>
              <p className="text-background font-semibold text-base">
                {isDragOver ? 'Drop files here' : 'Drop files here or click to browse'}
              </p>
              <p className="text-background/50 text-sm mt-1">
                PDF, TXT, DOC, DOCX — multiple files supported
              </p>
            </div>
          </div>
        </div>

        {/* File queue */}
        {fileQueue.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-background/70">{fileQueue.length} file(s) queued</p>
              {hasCompleted && (
                <button
                  onClick={clearCompleted}
                  className="text-xs text-background/50 hover:text-background transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>
            {fileQueue.map(qf => (
              <div key={qf.id} className="flex items-center gap-3 bg-white/10 rounded-lg px-4 py-2.5">
                {/* file icon */}
                <div className="shrink-0">
                  {qf.status === 'uploading' ? (
                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : qf.status === 'done' ? (
                    <span className="text-green-400 text-base">✓</span>
                  ) : qf.status === 'error' ? (
                    <span className="text-red-400 text-base">✗</span>
                  ) : (
                    <svg className="w-4 h-4 text-background/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-background truncate">{qf.file.name}</p>
                  <p className="text-xs text-background/50 mt-0.5">
                    {qf.status === 'pending' && `${(qf.file.size / 1024).toFixed(0)} KB · ready`}
                    {qf.status === 'uploading' && 'Extracting text, embedding & uploading to Pinecone…'}
                    {qf.status === 'done' &&
                      `${qf.chunks} chunks${qf.pages ? ` across ${qf.pages} pages` : ''} · stored`}
                    {qf.status === 'error' && `Error: ${qf.error}`}
                  </p>
                </div>
                {qf.status !== 'uploading' && (
                  <button
                    onClick={() => removeFromQueue(qf.id)}
                    className="shrink-0 text-background/40 hover:text-background transition-colors text-xl leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {pendingCount > 0 && (
          <div className="mt-5">
            <button
              onClick={handleUploadAll}
              disabled={isUploading}
              className="px-5 py-2 bg-white hover:bg-white/90 disabled:opacity-50 text-foreground rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm active:scale-[0.98]"
            >
              {isUploading
                ? 'Uploading…'
                : `Upload ${pendingCount} file${pendingCount > 1 ? 's' : ''} → ${nsLabel}`}
            </button>
          </div>
        )}
      </div>

      {/* ── Indexed documents list ── */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">Indexed Documents</h2>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {filterNs && (
              <button
                onClick={handleDeleteNamespace}
                disabled={loading}
                className="text-red-400 border border-red-400 hover:bg-red-500 hover:text-white px-3 py-1 rounded text-sm transition-colors font-medium disabled:opacity-50 shrink-0"
              >
                Delete All in Namespace
              </button>
            )}
            <select
              value={filterNs}
              onChange={e => setFilterNs(e.target.value)}
              className="border border-border/60 rounded-lg px-3 py-1.5 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            >
              <option value="">All Namespaces</option>
              {namespaces.map(ns => (
                <option key={ns.value} value={ns.value}>{ns.label}</option>
              ))}
            </select>
            <button
              onClick={fetchDocs}
              className="ml-auto sm:ml-0 text-muted-foreground hover:text-foreground text-sm transition-colors font-medium shrink-0"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground italic">
              No documents found. Upload one above.
            </div>
          ) : (
            docs.map((doc, i) => (
              <div
                key={i}
                className="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="w-full sm:w-auto overflow-hidden">
                  <p className="font-medium text-foreground text-sm truncate">{doc.filename}</p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border whitespace-nowrap">
                      {namespaces.find(n => n.value === doc.namespace)?.label || doc.namespace}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{doc.chunk_count} chunks</span>
                    {doc.timestamp && (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {doc.timestamp.substring(0, 10)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => handleView(doc)}
                    className="text-blue-500 border border-blue-500 hover:bg-blue-500 hover:text-white px-3 py-1.5 rounded text-sm transition-colors font-medium"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(doc.filename, doc.namespace)}
                    disabled={deletingDoc === doc.filename}
                    className="text-red-400 border border-red-400 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded text-sm disabled:opacity-50 transition-colors font-medium"
                  >
                    {deletingDoc === doc.filename ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* View document dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={(open: boolean) => { if (!open) setViewingDoc(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate">{viewingDoc?.filename}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-2">
            <span className="bg-muted px-2 py-0.5 rounded-full border border-border">
              {namespaces.find(n => n.value === viewingDoc?.namespace)?.label || viewingDoc?.namespace}
            </span>
            <span>{viewingDoc?.chunk_count} chunks</span>
            {viewingDoc?.timestamp && <span>{viewingDoc.timestamp.substring(0, 10)}</span>}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingChunks ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : docChunks.length > 0 ? (
              <div className="space-y-3">
                {docChunks.map((chunk, i) => (
                  <div key={i} className="bg-muted rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">Chunk {i + 1}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{chunk}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm italic">
                Content preview not available — the document is indexed in Pinecone but the raw chunks cannot be retrieved directly.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog
        open={confirmDelete.open}
        onOpenChange={open => setConfirmDelete(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete.type === 'file'
                ? `This will permanently delete "${confirmDelete.data.filename}" from ${confirmDelete.data.namespace}.`
                : `This will permanently delete ALL documents in ${confirmDelete.data.namespace}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
