'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'

export default function PendingPage() {
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    await signOut({ callbackUrl: '/auth/login' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full bg-white shadow-lg shadow-black/5 border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 bg-amber-50 border border-amber-200 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Account Pending</h1>
        <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
          Your account has been created but a role hasn&apos;t been assigned yet.
          Please contact your administrator to get access.
        </p>
        <p className="text-xs text-muted-foreground/70 mb-7">
          Once your admin assigns your role, click below to sign in again.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="inline-block px-6 py-2.5 bg-foreground text-background rounded-xl hover:bg-foreground/90 transition-all text-sm font-semibold disabled:opacity-50 shadow-sm active:scale-[0.98]"
        >
          {signingOut ? 'Signing out...' : 'Sign out & Sign in again'}
        </button>
      </div>
    </div>
  )
}
