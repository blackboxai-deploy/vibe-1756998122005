import Prism from 'react-syntax-highlighter'
import grayscale from 'react-syntax-highlighter/dist/esm/styles/hljs/grayscale'

export function SyntaxHighlighter(props: { path: string; code: string }) {
  const lang = detectLanguageFromFilename(props.path)
  return (
    <div className="w-full h-full overflow-auto">
      <Prism
        language={lang ?? 'javascript'}
        style={grayscale}
        showLineNumbers
        showInlineLineNumbers
        customStyle={{
          fontSize: '0.75rem',
          margin: 0,
          background: 'transparent',
          minHeight: '100%',
          padding: '0.5rem',
        }}
        codeTagProps={{
          style: {
            whiteSpace: 'pre',
            overflowX: 'auto',
            wordBreak: 'break-all',
            overflowWrap: 'break-word',
          },
        }}
        lineNumberStyle={{
          minWidth: '2.5rem',
          paddingRight: '0.5rem',
          fontSize: '0.75rem',
          color: '#666',
        }}
      >
        {props.code}
      </Prism>
    </div>
  )
}

function detectLanguageFromFilename(path: string): string {
  const pathParts = path.split('/')
  const extension = pathParts[pathParts.length - 1]
    ?.split('.')
    .pop()
    ?.toLowerCase()

  const extensionMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: 'jsx',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    mjs: 'javascript',
    cjs: 'javascript',

    // Python
    py: 'python',
    pyw: 'python',
    pyi: 'python',

    // Web technologies
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',

    // Other popular languages
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cxx: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    fish: 'bash',
    ps1: 'powershell',

    // Data formats
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    ini: 'ini',

    // Markup
    md: 'markdown',
    markdown: 'markdown',
    tex: 'latex',

    // Database
    sql: 'sql',

    // Config files
    dockerfile: 'dockerfile',
    gitignore: 'bash',
    env: 'bash',
  }

  return extensionMap[extension || ''] || 'text'
}
