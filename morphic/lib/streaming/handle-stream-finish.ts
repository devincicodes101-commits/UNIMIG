import { getChat, saveChat } from '@/lib/actions/chat'
import { generateRelatedQuestions } from '@/lib/agents/generate-related-questions'
import { ExtendedCoreMessage } from '@/lib/types'
import { convertToExtendedCoreMessages, getAbsoluteUrl } from '@/lib/utils'
import { CoreMessage, DataStreamWriter, JSONValue, Message } from 'ai'

interface HandleStreamFinishParams {
  responseMessages: CoreMessage[]
  originalMessages: Message[]
  model: string
  chatId: string
  dataStream: DataStreamWriter
  skipRelatedQuestions?: boolean
  annotations?: ExtendedCoreMessage[]
  role?: string
  userId?: string
  userEmail?: string
}

export async function handleStreamFinish({
  responseMessages,
  originalMessages,
  model,
  chatId,
  dataStream,
  skipRelatedQuestions = true,
  annotations = [],
  role,
  userId,
  userEmail
}: HandleStreamFinishParams) {
  try {
    const extendedCoreMessages = convertToExtendedCoreMessages(originalMessages)
    let allAnnotations = [...annotations]

    if (!skipRelatedQuestions) {
      // Notify related questions loading
      const relatedQuestionsAnnotation: JSONValue = {
        type: 'related-questions',
        data: { items: [] }
      }
      dataStream.writeMessageAnnotation(relatedQuestionsAnnotation)

      // Generate related questions
      const relatedQuestions = await generateRelatedQuestions(
        responseMessages,
        model
      )

      // Create and add related questions annotation
      const updatedRelatedQuestionsAnnotation: ExtendedCoreMessage = {
        role: 'data',
        content: {
          type: 'related-questions',
          data: relatedQuestions.object
        } as JSONValue
      }

      dataStream.writeMessageAnnotation(
        updatedRelatedQuestionsAnnotation.content as JSONValue
      )
      allAnnotations.push(updatedRelatedQuestionsAnnotation)
    }

    // Create the message to save
    const generatedMessages = [
      ...extendedCoreMessages,
      ...responseMessages.slice(0, -1),
      ...allAnnotations, // Add annotations before the last message
      ...responseMessages.slice(-1)
    ] as ExtendedCoreMessage[]

    // Log to python RAG backend for admin records (Independent of Next.js Save Chat History)
    if (role && userId) {
      const ragServerUrl = getAbsoluteUrl(process.env.NEXT_PUBLIC_RAG_SERVER_URL || 'http://localhost:8000')
      // Find the final AI response (ignoring tool role messages that might come after)
      const lastAssistantMsg = [...responseMessages].reverse().find(m => m.role === 'assistant')
      let answer = 'Stream completed.'

      if (lastAssistantMsg) {
        if (typeof lastAssistantMsg.content === 'string') {
          answer = lastAssistantMsg.content
        } else if (Array.isArray(lastAssistantMsg.content)) {
          // Extract text parts from the message array
          const textContent = lastAssistantMsg.content
            .filter((part: any) => part.type === 'text')
            .map((part: any) => part.text)
            .join('\n')

          if (textContent) {
            answer = textContent
          }
        }
      }

      // Extract sources if any exist in the annotations
      const toolAnnotations = annotations.find(a => a.content && typeof a.content === 'object' && 'type' in a.content && a.content.type === 'tool_calls')
      let extractedSources: string[] = []

      fetch(`${ragServerUrl}/log-conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_email: userEmail || 'unknown@example.com',
          role: role,
          question: originalMessages[originalMessages.length - 1]?.content || 'Unknown Question',
          answer: answer,
          sources: extractedSources,
          timestamp: new Date().toISOString(),
        }),
      }).catch(err => console.error('[handleStreamFinish] Failed to log conversation to RAG backend:', err))
    }

    if (process.env.ENABLE_SAVE_CHAT_HISTORY !== 'true') {
      return
    }

    // Get the chat from the database if it exists, otherwise create a new one
    const savedChat = (await getChat(chatId)) ?? {
      messages: [],
      createdAt: new Date(),
      userId: 'anonymous',
      path: `/search/${chatId}`,
      title: originalMessages[0].content,
      id: chatId
    }

    // Save chat with complete response and related questions
    await saveChat({
      ...savedChat,
      messages: generatedMessages
    }).catch(error => {
      console.error('Failed to save chat:', error)
      throw new Error('Failed to save chat history')
    })
  } catch (error) {
    console.error('Error in handleStreamFinish:', error)
    throw error
  }
}
