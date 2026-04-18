'use client'

import { CHAT_ID } from '@/lib/constants'
import { useChat } from '@ai-sdk/react'
import { Message } from 'ai/react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChatMessages } from './chat-messages'
import { ChatPanel } from './chat-panel'

export function Chat({
  id,
  savedMessages = [],
  query,
}: {
  id: string
  savedMessages?: Message[]
  query?: string
}) {
  const [isNavigating, setIsNavigating] = useState(false)
  const hasInitialized = useRef(false)
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    stop,
    append,
    data,
    setData,
    addToolResult
  } = useChat({
    initialMessages: savedMessages,
    id: CHAT_ID,
    body: {
      id,
      timestamp: Date.now() // Add timestamp to prevent caching
    },
    onFinish: () => {
      if (window.location.pathname === '/') {
        window.history.replaceState({}, '', `/search/${id}`)
      }
    },
    onError: error => {
      toast.error(`Error in chat: ${error.message}`)
    },
    sendExtraMessageFields: false, // Disable extra message fields,
    experimental_throttle: 100 // Disable throttling to improve performance
  })

  const isLoading = status === 'submitted' || status === 'streaming'

  // Only restore savedMessages once on mount, and only if there are actual saved messages
  // This prevents the effect from wiping live chat messages with an empty array
  useEffect(() => {
    if (!hasInitialized.current && savedMessages.length > 0) {
      setMessages(savedMessages)
    }
    hasInitialized.current = true
  }, [id, savedMessages, setMessages])

  const onQuerySelect = (query: string) => {
    append({
      role: 'user',
      content: query
    })
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setData(undefined) // reset data to clear tool call
    handleSubmit(e)
  }

  return (
    <div className="flex flex-col w-full max-w-3xl pt-4 pb-32 mx-auto stretch">
      {isNavigating && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
        </div>
      )}
      <ChatMessages
        messages={messages}
        data={data}
        onQuerySelect={onQuerySelect}
        isLoading={isLoading}
        chatId={id}
        addToolResult={addToolResult}
      />
      <ChatPanel
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={onSubmit}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        stop={stop}
        query={query}
        append={append}
      />
    </div>
  )
}
