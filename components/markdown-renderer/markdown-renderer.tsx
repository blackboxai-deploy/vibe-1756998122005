import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="w-full min-w-0 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a: ({ children, href, ...props }) => (
            <a 
              href={href} 
              target="_blank" 
              className="text-blue-600 hover:text-blue-800 underline break-all"
              {...props}
            >
              {children}
            </a>
          ),
          code: ({ children, className, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            return match ? (
              <code
                className={`${className} bg-white px-1 py-0.5 rounded text-sm font-mono break-all`}
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className="bg-white px-1 py-0.5 rounded text-sm font-mono break-all"
                {...props}
              >
                {children}
              </code>
            )
          },
          pre: ({ children, ...props }) => (
            <div className="w-full min-w-0">
              <pre
                className="bg-white p-2 sm:p-3 rounded-sm overflow-x-auto text-xs sm:text-sm font-mono whitespace-pre-wrap break-words"
                style={{ 
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere'
                }}
                {...props}
              >
                {children}
              </pre>
            </div>
          ),
          h1: ({ children, ...props }) => (
            <h1 className="text-base sm:text-lg font-semibold mb-2 mt-4 first:mt-0 break-words" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2
              className="text-sm sm:text-base font-semibold mb-2 mt-3 first:mt-0 break-words"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-xs sm:text-sm font-semibold mb-1 mt-2 first:mt-0 break-words" {...props}>
              {children}
            </h3>
          ),
          ul: ({ children, ...props }) => (
            <ul className="ml-2 list-disc pl-3 sm:pl-4 mb-2 space-y-1" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="ml-4 list-decimal pl-3 sm:pl-4 mb-2 space-y-1" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="break-words" {...props}>
              {children}
            </li>
          ),
          p: ({ children, ...props }) => (
            <p className="mb-2 last:mb-0 break-words" {...props}>
              {children}
            </p>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-muted pl-3 sm:pl-4 italic my-2 break-words"
              {...props}
            >
              {children}
            </blockquote>
          ),
          table: ({ children, ...props }) => (
            <div className="w-full overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-muted text-xs sm:text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-white" {...props}>
              {children}
            </thead>
          ),
          tbody: ({ children, ...props }) => (
            <tbody {...props}>
              {children}
            </tbody>
          ),
          tr: ({ children, ...props }) => (
            <tr className="border-b border-muted" {...props}>
              {children}
            </tr>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-muted px-2 py-1 text-left font-semibold break-words" {...props}>
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-muted px-2 py-1 break-words" {...props}>
              {children}
            </td>
          ),
          img: ({ src, alt, ...props }) => (
            <img 
              src={src} 
              alt={alt} 
              className="max-w-full h-auto rounded"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
