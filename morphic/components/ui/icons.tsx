'use client'

import { cn } from '@/lib/utils'
import Image from 'next/image'

function IconLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/UNIMIG-logo.svg"
      alt="UNIMIG Logo"
      width={20}
      height={20}
      className={cn('h-4 w-4 object-contain', className)}
    />
  )
}

export { IconLogo }
