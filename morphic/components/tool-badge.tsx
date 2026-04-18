import React from 'react'
import { Badge } from './ui/badge'

type ToolBadgeProps = {
  tool: string
  children: React.ReactNode
  className?: string
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  tool,
  children,
  className
}) => {
  return (
    <Badge className={className} variant={'secondary'}>
      <span className="ml-1">{children}</span>
    </Badge>
  )
}
