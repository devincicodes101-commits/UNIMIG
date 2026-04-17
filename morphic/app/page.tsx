import { Chat } from '@/components/chat'
import { generateId } from 'ai'

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function Page() {
  const id = generateId()
  return <Chat id={id} />
}
