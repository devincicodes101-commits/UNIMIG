'use client'

import { useState } from 'react'
import Link from 'next/link'

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || ''

const ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting']

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 0.5 ? 'bg-green-500/15 text-green-400 border-green-500/30' :
    score >= 0.3 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' :
    score >= 0.2 ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                   'bg-red-500/15 text-red-400 border-red-500/30'
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${color}`}>
      {score.toFixed(4)}
    </span>
  )
}

export default function AdminDebugPage() {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('admin')
  const [overrideNs, setOverrideNs] = useState('')
  const [retrievalResult, setRetrievalResult] = useState<any>(null)
  const [retrievalLoading, setRetrievalLoading] = useState(false)
  const [retrievalError, setRetrievalError] = useState('')

  const [verifyNs, setVerifyNs] = useState('')
  const [verifyFilename, setVerifyFilename] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const runRetrieval = async () => {
    if (!query.trim()) return
    setRetrievalLoading(true)
    setRetrievalError('')
    setRetrievalResult(null)
    try {
      const params = new URLSearchParams({ query, role })
      if (overrideNs.trim()) params.set('override_namespace', overrideNs.trim())
      const res = await fetch(`${RAG_URL}/admin/debug-retrieval?${params}`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || res.statusText)
      setRetrievalResult(data)
    } catch (e: any) {
      setRetrievalError(e.message)
    } finally {
      setRetrievalLoading(false)
    }
  }

  const runVerify = async () => {
    setVerifyLoading(true)
    setVerifyError('')
    setVerifyResult(null)
    try {
      const params = new URLSearchParams()
      if (verifyNs.trim()) params.set('namespace', verifyNs.trim())
      if (verifyFilename.trim()) params.set('filename', verifyFilename.trim())
      const res = await fetch(`${RAG_URL}/admin/verify-index?${params}`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || res.statusText)
      setVerifyResult(data)
    } catch (e: any) {
      setVerifyError(e.message)
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto pt-4 pb-16 px-6 space-y-10">
      <div>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
        <h1 className="text-3xl font-bold mt-2 mb-1 text-foreground">Retrieval Debugger</h1>
        <p className="text-muted-foreground text-sm">Diagnose why a question returns &quot;not mentioned&quot; — trace the full pipeline from query → Pinecone → chunks.</p>
      </div>

      {/* ── Section 1: Retrieval trace ── */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="text-base font-semibold text-foreground">1 — Full Retrieval Pipeline Trace</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enter a question to see expanded query, Pinecone hits per namespace, similarity scores, and top chunks.</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            rows={2}
            placeholder="e.g. How do I make sure only management can access a confidential document?"
            className="w-full bg-muted border border-border/60 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="flex flex-wrap gap-3">
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground focus:outline-none"
            >
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input
              value={overrideNs}
              onChange={e => setOverrideNs(e.target.value)}
              placeholder="Override namespace (optional)"
              className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none w-56"
            />
            <button
              onClick={runRetrieval}
              disabled={retrievalLoading || !query.trim()}
              className="ml-auto px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {retrievalLoading ? 'Running…' : 'Run Trace'}
            </button>
          </div>
          {retrievalError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{retrievalError}</p>
          )}
        </div>

        {retrievalResult && (
          <div className="border-t border-border/40 px-6 py-5 space-y-6">
            {/* Expanded query */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">HyDE Expanded Query</p>
              <pre className="text-xs text-foreground bg-muted rounded-lg p-3 whitespace-pre-wrap leading-relaxed">{retrievalResult.expanded_query}</pre>
            </div>

            {/* Summary row */}
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="text-muted-foreground">Role: <span className="text-foreground font-medium">{retrievalResult.role}</span></span>
              <span className="text-muted-foreground">Namespaces: <span className="text-foreground font-medium">{retrievalResult.namespaces_searched.join(', ')}</span></span>
              <span className="text-muted-foreground">Total candidates: <span className="text-foreground font-medium">{retrievalResult.total_candidates}</span></span>
              <span className="text-muted-foreground">Above 0.20 threshold: <span className="text-foreground font-medium">{retrievalResult.above_threshold}</span></span>
            </div>

            {/* Top 10 global */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Top 10 Global Results</p>
              <div className="space-y-2">
                {retrievalResult.top_10_global.length === 0 && (
                  <p className="text-sm text-red-400">No results returned — document may not be indexed in this namespace.</p>
                )}
                {retrievalResult.top_10_global.map((r: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/40 overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-muted-foreground/50 w-4 shrink-0">#{i + 1}</span>
                      <ScoreBadge score={r.score} />
                      <span className="text-xs text-foreground font-medium">{r.filename ?? 'feedback'}</span>
                      {r.chunk_index != null && <span className="text-xs text-muted-foreground">chunk {r.chunk_index}</span>}
                      {r.namespace && <span className="text-xs text-muted-foreground/60">{r.namespace}</span>}
                    </div>
                    <div className="px-3 py-2 bg-muted/10">
                      <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed font-mono">{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-namespace breakdown */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Results by Namespace</p>
              <div className="space-y-4">
                {Object.entries(retrievalResult.results_by_namespace).map(([ns, hits]: [string, any]) => (
                  <div key={ns}>
                    <p className="text-xs font-medium text-foreground mb-1">{ns} <span className="text-muted-foreground">({hits.length} hits)</span></p>
                    {hits.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-2">No matches in this namespace.</p>
                    ) : (
                      <div className="space-y-1 pl-2">
                        {hits.slice(0, 5).map((h: any, j: number) => (
                          <div key={j} className="flex items-start gap-2 text-xs">
                            <ScoreBadge score={h.score} />
                            <span className="text-muted-foreground shrink-0">{h.filename} #{h.chunk_index}</span>
                            <span className="text-foreground/60 truncate">{h.text_preview?.slice(0, 120)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Verify index ── */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40">
          <h2 className="text-base font-semibold text-foreground">2 — Verify Pinecone Index</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Confirm which documents are actually indexed and in which namespace. Leave fields blank to check all.</p>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              value={verifyNs}
              onChange={e => setVerifyNs(e.target.value)}
              placeholder="Namespace (e.g. management-namespace)"
              className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none w-72"
            />
            <input
              value={verifyFilename}
              onChange={e => setVerifyFilename(e.target.value)}
              placeholder="Filename filter (optional)"
              className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none w-64"
            />
            <button
              onClick={runVerify}
              disabled={verifyLoading}
              className="ml-auto px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {verifyLoading ? 'Checking…' : 'Check Index'}
            </button>
          </div>
          {verifyError && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{verifyError}</p>
          )}
        </div>

        {verifyResult && (
          <div className="border-t border-border/40 px-6 py-5 space-y-5">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">Index: <span className="text-foreground font-medium">{verifyResult.index_name}</span></span>
              <span className="text-muted-foreground">Total vectors: <span className="text-foreground font-medium">{verifyResult.total_vectors.toLocaleString()}</span></span>
            </div>
            {Object.entries(verifyResult.namespaces).map(([ns, info]: [string, any]) => (
              <div key={ns}>
                <p className="text-sm font-semibold text-foreground mb-1">
                  {ns}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {info.vector_count_pinecone !== 'N/A' ? `${info.vector_count_pinecone} vectors in Pinecone` : ''}
                  </span>
                </p>
                {info.documents.length === 0 ? (
                  <p className="text-xs text-red-400 pl-2">No documents found — this namespace may be empty or the document was never indexed.</p>
                ) : (
                  <div className="space-y-2 pl-2">
                    {info.documents.map((doc: any, i: number) => (
                      <div key={i} className="rounded-lg border border-border/40 px-3 py-2">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="text-sm font-medium text-foreground">{doc.filename}</span>
                          <span className="text-xs text-muted-foreground">{doc.chunks_found} chunks found</span>
                          {doc.total_chunks_meta && doc.chunks_found < doc.total_chunks_meta && (
                            <span className="text-xs text-red-400">⚠ expected {doc.total_chunks_meta}</span>
                          )}
                          {doc.timestamp && <span className="text-xs text-muted-foreground/60">{new Date(doc.timestamp).toLocaleString()}</span>}
                        </div>
                        <p className="text-xs text-foreground/60 font-mono leading-relaxed">{doc.sample_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
