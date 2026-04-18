'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

const RAG_URL = process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000'

export type FeedbackDialogMode = 'create' | 'edit'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: FeedbackDialogMode
  question: string
  originalResponse: string
  initialCorrection?: string
  vectorId?: string
  onSaved?: () => void
}

export function FeedbackDialog({
  open,
  onOpenChange,
  mode,
  question,
  originalResponse,
  initialCorrection = '',
  vectorId,
  onSaved
}: FeedbackDialogProps) {
  const [correction, setCorrection] = useState(initialCorrection)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      setCorrection(initialCorrection)
    }
  }, [open, initialCorrection])

  const submit = async () => {
    const trimmed = correction.trim()
    if (!trimmed) {
      toast({
        title: 'Correction required',
        description: 'Please enter the correct answer before submitting.',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    const qSnippet = question.slice(0, 80)
    console.log(
      `[feedback] submitting: mode=${mode} vectorId=${vectorId ?? 'n/a'} question="${qSnippet}${question.length > 80 ? '…' : ''}" correctionLen=${trimmed.length}`
    )
    try {
      let res: Response
      if (mode === 'create') {
        res = await fetch(`${RAG_URL}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            ai_response: originalResponse,
            correct_response: trimmed,
            timestamp: new Date().toISOString()
          })
        })
      } else {
        if (!vectorId) throw new Error('vectorId is required in edit mode')
        res = await fetch(`${RAG_URL}/update-feedback`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vector_id: vectorId,
            question,
            ai_response: originalResponse,
            correct_response: trimmed
          })
        })
      }

      console.log(`[feedback] response: ${res.status} ${res.statusText}`)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed with ${res.status}`)
      }

      toast({
        title: mode === 'create' ? 'Correction submitted' : 'Feedback updated',
        description:
          mode === 'create'
            ? 'Thanks — your correction has been saved to the feedback namespace.'
            : 'The feedback entry has been updated.'
      })
      onOpenChange(false)
      onSaved?.()
    } catch (err: any) {
      console.error('[feedback] error:', err?.message || err)
      toast({
        title: 'Submission failed',
        description: err?.message || 'Unable to save feedback. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Suggest a correction' : 'Edit feedback entry'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Provide the correct answer. It will be stored in the feedback namespace and prioritized on future matching queries.'
              : 'Update the correct answer. The feedback namespace entry will be re-embedded.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Question
            </label>
            <div className="text-sm bg-muted/50 border border-border/40 rounded-lg p-3 max-h-24 overflow-y-auto whitespace-pre-wrap">
              {question || <span className="text-muted-foreground italic">No question</span>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Original AI Response
            </label>
            <div className="text-sm bg-muted/40 border border-border/40 rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
              {originalResponse || <span className="text-muted-foreground italic">No response</span>}
            </div>
          </div>

          <div>
            <label
              htmlFor="feedback-correction"
              className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"
            >
              Correct Answer
            </label>
            <Textarea
              id="feedback-correction"
              value={correction}
              onChange={e => setCorrection(e.target.value)}
              placeholder="Type the correct or improved answer here…"
              rows={6}
              className="resize-none"
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={submitting}>
            {submitting
              ? mode === 'create'
                ? 'Submitting…'
                : 'Saving…'
              : mode === 'create'
                ? 'Submit correction'
                : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
