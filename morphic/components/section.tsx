'use client'

import { cn } from '@/lib/utils'
import React from 'react'
import { ToolBadge } from './tool-badge'
import { Separator } from './ui/separator'

type SectionProps = {
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg'
  title?: string
  separator?: boolean
}

export const Section: React.FC<SectionProps> = ({
  children,
  className,
  size = 'md',
  title,
  separator = false
}) => {
  return (
    <>
      {separator && <Separator className="my-2 bg-primary/10" />}
      <section
        className={cn(
          ` ${size === 'sm' ? 'py-1' : size === 'lg' ? 'py-4' : 'py-2'}`,
          className
        )}
      >
        {title && (
          <h2 className="flex items-center leading-none py-2">
            {title}
          </h2>
        )}
        {children}
      </section>
    </>
  )
}

export function ToolArgsSection({
  children,
  tool,
  number
}: {
  children: React.ReactNode
  tool: string
  number?: number
}) {
  return (
    <Section size="sm" className="py-0 flex items-center justify-between">
      <ToolBadge tool={tool}>{children}</ToolBadge>
      {number && (
        <span className="text-sm text-muted-foreground">
          {number} results
        </span>
      )}
    </Section>
  )
}
