'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MemoizedReactMarkdown } from '@/components/ui/markdown'
import remarkGfm from 'remark-gfm'
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
import { FeedbackDialog } from '@/components/feedback-dialog'

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || ''

const ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting']

interface Conversation {
  id: number
  user_id: string
  user_email: string
  role: string
  question: string
  answer: string
  sources: string[]
  timestamp: string
}

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
  const [feedbackTarget, setFeedbackTarget] = useState<Conversation | null>(null)
  const { toast } = useToast()
  const limit = 20

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterRole) params.set('role', filterRole)
      params.set('limit', String(limit))
      params.set('offset', String(page * limit))

      const res = await fetch(`${RAG_URL}/admin/conversations?${params}`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      setConversations(data.conversations || [])
      setTotal(data.total || 0)
    } catch {
      setConversations([])
    } finally {
      setLoading(false)
    }
  }, [filterRole, page])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  const handleDelete = (id: number) => {
    setConfirmDelete({ open: true, id })
  }

  const executeDelete = async () => {
    const id = confirmDelete.id
    setConfirmDelete({ open: false, id: null })
    if (!id) return

    try {
      const res = await fetch(`${RAG_URL}/admin/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      if (res.ok) {
        toast({ title: "Log Deleted", description: "The conversation log has been removed." })
        fetchConversations()
      } else {
        toast({ title: "Delete Failed", description: "Failed to delete the log.", variant: "destructive" })
      }
    } catch (e) {
      toast({ title: "Error", description: "An error occurred.", variant: "destructive" })
    }
  }

  const roleBadgeColor: Record<string, string> = {
    admin:      'bg-purple-500/10 text-purple-400 border border-purple-500/20',
    management: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
    sales:      'bg-green-500/10 text-green-400 border border-green-500/20',
    support:    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
    operations: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
    accounting: 'bg-red-500/10 text-red-400 border border-red-500/20',
  }

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">Conversation Logs</h1>
      <p className="text-muted-foreground mb-8">QA review — browse all employee interactions with the assistant.</p>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setPage(0) }}
          className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{total} total conversations</span>
        <button onClick={fetchConversations} className="ml-auto text-muted-foreground hover:text-foreground text-sm transition-colors font-medium">Refresh</button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-12 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">No conversations recorded yet.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {conversations.map(conv => (
              <div key={conv.id} className="px-6 py-4">
                <div
                  className="flex items-start justify-between cursor-pointer group"
                  onClick={() => setExpanded(expanded === conv.id ? null : conv.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadgeColor[conv.role] || 'bg-muted text-muted-foreground'}`}>
                        {conv.role}
                      </span>
                      <span className="text-xs text-muted-foreground">{conv.user_email || conv.user_id}</span>
                      <span className="text-xs text-muted-foreground/60 ml-auto">{new Date(conv.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-foreground/90">{conv.question}</p>
                  </div>
                  <svg
                    className={`w-4 h-4 ml-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded === conv.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expanded === conv.id && (
                  <div className="mt-4 space-y-3">
                    <div className="bg-muted/50 rounded-lg p-4 border border-border/40">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Question</p>
                      <p className="text-sm text-foreground">{conv.question}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-4 border border-border/60">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Answer</p>
                      <div className="text-sm text-foreground mt-2">
                        <MemoizedReactMarkdown
                          // @ts-expect-error - Type incompatibility between remark plugin versions
                          remarkPlugins={[remarkGfm]}
                          className="prose-sm prose-neutral dark:prose-invert max-w-none"
                        >
                          {conv.answer}
                        </MemoizedReactMarkdown>
                      </div>
                    </div>
                    {conv.sources && conv.sources.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Sources:</span>
                        {conv.sources.map((s, i) => (
                          <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border/40">{s}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => setFeedbackTarget(conv)}
                        className="text-xs text-foreground/80 hover:text-foreground transition-colors font-medium"
                      >
                        Submit correction
                      </button>
                      <button onClick={() => handleDelete(conv.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium">
                        Delete Log
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / limit)}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {feedbackTarget && (
        <FeedbackDialog
          open={!!feedbackTarget}
          onOpenChange={open => {
            if (!open) setFeedbackTarget(null)
          }}
          mode="create"
          question={feedbackTarget.question}
          originalResponse={feedbackTarget.answer}
          onSaved={() => setFeedbackTarget(null)}
        />
      )}

      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation Log</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation log? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Log
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
