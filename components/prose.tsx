import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

// Compact variant: chat messages and sidebar section content
// Document variant: full-page views (share view)
type ProseVariant = 'chat' | 'doc'

function buildComponents(variant: ProseVariant): Components {
  const isDoc = variant === 'doc'

  return {
    h1: ({ children }) => (
      <h1 className={isDoc ? 'text-xl font-bold text-zinc-100 mt-0 mb-4' : 'text-sm font-bold text-zinc-100 mb-2'}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className={isDoc
        ? 'text-sm font-semibold text-zinc-300 uppercase tracking-wider mt-8 mb-3 first:mt-0'
        : 'text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-3 mb-1'}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className={isDoc ? 'text-sm font-semibold text-zinc-400 mt-5 mb-2' : 'text-xs font-semibold text-zinc-500 mt-2 mb-1'}>
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className={isDoc ? 'text-sm text-zinc-200 leading-relaxed mb-4 last:mb-0' : 'text-sm text-zinc-200 leading-relaxed mb-2 last:mb-0'}>
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className={isDoc ? 'list-disc list-outside pl-5 space-y-1.5 mb-4 text-zinc-200' : 'list-disc list-outside pl-4 space-y-1 mb-2 text-zinc-200'}>
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={isDoc ? 'list-decimal list-outside pl-5 space-y-1.5 mb-4 text-zinc-200' : 'list-decimal list-outside pl-4 space-y-1 mb-2 text-zinc-200'}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={isDoc ? 'text-sm text-zinc-200 leading-relaxed' : 'text-sm text-zinc-300 leading-relaxed'}>
        {children}
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-zinc-100">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-zinc-300">{children}</em>
    ),
    code: ({ children, className }) => {
      const isBlock = className?.startsWith('language-')
      if (isBlock) {
        return (
          <code className="block bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre">
            {children}
          </code>
        )
      }
      return (
        <code className="font-mono text-xs bg-zinc-800/80 text-sky-300 px-1.5 py-0.5 rounded">
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="mb-4 last:mb-0">{children}</pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-zinc-700 pl-3 my-3 text-zinc-400 italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-zinc-800 my-5" />,
    a: ({ href, children }) => (
      <a href={href} className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr className="border-b border-zinc-800/60">{children}</tr>,
    th: ({ children }) => (
      <th className="text-left text-xs font-semibold text-zinc-400 pb-2 pr-4 pt-1">{children}</th>
    ),
    td: ({ children }) => (
      <td className="py-2 pr-4 text-zinc-300 text-xs">{children}</td>
    ),
  }
}

export function Prose({ children, variant = 'chat' }: { children: string; variant?: ProseVariant }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={buildComponents(variant)}>
      {children}
    </ReactMarkdown>
  )
}
