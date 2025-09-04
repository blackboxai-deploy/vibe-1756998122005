export interface FileNode {
  children?: FileNode[]
  content?: string
  expanded?: boolean
  name: string
  path: string
  type: 'file' | 'directory'
}

interface FileNodeBuilder {
  children?: { [key: string]: FileNodeBuilder }
  content?: string
  expanded?: boolean
  name: string
  path: string
  type: 'file' | 'directory'
}

export function buildFileTree(paths: string[]): FileNode[] {
  // Input validation
  if (!Array.isArray(paths)) {
    console.warn('buildFileTree: paths is not an array, returning empty tree')
    return []
  }

  // Filter and validate paths
  const validPaths = paths.filter((path) => {
    if (typeof path !== 'string') {
      console.warn('buildFileTree: invalid path type, skipping:', path)
      return false
    }
    
    if (!path || path.length === 0) {
      return false
    }
    
    // Skip paths that are just root or current directory
    if (path === '/' || path === '.' || path === './') {
      return false
    }
    
    return true
  })

  if (validPaths.length === 0) {
    return []
  }

  const root: { [key: string]: FileNodeBuilder } = {}

  validPaths.forEach((path) => {
    try {
      // Normalize path - remove leading slash and split
      const normalizedPath = path.startsWith('/') ? path.substring(1) : path
      const parts = normalizedPath.split('/').filter(Boolean)
      
      // Skip empty paths after normalization
      if (parts.length === 0) {
        return
      }

      let current = root
      let currentPath = ''

      parts.forEach((part, index) => {
        currentPath += '/' + part
        const isFile = index === parts.length - 1

        if (!current[part]) {
          current[part] = {
            name: part,
            type: isFile ? 'file' : 'directory',
            path: currentPath,
            content: isFile
              ? `// Content for ${currentPath}\n// This will be loaded when the file is selected`
              : undefined,
            children: isFile ? undefined : {},
            expanded: false,
          }
        } else if (!isFile && current[part].type === 'file') {
          // Handle case where we have both a file and directory with same name
          // Convert file to directory if we encounter a path that goes deeper
          current[part].type = 'directory'
          current[part].content = undefined
          current[part].children = current[part].children || {}
        }

        if (!isFile) {
          // Safety check: ensure children exists before assignment
          if (!current[part].children) {
            current[part].children = {}
          }
          current = current[part].children as { [key: string]: FileNodeBuilder }
        }
      })
    } catch (error) {
      console.warn('buildFileTree: error processing path:', path, error)
    }
  })

  const convertToArray = (obj: {
    [key: string]: FileNodeBuilder
  }): FileNode[] => {
    try {
      return Object.values(obj)
        .map(
          (node): FileNode => ({
            ...node,
            children: node.children ? convertToArray(node.children) : undefined,
          })
        )
        .sort((a, b) => {
          // Sort directories first, then files
          if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1
          }
          // Then sort alphabetically, case-insensitive
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        })
    } catch (error) {
      console.warn('buildFileTree: error converting to array:', error)
      return []
    }
  }

  return convertToArray(root)
}
