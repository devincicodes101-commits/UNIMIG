'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

const ALL_ROLES = ['admin', 'management', 'sales', 'support', 'operations', 'accounting', 'unassigned'] as const
type UserRole = typeof ALL_ROLES[number]

const ROLE_COLORS: Record<UserRole, string> = {
  admin:       'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  management:  'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  sales:       'bg-green-500/10 text-green-400 border border-green-500/20',
  support:     'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  operations:  'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  accounting:  'bg-red-500/10 text-red-400 border border-red-500/20',
  unassigned:  'bg-muted text-muted-foreground border border-border',
}

interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  created_at: string
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; userId: string; email: string }>({
    open: false,
    userId: '',
    email: ''
  })
  const { toast } = useToast()

  const fetchUsers = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const updateRole = async (userId: string, newRole: UserRole) => {
    setSavingId(userId)
    setMessage('')
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      setMessage(`Failed to update role: ${error.message}`)
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      setMessage('Role updated successfully')
      setTimeout(() => setMessage(''), 3000)
    }
    setSavingId(null)
  }

  const deleteUser = (userId: string, email: string) => {
    setConfirmDelete({ open: true, userId, email })
  }

  const executeDelete = async () => {
    const { userId } = confirmDelete
    setConfirmDelete(prev => ({ ...prev, open: false }))

    const { error } = await supabase.from('users').delete().eq('id', userId)
    if (error) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" })
      return
    }

    await fetch('/api/admin/users/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    toast({ title: "User Deleted", description: "The user has been successfully removed." })
    fetchUsers()
  }

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <Link href="/admin" className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-3 inline-block">
        ← Admin Dashboard
      </Link>
      <h1 className="text-3xl font-bold text-foreground tracking-tight">User Management</h1>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Assign roles to employees.</p>

      {message && (
        <div className="mb-3 px-4 py-2.5 bg-muted rounded-lg text-sm text-foreground border border-border/60">{message}</div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {ALL_ROLES.map(role => (
          <span key={role} className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${ROLE_COLORS[role]}`}>{role}</span>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="px-6 py-10 flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">No users yet. They will appear here after their first sign-in.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-foreground border-b border-border/60">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-background uppercase tracking-wide">User</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-background uppercase tracking-wide">Joined</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-background uppercase tracking-wide">Role</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold text-background uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">{user.name || '—'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={user.role}
                      onChange={e => updateRole(user.id, e.target.value as UserRole)}
                      disabled={savingId === user.id}
                      className="border border-border/60 rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring capitalize cursor-pointer disabled:opacity-50 bg-muted text-foreground transition-colors"
                    >
                      {ALL_ROLES.map(role => (
                        <option key={role} value={role} className="capitalize">{role}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      className="text-red-400 border border-red-400 hover:bg-red-500 hover:text-white px-2 py-1 rounded text-xs transition-colors font-medium"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AlertDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{confirmDelete.email}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="hover:bg-foreground hover:text-background">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
