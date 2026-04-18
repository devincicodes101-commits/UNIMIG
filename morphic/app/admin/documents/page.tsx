'use client'

import { useState, useEffect, useCallback } from 'react'
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

const DEFAULT_NAMESPACES: Namespace[] = [
  { value: 'general-namespace', label: 'General Namespace' },
  { value: 'sales-namespace', label: 'Sales Namespace' },
  { value: 'support-namespace', label: 'Support Namespace' },
  { value: 'operations-namespace', label: 'Operations Namespace' },
  { value: 'accounting-namespace', label: 'Accounting Namespace' },
]

export default function AdminDocumentsPage() {
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [namespaces, setNamespaces] = useState<Namespace[]>(DEFAULT_NAMESPACES)
  const [loading, setLoading] = useState(false)
  const [filterNs, setFilterNs] = useState('')
  const [inputType, setInputType] = useState<'file' | 'text'>('file')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadText, setUploadText] = useState('')
  const [uploadTextTitle, setUploadTextTitle] = useState('')
  const [uploadNs, setUploadNs] = useState('general-namespace')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<string>('')
  const [deletingDoc, setDeletingDoc] = useState<string | null>(null)
  const { toast } = useToast()

  const [confirmDelete, setConfirmDelete] = useState<{
    open: boolean;
    type: 'file' | 'namespace';
    data: { filename?: string; namespace: string };
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
          label: ns.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
        }))
        setNamespaces(nsList)
        // Set default upload namespace if not set
        if (nsList.length > 0 && !uploadNs) {
          setUploadNs(nsList[0].value)
        }
      }
    } catch (e) {
      console.error('Error fetching namespaces:', e)
    }
  }, [uploadNs])

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const url = filterNs
        ? `${RAG_URL}/admin/documents?namespace=${filterNs}`
        : `${RAG_URL}/admin/documents`
      const res = await fetch(url, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
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

  const handleUpload = async () => {
    if (inputType === 'file' && !uploadFile) return
    if (inputType === 'text' && !uploadText.trim()) return

    setUploading(true)
    setUploadResult('')
    try {
      const ts = new Date().toISOString()
      const form = new FormData()
      form.append('timestamp', ts)
      form.append('namespace', uploadNs)

      let endpoint = `${RAG_URL}/upload-pdf`

      if (inputType === 'text') {
        const fileName = uploadTextTitle.trim() ? `${uploadTextTitle.replace(/\s+/g, '_')}.txt` : `raw_text_${Date.now()}.txt`
        const blob = new Blob([uploadText], { type: 'text/plain' })
        form.append('file', blob, fileName)
        endpoint = `${RAG_URL}/upload-text`
      } else {
        form.append('file', uploadFile as File)
        const fileName = uploadFile!.name.toLowerCase()
        if (fileName.endsWith('.pdf')) {
          endpoint = `${RAG_URL}/upload-pdf`
        } else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
          endpoint = `${RAG_URL}/upload-docx`
        } else {
          endpoint = `${RAG_URL}/upload-text`
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'X-Admin-Key': ADMIN_KEY },
        body: form,
      })
      const data = await res.json()
      
      if (res.ok) {
        toast({
          title: "Upload Successful",
          description: `Uploaded ${data.chunks_stored} chunks to ${uploadNs}`,
        })
        fetchDocs()
        if (inputType === 'file') {
          setUploadFile(null)
        } else {
          setUploadText('')
          setUploadTextTitle('')
        }
      } else {
        toast({
          title: "Upload Failed",
          description: data.detail || "Something went wrong during upload",
          variant: "destructive"
        })
      }
    } catch (e: unknown) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : 'Upload failed',
        variant: "destructive"
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (filename: string, namespace: string) => {
    setConfirmDelete({
      open: true,
      type: 'file',
      data: { filename, namespace }
    })
  }

  const handleDeleteNamespace = async () => {
    if (!filterNs) return
    setConfirmDelete({
      open: true,
      type: 'namespace',
      data: { namespace: filterNs }
    })
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
          toast({ title: "Document Deleted", description: `"${data.filename}" has been removed.` })
          fetchDocs()
        } else {
          toast({ title: "Delete Failed", description: "Failed to delete the document.", variant: "destructive" })
        }
      } catch (e) {
        toast({ title: "Error", description: "An error occurred while deleting.", variant: "destructive" })
      } finally {
        setDeletingDoc(null)
      }
    } else if (type === 'namespace') {
      setLoading(true)
      try {
        const res = await fetch(`${RAG_URL}/delete-namespace?namespace=${data.namespace}`, {
          method: 'DELETE',
          headers: { 'X-Admin-Key': ADMIN_KEY }
        })
        if (res.ok) {
          toast({ title: "Namespace Cleared", description: `All documents in ${data.namespace} have been deleted.` })
          fetchDocs()
        } else {
          const errData = await res.json()
          toast({ title: "Action Failed", description: errData.detail || 'Failed to delete namespace', variant: "destructive" })
        }
      } catch (e) {
        toast({ title: "Error", description: 'Failed to delete namespace', variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
  }

  const inputClass = "block w-full border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">Document Management</h1>
      <p className="text-muted-foreground mb-8">Upload and manage documents in each role&apos;s knowledge namespace.</p>

      {/* Upload Card */}
      <div className="bg-foreground rounded-xl border border-foreground shadow-lg p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-5 gap-4">
          <h2 className="text-base font-semibold text-background">Upload Document</h2>
          <div className="flex bg-white/10 p-1 rounded-lg border border-white/10">
            <button
              onClick={() => setInputType('file')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inputType === 'file'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-background/50 hover:text-background'
                }`}
            >
              File Upload
            </button>
            <button
              onClick={() => setInputType('text')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${inputType === 'text'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-background/50 hover:text-background'
                }`}
            >
              Paste Text / Transcript
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            {inputType === 'file' ? (
              <>
                <label className="block text-sm font-medium text-background/60 mb-1.5">Document File (.pdf, .txt, .docx)</label>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.doc,.docx"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-background/50 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-white/15 file:text-background hover:file:bg-white/25 transition-colors cursor-pointer"
                />
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-background/60 mb-1.5">Title (Optional)</label>
                  <input
                    type="text"
                    value={uploadTextTitle}
                    onChange={(e) => setUploadTextTitle(e.target.value)}
                    placeholder="e.g. Loom — New Onboarding Walkthrough"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-background/60 mb-1.5">Content</label>
                  <p className="text-xs text-background/50 mb-2">
                    Paste raw text, notes, or a video transcript (Loom, Zoom, Meet, etc.). For Loom videos, use the &quot;Copy transcript&quot; option from the video menu.
                  </p>
                  <textarea
                    value={uploadText}
                    onChange={(e) => setUploadText(e.target.value)}
                    placeholder="Paste your text or video transcript here…"
                    className={`${inputClass} min-h-[160px] resize-y`}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-background/60 mb-1.5">Target Namespace</label>
            <select
              value={uploadNs}
              onChange={e => setUploadNs(e.target.value)}
              className={inputClass}
            >
              {namespaces.map(ns => (
                <option key={ns.value} value={ns.value}>{ns.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={uploading || (inputType === 'file' ? !uploadFile : !uploadText.trim())}
            className="px-5 py-2 bg-white hover:bg-white/90 disabled:opacity-40 text-foreground rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm active:scale-[0.98]"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>

      {/* Document List */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Indexed Documents</h2>
          <div className="flex items-center gap-3">
            {filterNs && (
              <button
                onClick={handleDeleteNamespace}
                disabled={loading}
                className="text-red-400 border border-red-400 hover:bg-red-500 hover:text-white px-3 py-1 rounded text-sm transition-colors font-medium disabled:opacity-50"
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
              {namespaces.map(ns => <option key={ns.value} value={ns.value}>{ns.label}</option>)}
            </select>
            <button onClick={fetchDocs} className="text-muted-foreground hover:text-foreground text-sm transition-colors font-medium">Refresh</button>
          </div>
        </div>
        <div className="divide-y divide-border/40">
          {loading ? (
            <div className="px-6 py-12 flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground italic">No documents found in this namespace. Upload one above.</div>
          ) : (
            docs.map((doc, i) => (
              <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div>
                  <p className="font-medium text-foreground text-sm">{doc.filename}</p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
                      {namespaces.find(n => n.value === doc.namespace)?.label || doc.namespace}
                    </span>
                    <span className="text-xs text-muted-foreground">{doc.chunk_count} chunks</span>
                    {doc.timestamp && <span className="text-xs text-muted-foreground">{doc.timestamp.substring(0, 10)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.filename, doc.namespace)}
                  disabled={deletingDoc === doc.filename}
                  className="text-red-400 border border-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-sm disabled:opacity-50 transition-colors font-medium"
                >
                  {deletingDoc === doc.filename ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete.type === 'file' 
                ? `This will permanently delete "${confirmDelete.data.filename}" from the ${confirmDelete.data.namespace}.`
                : `This will permanently delete ALL documents in the ${confirmDelete.data.namespace}. This action cannot be undone.`
              }
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
