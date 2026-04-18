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
      <div className={cn('flex items-center gap-0.5 self-end', className)}>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleCopy}
          className="rounded-full text-xs"
        >
          Copy
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFeedbackOpen(true)}
          className="rounded-full text-xs"
          title="Suggest a correction for this response"
        >
          Suggest correction
        </Button>
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
