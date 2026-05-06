'use client'

import { cn } from '@/lib/utils'
import { Message } from 'ai'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import Textarea from 'react-textarea-autosize'
import { Button } from './ui/button'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'

interface ChatPanelProps {
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  messages: Message[]
  setMessages: (messages: Message[]) => void
  query?: string
  stop: () => void
  append: (message: any) => void
}

export function ChatPanel({
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  messages,
  setMessages,
  query,
  stop,
  append
}: ChatPanelProps) {
  const [showEmptyScreen, setShowEmptyScreen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isFirstRender = useRef(true)
  const [isComposing, setIsComposing] = useState(false) // Composition state
  const [enterDisabled, setEnterDisabled] = useState(false) // Disable Enter after composition ends
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const isUnassigned = session?.user?.role === 'unassigned'

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<{ question: string, answer: string } | null>(null)

  const handleCompositionStart = () => setIsComposing(true)

  const handleCompositionEnd = () => {
    setIsComposing(false)
    setEnterDisabled(true)
    setTimeout(() => {
      setEnterDisabled(false)
    }, 300)
  }

  const handleNewChat = () => {
    setMessages([])
    router.push('/')
  }

  const handleOpenFeedback = (question: string, answer: string) => {
    setSelectedMessage({ question, answer })
    setShowFeedback(true)
  }

  const handleSubmitFeedback = async () => {
    if (!selectedMessage || !feedbackText.trim()) return

    try {
      setSubmittingFeedback(true)

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: selectedMessage.question,
          ai_response: selectedMessage.answer,
          correct_response: feedbackText,
          timestamp: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      const result = await response.json()

      // Update the messages with the improved response
      if (result.improved_response) {
        // Create updated messages directly
        const updatedMessages = messages.map(msg => {
          if (msg.role === 'assistant' && msg.content === selectedMessage.answer) {
            // Create a copy of the message with updated content
            const updatedMsg = { ...msg };
            // Update the content property
            updatedMsg.content = result.improved_response;
            // Add corrected as a custom property
            (updatedMsg as any).corrected = true;
            return updatedMsg;
          }
          return msg;
        });
        // Set the updated messages
        setMessages(updatedMessages);
        setMessages([])
        router.push('/')
      }

      // Close the feedback dialog
      setShowFeedback(false)
      setFeedbackText('')
      setSelectedMessage(null)

    } catch (error) {
      console.error('Error submitting feedback:', error)
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const isToolInvocationInProgress = () => {
    // Only treat a tool call as "in progress" while the request is actually
    // streaming. If the previous request died (Vercel timeout) and left a
    // stuck tool-invocation in the saved messages, the input would otherwise
    // be permanently disabled and the user could not submit anything new.
    if (!isLoading) return false
    if (!messages.length) return false

    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'assistant' || !lastMessage.parts) return false

    const parts = lastMessage.parts
    const lastPart = parts[parts.length - 1]

    return (
      lastPart?.type === 'tool-invocation' &&
      lastPart?.toolInvocation?.state === 'call'
    )
  }

  // if query is not empty, submit the query
  useEffect(() => {
    if (isFirstRender.current && query && query.trim().length > 0) {
      append({
        role: 'user',
        content: query
      })
      isFirstRender.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Get the last user question and AI response pair
  const getLastMessagePair = () => {
    if (messages.length < 2) return null;

    // Find the last user and assistant message pair
    let userIndex = -1;
    let assistantIndex = -1;

    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && assistantIndex === -1) {
        assistantIndex = i;
      } else if (messages[i].role === 'user' && userIndex === -1 && assistantIndex !== -1) {
        userIndex = i;
        break;
      }
    }

    if (userIndex !== -1 && assistantIndex !== -1) {
      return {
        question: messages[userIndex].content,
        answer: messages[assistantIndex].content
      };
    }

    return null;
  }

  const lastMessagePair = getLastMessagePair();

  return (
    <div
      className={cn(
        'mx-auto w-full',
        messages.length > 0
          ? 'fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-border/60 shadow-[0_-4px_24px_-4px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]'
          : 'fixed bottom-8 left-0 right-0 top-14 flex flex-col items-center justify-center hero-glow'
      )}
    >
      {messages.length === 0 && (
        <div className="mb-10 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center space-y-6">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tighter text-foreground animate-in fade-in duration-700">
              Hi I am UNIMIG!
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-lg font-medium">
              Welcome to the UNIMIG Intelligent Assistant.
              <br />
              <span className="text-foreground/80">I am here to assist you, feel free to ask anything!</span>
            </p>
          </div>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className={cn(
          'max-w-3xl w-full mx-auto relative',
          messages.length > 0 ? 'px-2 pb-4 pt-2' : 'px-6'
        )}
      >
        {isUnassigned && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-md rounded-3xl m-2">
            <div className="text-center p-6 bg-card/80 rounded-2xl shadow-xl border border-border/60 max-w-sm backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-3" />
              <h3 className="text-base font-semibold mb-1.5">Pending Approval</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your account is currently unassigned. Please contact your administrator to get a role assigned before using the UNIMIG assistant.
              </p>
            </div>
          </div>
        )}

        <div className="relative flex flex-col w-full gap-2 bg-white/90 backdrop-blur-sm rounded-[24px] border border-gray-200/80 shadow-xl shadow-black/[0.06] transition-all duration-300 focus-glow hover:shadow-2xl hover:shadow-black/[0.08] hover:border-[hsl(var(--unimig-green)/0.3)]">
          <Textarea
            ref={inputRef}
            name="input"
            rows={2}
            maxRows={5}
            tabIndex={0}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder="Ask a question..."
            spellCheck={false}
            value={input}
            disabled={isLoading || isToolInvocationInProgress() || isUnassigned}
            className="resize-none w-full min-h-12 bg-transparent border-0 p-4 text-sm placeholder:text-muted-foreground/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            onChange={e => {
              handleInputChange(e)
              setShowEmptyScreen(e.target.value.length === 0)
            }}
            onKeyDown={e => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !isComposing &&
                !enterDisabled
              ) {
                if (input.trim().length === 0) {
                  e.preventDefault()
                  return
                }
                e.preventDefault()
                const textarea = e.target as HTMLTextAreaElement
                textarea.form?.requestSubmit()
              }
            }}
            onFocus={() => setShowEmptyScreen(true)}
            onBlur={() => setShowEmptyScreen(false)}
          />

          {/* Bottom menu area */}
          <div className="flex items-center justify-end gap-2 px-3 pb-3">
              {messages.length > 0 && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNewChat}
                  className="shrink-0 rounded-xl group border-border/60 hover:border-foreground/40 hover:bg-foreground/5 transition-all duration-300 hover:scale-105 active:scale-95"
                  type="button"
                  disabled={isLoading || isToolInvocationInProgress()}
                >
                  <span className="text-xs font-medium">New</span>
                </Button>
              )}
              <Button
                type={isLoading ? 'button' : 'submit'}
                size={'icon'}
                variant={'outline'}
                className={cn(
                  isLoading && 'animate-pulse',
                  'aspect-square w-10 h-10 min-w-[2.5rem] p-0 rounded-full border-border/60 transition-all duration-300 hover:scale-105 active:scale-95',
                  !isLoading && input.length > 0 && 'border-foreground bg-foreground text-background hover:!bg-foreground hover:!text-background'
                )}
                disabled={
                  (input.length === 0 && !isLoading) ||
                  isToolInvocationInProgress()
                }
                onClick={isLoading ? stop : undefined}
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <ArrowRight size={20} />
                )}
              </Button>
          </div>
        </div>
      </form>
    </div>
  )
}
