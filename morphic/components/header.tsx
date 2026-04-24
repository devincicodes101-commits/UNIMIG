"use client";

import { cn } from '@/lib/utils'
import Image from 'next/image'
import dynamic from 'next/dynamic'

const AuthStatus = dynamic(() => import('./auth/AuthStatus'), {
  ssr: false,
  loading: () => <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
})

export const Header = () => {
  return (
    <header className="fixed w-full z-50 h-12 flex justify-between items-center px-4 sm:px-6 backdrop-blur-md bg-white/90">
      <div>
        <a href="/" className="flex items-center gap-2 group">
          <div className="relative bg-white rounded-lg p-1 shadow-md border border-border/40 transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg">
            <Image
              src="/UNIMIG-logo.svg"
              alt="UNIMIG Logo"
              width={80}
              height={80}
              className="rounded-sm"
            />
          </div>
        </a>
      </div>
      <div className="flex items-center gap-3">
        <AuthStatus />
      </div>
    </header>
  )
}

export default Header
