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
    <div className={cn("flex flex-col gap-1", isCorrected && "relative")}>
      {isCorrected && (
        <div className="absolute -left-8 top-0 flex items-center text-green-500 text-xs" title="This response has been corrected">
          Corrected
        </div>
      )}
      <div className={cn(isCorrected && "border-l-2 border-green-500 pl-2")}>
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
  ) : (
    <DefaultSkeleton />
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
