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

type FeedbackEntry = {
  vector_id: string
  score: number
  question: string
  original_response: string
  user_correction: string
  improved_response: string
  timestamp: string
}
const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'
const renderMarkdown = (text: string) => {
  if (!text) return ''
  let formattedText = text
    .replace(/^### (.*$)/gim, '<h3 class="text-md font-bold my-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold my-2">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold my-2">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<ul class="list-disc pl-5 my-1"><li>$1</li></ul>')
    .replace(/^\d\. (.*$)/gim, '<ol class="list-decimal pl-5 my-1"><li>$1</li></ol>')
    .replace(/\n/gim, '<br />')
    .replace(/<\/ul>\s*<ul class="list-disc pl-5 my-1">/gim, '')
    .replace(/<\/ol>\s*<ol class="list-decimal pl-5 my-1">/gim, '')
  return formattedText
}

export default function AdminFeedbackPage() {
  const [feedbackEntries, setFeedbackEntries] = useState<FeedbackEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [vectorToDelete, setVectorToDelete] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${RAG_URL}/list-feedback?limit=1000`)
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setFeedbackEntries(data.feedback_entries || [])
      setTotal(data.count || 0)
    } catch (e) {
      console.error(e)
      setFeedbackEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  const handleDelete = (vector_id: string) => {
    setVectorToDelete(vector_id)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!vectorToDelete) return
    const vector_id = vectorToDelete
    setDeleteModalOpen(false)
    try {
      const res = await fetch(`${RAG_URL}/delete-feedback-by-id/?vector_id=${encodeURIComponent(vector_id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setFeedbackEntries(entries => entries.filter(e => e.vector_id !== vector_id))
        setTotal(t => t - 1)
        toast({ title: "Feedback Deleted", description: "The entry has been removed." })
      } else {
        toast({ title: "Error", description: "Failed to delete feedback.", variant: "destructive" })
      }
    } catch (e) {
      console.error(e)
      toast({ title: "Error", description: "An error occurred.", variant: "destructive" })
    } finally {
      setVectorToDelete(null)
    }
  }

  const scrollPanelClass = "h-64 overflow-y-auto text-sm text-foreground/85 p-4 rounded-lg border"

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">Feedback Management</h1>
      <p className="text-muted-foreground mb-8">Review and manage user feedback and corrections.</p>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <span className="text-sm text-muted-foreground">{total} feedback entries</span>
        <button
          onClick={fetchFeedback}
          className="text-muted-foreground hover:text-foreground text-sm transition-colors font-medium shrink-0"
        >
          Refresh Data
        </button>
      </div>

      {loading ? (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-12 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      ) : feedbackEntries.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm p-12 text-center text-muted-foreground">
          No feedback entries found. When users submit feedback, it will appear here.
        </div>
      ) : (
        <div className="space-y-5">
          {feedbackEntries.map(entry => (
            <div key={entry.vector_id} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">

              {/* Card Header */}
              <div className="px-6 py-4 bg-muted/40 border-b border-border/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="min-w-0 pr-2 overflow-hidden w-full sm:w-auto">
                  <p className="text-sm font-medium text-foreground/90 break-all">
                    Submitted: {new Date(entry.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5 break-all">
                    ID: {entry.vector_id}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(entry.vector_id)}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-red-500/20 shrink-0 self-end sm:self-auto"
                >
                  Delete
                </button>
              </div>

              {/* Card Body */}
              <div className="p-6">

                {/* Question */}
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Question</h3>
                  <p className="text-sm text-foreground bg-muted/50 p-4 rounded-lg border border-border/40">
                    {entry.question}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                  {/* Original AI Response */}
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Original AI Response</h3>
                    <div
                      className={`${scrollPanelClass} bg-muted/40 border-border/40`}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.original_response) }}
                    />
                  </div>

                  {/* User Correction */}
                  <div>
                    <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-2">User Correction</h3>
                    <div className={`${scrollPanelClass} bg-orange-500/5 border-orange-500/20`}>
                      {entry.user_correction}
                    </div>
                  </div>
                </div>

                {/* Improved Response */}
                <div className="bg-green-500/5 p-5 rounded-lg border border-green-500/20">
                  <h3 className="text-xs font-semibold text-green-400 uppercase tracking-widest mb-3">Improved Response (Generated by AI)</h3>
                  <div
                    className="text-sm text-foreground/85 bg-card/60 p-4 rounded-lg border border-green-500/10"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(entry.improved_response) }}
                  />
                </div>

              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Feedback Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this feedback entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVectorToDelete(null)} className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
