import { FC, memo } from 'react'
import ReactMarkdown, { Options } from 'react-markdown'
import { cn } from '@/lib/utils'

export interface MarkdownProps extends Options {
  className?: string;
}

export const MemoizedReactMarkdown: FC<MarkdownProps> = memo(
  ({ className, ...props }) => {
    return (
      <div className={className}>
        <ReactMarkdown {...props} />
      </div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className
)

MemoizedReactMarkdown.displayName = 'MemoizedReactMarkdown'
