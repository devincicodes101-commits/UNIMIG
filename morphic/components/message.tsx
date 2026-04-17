// @ts-nocheck
'use client'

import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import { Citing } from './custom-link'
import { CodeBlock } from './ui/codeblock'
import { MemoizedReactMarkdown } from './ui/markdown'
import type { Plugin } from 'unified'

const rehypeKatexPlugin: Plugin = () => rehypeKatex() as any

export function BotMessage({
  message,
  className
}: {
  message: string
  className?: string
}) {
  const containsLaTeX = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/.test(
    message || ''
  )

  const processedData = preprocessLaTeX(message || '')

  if (containsLaTeX) {
    return (
      <MemoizedReactMarkdown
        rehypePlugins={[
          [rehypeExternalLinks, { target: '_blank' }],
          rehypeKatexPlugin
        ]}
        remarkPlugins={[remarkMath]}
        className={cn(
          'prose-sm prose-neutral prose-a:text-accent-foreground/50',
          className
        )}
      >
        {processedData}
      </MemoizedReactMarkdown>
    )
  }

  return (
    <MemoizedReactMarkdown
      rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
      remarkPlugins={[]}
      className={cn(
        'prose-sm prose-neutral prose-a:text-accent-foreground/50',
        className
      )}
      components={{
        code({ node, inline, className, children, ...props }) {
          // Copy children to avoid mutating read-only array/string
          const childArray = Array.isArray(children) ? [...children] : [children]

          if (childArray[0] === '▍') {
            return (
              <span className="mt-1 cursor-default animate-pulse">▍</span>
            )
          }

          if (typeof childArray[0] === 'string') {
            childArray[0] = childArray[0].replace('`▍`', '▍')
          }

          const match = /language-(\w+)/.exec(className || '')

          if (inline) {
            return (
              <code className={className} {...props}>
                {childArray}
              </code>
            )
          }

          return (
            <CodeBlock
              key={Math.random()}
              language={(match && match[1]) || ''}
              value={String(childArray).replace(/\n$/, '')}
              {...props}
            />
          )
        },
        a: Citing
      }}
    >
      {message}
    </MemoizedReactMarkdown>
  )
}

const preprocessLaTeX = (content: string) => {
  const blockProcessedContent = content.replace(
    /\\\[([\s\S]*?)\\\]/g,
    (_, equation) => `$$${equation}$$`
  )
  const inlineProcessedContent = blockProcessedContent.replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_, equation) => `$${equation}$`
  )
  return inlineProcessedContent
}
