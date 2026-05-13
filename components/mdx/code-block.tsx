'use client'

import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  children: React.ReactNode
  language?: string
  filename?: string
  showLineNumbers?: boolean
}

export function CodeBlock({ 
  children, 
  language = 'text',
  filename,
  showLineNumbers = false 
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false)
  const codeRef = React.useRef<HTMLPreElement>(null)

  const copyToClipboard = async () => {
    const code = codeRef.current?.textContent || ''
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative my-6 rounded-lg border border-border bg-code">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          {filename && (
            <span className="text-xs text-muted-foreground">{filename}</span>
          )}
          {!filename && language && language !== 'text' && (
            <span className="text-xs text-muted-foreground">{language}</span>
          )}
        </div>
        
        <button
          onClick={copyToClipboard}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label={copied ? 'Copiado' : 'Copiar codigo'}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Code */}
      <pre
        ref={codeRef}
        className={cn(
          'overflow-x-auto p-4 text-sm leading-relaxed',
          showLineNumbers && 'pl-12'
        )}
      >
        <code className={`language-${language}`}>
          {children}
        </code>
      </pre>
    </div>
  )
}
