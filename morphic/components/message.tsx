// @ts-nocheck
'use client'

import { cn } from '@/lib/utils'
import 'katex/dist/katex.min.css'
import rehypeExternalLinks from 'rehype-external-links'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { Citing } from './custom-link'
import { CodeBlock } from './ui/codeblock'
import { MemoizedReactMarkdown } from './ui/markdown'
import type { Plugin } from 'unified'

// Create properly typed plugin wrapper
const rehypeKatexPlugin: Plugin = () => rehypeKatex() as any

export function BotMessage({
  message,
  className
}: {
  message: string
  className?: string
}) {
  // Check if the content contains LaTeX patterns
  const containsLaTeX = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/.test(
    message || ''
  )

  // Modify the content to render LaTeX equations if LaTeX patterns are found
  const processedData = preprocessLaTeX(message || '')

  if (containsLaTeX) {
    return (
      <MemoizedReactMarkdown
        rehypePlugins={[
          [rehypeExternalLinks, { target: '_blank' }],
          rehypeKatexPlugin
        ]}
        remarkPlugins={[remarkGfm, remarkMath]}
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
      // @ts-expect-error - Type incompatibility between rehype plugin versions
      rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
      // @ts-expect-error - Type incompatibility between remark plugin versions
      remarkPlugins={[remarkGfm]}
      className={cn(
        'prose-sm prose-neutral prose-a:text-accent-foreground/50',
        className
      )}
      components={{
        code({ node, inline, className, children, ...props }) {
          // react-markdown v10 passes children as a string; v9 passed an array.
          // Normalise to a plain string so we never try to mutate a read-only
          // string index (which throws "Cannot assign to read only property '0'").
          let content: string
          if (Array.isArray(children)) {
            content = children
              .map((c) => (typeof c === 'string' ? c : String(c ?? '')))
              .join('')
          } else {
            content = String(children ?? '')
          }

          // Swap the streaming cursor placeholder if present
          if (content === '▍') {
            return (
              <span className="mt-1 cursor-default animate-pulse">▍</span>
            )
          }
          content = content.replace('`▍`', '▍')

          const match = /language-(\w+)/.exec(className || '')

          // In v10 the `inline` prop is gone; fall back to: no language class
          // and no newlines → treat as inline code.
          const isInline =
            inline !== undefined ? inline : !match && !content.includes('\n')

          if (isInline) {
            return (
              <code className={className} {...props}>
                {content}
              </code>
            )
          }

          return (
            <CodeBlock
              key={Math.random()}
              language={(match && match[1]) || ''}
              value={content.replace(/\n$/, '')}
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

// Preprocess LaTeX equations to be rendered by KaTeX
// ref: https://github.com/remarkjs/react-markdown/issues/785
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