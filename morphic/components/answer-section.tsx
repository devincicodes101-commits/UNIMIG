'use client'

import { CollapsibleMessage } from './collapsible-message'
import { DefaultSkeleton } from './default-skeleton'
import { BotMessage } from './message'
import { MessageActions } from './message-actions'
import { cn } from '@/lib/utils'

export type AnswerSectionProps = {
  content: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  chatId?: string
  showActions?: boolean
  isCorrected?: boolean
  question?: string
}

export function AnswerSection({
  content,
  isOpen,
  onOpenChange,
  chatId,
  showActions = true, // Default to true for backward compatibility
  isCorrected = false,
  question = ''
}: AnswerSectionProps) {
  const enableShare = process.env.NEXT_PUBLIC_ENABLE_SHARE === 'true'

  const message = content ? (
    <div className="flex gap-3 mb-1">
      {/* AI avatar */}
      <div className="shrink-0 w-7 h-7 rounded-full bg-foreground/10 border border-border/40 flex items-center justify-center mt-1">
        <span className="text-[10px] font-bold text-foreground/70 tracking-tight">AI</span>
      </div>

      <div className={cn("flex-1 flex flex-col gap-1", isCorrected && "relative")}>
        {isCorrected && (
          <span className="text-xs text-green-500 font-medium">✓ Corrected response</span>
        )}
        <div className={cn(
          "bg-muted/50 border border-border/30 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm",
          isCorrected && "border-l-2 border-l-green-500"
        )}>
          <BotMessage message={content} />
        </div>
        {showActions && (
          <MessageActions
            message={content}
            chatId={chatId}
            enableShare={enableShare}
            question={question}
          />
        )}
      </div>
    </div>
  ) : (
    <div className="flex gap-3 mb-1">
      <div className="shrink-0 w-7 h-7 rounded-full bg-foreground/10 border border-border/40 flex items-center justify-center mt-1">
        <span className="text-[10px] font-bold text-foreground/70 tracking-tight">AI</span>
      </div>
      <div className="flex-1">
        <DefaultSkeleton />
      </div>
    </div>
  )
  return (
    <CollapsibleMessage
      role="assistant"
      isCollapsible={false}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      showBorder={false}
      showIcon={false}
    >
      {message}
    </CollapsibleMessage>
  )
}
