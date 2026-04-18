'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { promptConfigFormSchema, type PromptConfigForm } from '@/lib/schema/prompt-config'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

export default function PromptConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  // Setup form with react-hook-form and zod validation
  const form = useForm<PromptConfigForm>({
    resolver: zodResolver(promptConfigFormSchema),
    defaultValues: {
      behavior: '',
      tone: '',
      numReplies: 3,
      additionalInstructions: ''
    }
  })

  // Load existing config when page loads
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/prompt-config')
        
        if (!response.ok) {
          throw new Error('Failed to fetch prompt configuration')
        }
        
        const data = await response.json()
        
        if (data && Object.keys(data).length > 0) {
          // Set form values with existing data
          form.reset({
            behavior: data.behavior || '',
            tone: data.tone || '',
            numReplies: data.numReplies || 3,
            additionalInstructions: data.additionalInstructions || ''
          })
        }
      } catch (error) {
        console.error('Error fetching prompt config:', error)
        toast.error('Failed to load configuration', {
          description: 'Please try refreshing the page.'
        })
      }
    }
    
    fetchConfig()
  }, [form])

  // Submit form data
  const onSubmit = async (data: PromptConfigForm) => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/prompt-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }
      
      toast.success('Prompt configuration saved successfully')
      router.refresh()
    } catch (error) {
      console.error('Error saving config:', error)
      toast.error('Failed to save configuration', {
        description: 'Please try again.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-10">
      <div className="mb-8">
      <Link href="/">
        <Button className="mb-4">Back to Home</Button>
      </Link>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>AI Sales Coach Configuration</CardTitle>
          <CardDescription>
            Configure how the AI Sales Coach behaves when interacting with sales representatives
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="behavior"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Behavior Style</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Professional, Friendly, Direct" {...field} />
                    </FormControl>
                    <FormDescription>
                      Define how the AI should behave when coaching sales representatives
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tone of Voice</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Formal, Casual, Encouraging" {...field} />
                    </FormControl>
                    <FormDescription>
                      Set the tone of voice used in AI responses
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="numReplies"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Replies/Messages</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select number of replies" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Number of alternative replies the AI will generate for each prompt
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="additionalInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Instructions</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any additional instructions or guidelines for the AI"
                        className="h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Optional special instructions or guidelines for the AI to follow
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Configuration'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
} 