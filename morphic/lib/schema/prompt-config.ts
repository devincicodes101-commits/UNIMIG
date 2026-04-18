import { z } from 'zod'

export const promptConfigSchema = z.object({
  id: z.string().optional(),
  behavior: z.string().min(1, "Behavior is required"),
  tone: z.string().min(1, "Tone is required"),
  numReplies: z.number().int().min(1).max(5),
  additionalInstructions: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type PromptConfig = z.infer<typeof promptConfigSchema>

export const promptConfigFormSchema = promptConfigSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

export type PromptConfigForm = z.infer<typeof promptConfigFormSchema> 