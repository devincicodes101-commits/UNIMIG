'use client'

import { CHAT_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useChat } from 'ai/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ChatShare } from './chat-share'
import { FeedbackDialog } from './feedback-dialog'
import { Button } from './ui/button'

interface MessageActionsProps {
  message: string
  chatId?: string
  enableShare?: boolean
  className?: string
  question?: string
}

export function MessageActions({
  message,
  chatId,
  enableShare,
  className,
  question = ''
}: MessageActionsProps) {
  const { isLoading } = useChat({
    id: CHAT_ID
  })
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(message)
    toast.success('Message copied to clipboard')
  }

  if (isLoading) {
    return <div className="size-10" />
  }

  return (
    <>
      <div className={cn('flex items-center gap-1.5 mt-1 ml-1', className)}>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 hover:border-border hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Copy
        </button>
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-muted-foreground border border-border/50 hover:border-border hover:text-foreground hover:bg-muted/60 transition-all duration-150"
          title="Suggest a correction for this response"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Suggest correction
        </button>
        {enableShare && chatId && <ChatShare chatId={chatId} />}
      </div>
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        mode="create"
        question={question}
        originalResponse={message}
      />
    </>
  )
}
