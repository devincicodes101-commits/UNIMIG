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
import { FeedbackDialog } from '@/components/feedback-dialog'

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || ''

const ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting']

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const renderAnswerHtml = (raw: string | null | undefined) => {
  if (!raw) return ''
  let t = escapeHtml(String(raw))
  t = t
    .replace(/^### (.*$)/gim, '<h3 class="text-md font-bold my-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold my-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold my-2">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 rounded">$1</code>')
    .replace(/^\- (.*$)/gim, '<ul class="list-disc pl-5 my-1"><li>$1</li></ul>')
    .replace(/^\d\. (.*$)/gim, '<ol class="list-decimal pl-5 my-1"><li>$1</li></ol>')
    .replace(/<\/ul>\s*<ul class="list-disc pl-5 my-1">/g, '')
    .replace(/<\/ol>\s*<ol class="list-decimal pl-5 my-1">/g, '')
    .replace(/\n/g, '<br />')
  return t
}

interface Turn {
  id: number
  chat_id: string | null
  user_id: string
  user_email: string
  role: string
  question: string
  answer: string
  sources: string[]
  timestamp: string
}

interface ChatSession {
  chat_id: string
  user_id: string
  user_email: string
  role: string
  first_question: string
  last_activity: string
  message_count: number
  messages: Turn[]
}

interface UserGroup {
  userKey: string
  sessions: ChatSession[]
  totalTurns: number
  lastActivity: string
}

function groupByUser(chats: ChatSession[]): UserGroup[] {
  const map: Record<string, UserGroup> = {}
  for (const chat of chats) {
    const key = chat.user_email || chat.user_id || 'Unknown'
    if (!map[key]) {
      map[key] = { userKey: key, sessions: [], totalTurns: 0, lastActivity: '' }
    }
    map[key].sessions.push(chat)
    map[key].totalTurns += chat.message_count
    if (chat.last_activity > map[key].lastActivity) {
      map[key].lastActivity = chat.last_activity
    }
  }
  return Object.values(map).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
}

const roleBadgeColor: Record<string, string> = {
  admin:      'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  management: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  sales:      'bg-green-500/10 text-green-400 border border-green-500/20',
  support:    'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  operations: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  accounting: 'bg-red-500/10 text-red-400 border border-red-500/20',
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`w-4 h-4 text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

export default function AdminConversationsPage() {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filterRole, setFilterRole] = useState('')
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; chatId: string | null }>({ open: false, chatId: null })
  const [feedbackTarget, setFeedbackTarget] = useState<Turn | null>(null)
  const { toast } = useToast()
  const limit = 20

  const fetchChats = useCallback(async () => {
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
      setChats(data.conversations || [])
      setTotal(data.total || 0)
    } catch {
      setChats([])
    } finally {
      setLoading(false)
    }
  }, [filterRole, page])

  useEffect(() => { fetchChats() }, [fetchChats])

  const toggleUser = (key: string) => {
    setExpandedUsers(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const toggleSession = (id: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleDelete = (chatId: string) => setConfirmDelete({ open: true, chatId })

  const executeDelete = async () => {
    const chatId = confirmDelete.chatId
    setConfirmDelete({ open: false, chatId: null })
    if (!chatId) return
    try {
      const res = await fetch(`${RAG_URL}/admin/conversations/${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      if (res.ok) {
        toast({ title: 'Chat Deleted', description: 'The chat session has been removed.' })
        fetchChats()
      } else {
        toast({ title: 'Delete Failed', description: 'Failed to delete the chat.', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'An error occurred.', variant: 'destructive' })
    }
  }

  const userGroups = groupByUser(chats)

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">Conversation Logs</h1>
      <p className="text-muted-foreground mb-8">Grouped by user → session → messages.</p>

      <div className="flex items-center gap-4 mb-6">
        <select
          value={filterRole}
          onChange={e => { setFilterRole(e.target.value); setPage(0) }}
          className="border border-border/60 rounded-lg px-3 py-2 text-sm bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        >
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{total} total conversations</span>
        <button onClick={fetchChats} className="ml-auto text-muted-foreground hover:text-foreground text-sm transition-colors font-medium">Refresh</button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="bg-card rounded-xl border border-border/60 px-6 py-12 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : userGroups.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/60 px-6 py-12 text-center text-muted-foreground">
            No conversations recorded yet.
          </div>
        ) : userGroups.map(group => {
          const userOpen = expandedUsers.has(group.userKey)
          return (
            <div key={group.userKey} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
              {/* User header */}
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggleUser(group.userKey)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground">
                    {group.userKey[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{group.userKey}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''} · {group.totalTurns} turn{group.totalTurns !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground/60">{new Date(group.lastActivity).toLocaleString()}</span>
                  <ChevronIcon open={userOpen} />
                </div>
              </div>

              {/* Sessions within this user */}
              {userOpen && (
                <div className="border-t border-border/40 divide-y divide-border/30">
                  {group.sessions.map((chat, idx) => {
                    const sessionOpen = expandedSessions.has(chat.chat_id)
                    return (
                      <div key={chat.chat_id} className="px-6 py-3 bg-muted/10">
                        {/* Session header */}
                        <div
                          className="flex items-center justify-between cursor-pointer group py-1"
                          onClick={() => toggleSession(chat.chat_id)}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-xs text-muted-foreground/50 w-5 shrink-0">#{idx + 1}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${roleBadgeColor[chat.role] || 'bg-muted text-muted-foreground'}`}>
                              {chat.role}
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {chat.message_count} turn{chat.message_count !== 1 ? 's' : ''}
                            </span>
                            <p className="text-sm text-foreground truncate font-medium">{chat.first_question}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className="text-xs text-muted-foreground/60">{new Date(chat.last_activity).toLocaleString()}</span>
                            <ChevronIcon open={sessionOpen} />
                          </div>
                        </div>

                        {/* Turns within this session */}
                        {sessionOpen && (
                          <div className="mt-3 space-y-3 pl-5">
                            {chat.messages.map(turn => (
                              <div key={turn.id} className="rounded-lg border border-border/40 overflow-hidden">
                                <div className="bg-muted/50 px-4 py-3 border-b border-border/40">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                                    User · {new Date(turn.timestamp).toLocaleString()}
                                  </p>
                                  <p className="text-sm text-foreground whitespace-pre-wrap">{turn.question}</p>
                                </div>
                                <div className="bg-muted/20 px-4 py-3">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Assistant</p>
                                  <div
                                    className="text-sm text-foreground prose-sm prose-neutral dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: renderAnswerHtml(turn.answer) }}
                                  />
                                  {turn.sources && turn.sources.length > 0 && (
                                    <div className="flex gap-2 flex-wrap mt-2">
                                      <span className="text-xs text-muted-foreground">Sources:</span>
                                      {turn.sources.map((s, i) => (
                                        <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border/40">{s}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex justify-end mt-2">
                                    <button
                                      onClick={() => setFeedbackTarget(turn)}
                                      className="text-xs text-foreground/80 hover:text-foreground transition-colors font-medium"
                                    >
                                      Submit correction for this turn
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <div className="flex justify-end pb-1">
                              <button
                                onClick={() => handleDelete(chat.chat_id)}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium"
                              >
                                Delete entire session
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {total > limit && (
        <div className="mt-4 flex items-center justify-between">
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

      {feedbackTarget && (
        <FeedbackDialog
          open={!!feedbackTarget}
          onOpenChange={open => { if (!open) setFeedbackTarget(null) }}
          mode="create"
          question={feedbackTarget.question}
          originalResponse={feedbackTarget.answer}
          conversationRole={feedbackTarget.role}
          onSaved={() => setFeedbackTarget(null)}
        />
      )}

      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Chat Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this chat session? All turns will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
