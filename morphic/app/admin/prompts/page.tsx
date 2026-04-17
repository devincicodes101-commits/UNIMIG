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

const ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting']

type PromptsMap = Record<string, string>

export default function AdminPromptsPage() {
  const [prompts, setPrompts] = useState<PromptsMap>({})
  const [selectedRole, setSelectedRole] = useState('sales')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const { toast } = useToast()

  const fetchPrompts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${RAG_URL}/admin/prompts`, {
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      setPrompts(data.prompts || {})
      setEditValue(data.prompts?.[selectedRole] || '')
    } catch {
      setMessage('Failed to load prompts')
    } finally {
      setLoading(false)
    }
  }, [selectedRole])

  useEffect(() => { fetchPrompts() }, [fetchPrompts])

  useEffect(() => {
    setEditValue(prompts[selectedRole] || '')
    setMessage('')
  }, [selectedRole, prompts])

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch(`${RAG_URL}/admin/prompt/${selectedRole}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify({ prompt: editValue }),
      })
      if (res.ok) {
        toast({ title: "Prompt Saved", description: `Custom prompt for "${selectedRole}" has been updated.` })
        setPrompts(prev => ({ ...prev, [selectedRole]: editValue }))
      } else {
        const err = await res.json()
        toast({ title: "Save Failed", description: err.detail, variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to save prompt.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetModalOpen(true)
  }

  const confirmReset = async () => {
    setResetModalOpen(false)
    setSaving(true)
    try {
      const res = await fetch(`${RAG_URL}/admin/prompt/${selectedRole}/reset`, {
        method: 'DELETE',
        headers: { 'X-Admin-Key': ADMIN_KEY },
      })
      const data = await res.json()
      if (res.ok) {
        setEditValue(data.prompt)
        setPrompts(prev => ({ ...prev, [selectedRole]: data.prompt }))
        toast({ title: "Prompt Reset", description: `Reset to default for "${selectedRole}"` })
      } else {
        toast({ title: "Reset Failed", description: "Could not reset to default.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Failed to reset prompt.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Admin Dashboard</Link>
      </div>
      <h1 className="text-3xl font-bold mb-1.5 text-foreground">System Prompt Management</h1>
      <p className="text-muted-foreground mb-8">
        Customize the AI assistant&apos;s behaviour and tone for each role. Changes take effect immediately.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Role Selector */}
        <div className="md:col-span-1">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Roles</h2>
          <nav className="space-y-1">
            {ROLES.map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 capitalize ${
                  selectedRole === role
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {role}
              </button>
            ))}
          </nav>
        </div>

        {/* Prompt Editor */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-card rounded-xl border border-border/60 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-base font-semibold text-foreground capitalize">
                {selectedRole} — System Prompt
              </h2>
              <button
                onClick={handleReset}
                disabled={saving}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-40 shrink-0 self-start sm:self-auto"
              >
                Reset to Default
              </button>
            </div>

            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
              </div>
            ) : (
              <textarea
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                rows={10}
                className="w-full border border-border/60 rounded-lg px-4 py-3 text-sm bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono transition-colors"
                placeholder="Enter the system prompt for this role..."
              />
            )}

            <div className="mt-4 flex items-center gap-4">
              <button
                onClick={handleSave}
                disabled={saving || loading}
                className="px-5 py-2 bg-foreground hover:bg-foreground/90 disabled:opacity-50 text-background rounded-lg text-sm font-medium transition-all duration-200 shadow-sm active:scale-[0.98]"
              >
                {saving ? 'Saving...' : 'Save Prompt'}
              </button>
              {message && <span className="text-sm text-foreground/80">{message}</span>}
            </div>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
            <p className="text-xs text-amber-400/90 leading-relaxed">
              <strong>Tip:</strong> The system prompt sets the AI&apos;s persona and constraints for this role.
              Be specific about what this role can and cannot discuss. Changes are immediate — no re-deployment needed.
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AlertDialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Prompt to Default</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the &quot;{selectedRole}&quot; prompt to its default value? Your current customizations will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset} className="bg-foreground hover:bg-foreground/90 text-background">
              Reset Prompt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
