import { Chat } from '@/components/chat'
import { getChat } from '@/lib/actions/chat'
import { getModels } from '@/lib/config/models'
import { convertToUIMessages } from '@/lib/utils'
import { notFound, redirect } from 'next/navigation'

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
export const maxDuration = 60

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const chat = await getChat(id, 'anonymous')
  return {
    title: chat?.title.toString().slice(0, 50) || 'Search'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const userId = 'anonymous'
  const { id } = await props.params

  const chat = await getChat(id, userId)
  // convertToUIMessages for useChat hook
  const messages = convertToUIMessages(chat?.messages || [])

  // We no longer redirect to '/' if chat is missing, because if they don't have Redis
  // configured, getChat will always return null. We just let the Chat component handle
  // the client-side state history instead.
  if (chat && chat.userId !== userId) {
    notFound()
  }

  const models = await getModels()
  
  return <Chat id={id} savedMessages={messages} />
}
