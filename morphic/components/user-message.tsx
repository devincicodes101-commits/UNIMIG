'use client'

type UserMessageProps = {
  message: string
}

export const UserMessage = ({ message }: UserMessageProps) => {
  return (
    <div className="flex justify-end mb-1">
      <div className="max-w-[78%] bg-foreground text-background rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed break-words shadow-sm">
        {message}
      </div>
    </div>
  )
}
