import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import type { Sandbox } from '@vercel/sandbox'
import { getSandbox } from '@/lib/services/vercelSandbox'
import { tool } from 'ai'
import description from './process-placeholder-images.md'
import z from 'zod/v3'
import { logger } from '@/lib/logger'
import { 
  SandboxIdSchema,
  createValidationErrorData, 
  createValidationErrorMessage 
} from './schemas'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
  modelId: string
}

interface PlaceholderMatch {
  filePath: string
  lineNumber: number
  placeholderUrl: string
  context: string
}

interface ProcessingResult {
  totalPlaceholders: number
  successfulReplacements: number
  failedReplacements: number
  processedFiles: string[]
  errors: Array<{ file: string; error: string }>
}

export const processPlaceholderImages = ({ writer, modelId }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: SandboxIdSchema,
      sessionId: z.string().min(1).describe('Current session ID for automatic image generation'),
      imgenModel: z.string().optional().describe('Specific image generation model to use - defaults to flux-1.1-pro (optional)')
    }),
    execute: async (rawArgs, { toolCallId }) => {
      const startTime = Date.now()
      
      // ---------- PRE-INVOKE GUARDRAIL ----------
      const parsed = z
        .object({ 
          sandboxId: SandboxIdSchema, 
          sessionId: z.string().min(1),
          imgenModel: z.string().optional()
        })
        .safeParse(rawArgs)

      if (!parsed.success) {
        const err = parsed.error.flatten()
        logger.tool('process-placeholder-images', 'Invalid input', {
          toolCallId,
          issues: err.fieldErrors,
        })

        writer.write({
          id: toolCallId,
          type: 'data-process-placeholder-images',
          data: createValidationErrorData(rawArgs, parsed.error),
        })

        return createValidationErrorMessage('process-placeholder-images')
      }

      const { sandboxId, sessionId, imgenModel } = parsed.data
      
      logger.tool('process-placeholder-images', 'Starting placeholder image processing in sandbox', {
        toolCallId,
        modelId,
        sandboxId,
        imgenModel
      })

      writer.write({
        id: toolCallId,
        type: 'data-process-placeholder-images',
        data: { 
          sandboxId,
          status: 'scanning' 
        },
      })

      try {
        logger.sandbox(sandboxId, 'Getting sandbox instance for placeholder processing', {
          toolCallId
        })

        const sandbox = await getSandbox({ sandboxId })

        // Step 1: Search for all placehold.co URLs in the sandbox
        const placeholders = await findPlaceholderImages(sandbox, toolCallId)
        
        if (placeholders.length === 0) {
          writer.write({
            id: toolCallId,
            type: 'data-process-placeholder-images',
            data: { 
              sandboxId,
              status: 'done',
              totalPlaceholders: 0,
              successfulReplacements: 0,
              failedReplacements: 0,
              processedFiles: []
            },
          })

          return 'No placeholder images found in the sandbox workspace.'
        }

        writer.write({
          id: toolCallId,
          type: 'data-process-placeholder-images',
          data: { 
            sandboxId,
            status: 'generating'
          },
        })

        // Step 2: Process each placeholder image
        const result = await processPlaceholders(sandbox, placeholders, sessionId, imgenModel, toolCallId)

        const duration = Date.now() - startTime

        logger.tool('process-placeholder-images', 'Processing completed', {
          toolCallId,
          duration,
          totalPlaceholders: result.totalPlaceholders,
          successfulReplacements: result.successfulReplacements,
          failedReplacements: result.failedReplacements,
          processedFiles: result.processedFiles.length
        })

        writer.write({
          id: toolCallId,
          type: 'data-process-placeholder-images',
          data: { 
            sandboxId,
            status: 'done',
            totalPlaceholders: result.totalPlaceholders,
            successfulReplacements: result.successfulReplacements,
            failedReplacements: result.failedReplacements,
            processedFiles: result.processedFiles,
            duration,
            ...(result.errors.length > 0 && { error: `${result.errors.length} files had errors` })
          },
        })

        let resultMessage = `Placeholder image processing completed in sandbox!\n\n`;
        resultMessage += `📊 **Summary:**\n`;
        resultMessage += `• Total placeholders found: ${result.totalPlaceholders}\n`;
        resultMessage += `• Successfully replaced: ${result.successfulReplacements}\n`;
        resultMessage += `• Failed replacements: ${result.failedReplacements}\n`;
        resultMessage += `• Files processed: ${result.processedFiles.length}\n`;
        
        if (result.successfulReplacements > 0) {
          resultMessage += `\n✅ **Successfully updated files:**\n`;
          result.processedFiles.slice(0, 10).forEach(file => {
            const fileName = file.split('/').pop() || file;
            resultMessage += `• ${fileName}\n`;
          });
          
          if (result.processedFiles.length > 10) {
            resultMessage += `... and ${result.processedFiles.length - 10} more files\n`;
          }
        }

        if (result.errors.length > 0) {
          resultMessage += `\n⚠️ **Errors encountered:**\n`;
          result.errors.slice(0, 5).forEach(error => {
            const fileName = error.file.split('/').pop() || error.file;
            resultMessage += `• ${fileName}: ${error.error}\n`;
          });
          
          if (result.errors.length > 5) {
            resultMessage += `... and ${result.errors.length - 5} more errors\n`;
          }
        }

        return resultMessage;

      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        logger.error('Failed to process placeholder images in sandbox', error, {
          toolCallId,
          modelId,
          sandboxId,
          duration
        })

        writer.write({
          id: toolCallId,
          type: 'data-process-placeholder-images',
          data: { 
            sandboxId,
            status: 'done',
            error: errorMessage,
            duration
          },
        })

        return `Failed to process placeholder images in sandbox: ${errorMessage}`
      }
    },
  })

/**
 * Find all placehold.co URLs in the sandbox using grep
 */
async function findPlaceholderImages(sandbox: Sandbox, toolCallId: string): Promise<PlaceholderMatch[]> {
  logger.tool('process-placeholder-images', 'Searching for placeholder images in sandbox', {
    toolCallId
  })

  // Use grep to find all placehold.co URLs recursively
  const grepArgs = [
    '-rn', // recursive, show line numbers
    '-H', // show filename
    '--include=*.html',
    '--include=*.htm', 
    '--include=*.js',
    '--include=*.jsx',
    '--include=*.ts',
    '--include=*.tsx',
    '--include=*.css',
    '--include=*.scss',
    '--include=*.sass',
    '--include=*.less',
    '--include=*.json',
    '--include=*.md',
    '--include=*.mdx',
    '--include=*.vue',
    '--include=*.svelte',
    '--exclude-dir=node_modules',
    '--exclude-dir=.git',
    '--exclude-dir=.next',
    '--exclude-dir=dist',
    '--exclude-dir=build',
    '--exclude-dir=coverage',
    'https://placehold\\.co/[^\\s"\'`;}]*',
    '.'
  ]

  const cmd = await sandbox.runCommand({
    cmd: 'grep',
    args: grepArgs,
    detached: true
  })

  const done = await cmd.wait()
  const stdout = await done.stdout()

  const placeholders: PlaceholderMatch[] = []
  
  if (stdout) {
    const lines = stdout.split('\n').filter(line => line.trim())
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+):(.*)$/)
      if (match) {
        const [, filePath, lineNumber, context] = match
        
        // Extract the placehold.co URL from the context
        const urlMatch = context.match(/(https:\/\/placehold\.co\/[^\s"'`;}]*)/)
        if (urlMatch) {
          placeholders.push({
            filePath,
            lineNumber: parseInt(lineNumber),
            placeholderUrl: urlMatch[1],
            context: context.trim()
          })
        }
      }
    }
  }

  logger.tool('process-placeholder-images', `Found ${placeholders.length} placeholder images`, {
    toolCallId,
    count: placeholders.length
  })

  return placeholders
}

/**
 * Process all placeholder images and replace them with generated images
 */
async function processPlaceholders(
  sandbox: Sandbox, 
  placeholders: PlaceholderMatch[], 
  sessionId: string, 
  imgenModel: string | undefined,
  toolCallId: string
): Promise<ProcessingResult> {
  const result: ProcessingResult = {
    totalPlaceholders: placeholders.length,
    successfulReplacements: 0,
    failedReplacements: 0,
    processedFiles: [],
    errors: []
  }

  // Import generateImage once
  const { generateImage } = await import('./generateImage')

  // Step 1: Generate all images asynchronously
  logger.tool('process-placeholder-images', `Starting async generation of ${placeholders.length} images`, {
    toolCallId,
    count: placeholders.length
  })

  const imagePromises = placeholders.map(async (placeholder, index) => {
    try {
      const imageDescription = extractImageDescription(placeholder.placeholderUrl, placeholder.context)
      
      logger.tool('process-placeholder-images', `Generating image ${index + 1}/${placeholders.length}`, {
        toolCallId,
        description: imageDescription,
        url: placeholder.placeholderUrl
      })
      
      const generatedImageUrl = await generateImage(
        imageDescription,
        sessionId,
        'pro',
        null,
        imgenModel || 'black-forest-labs/flux-1.1-pro'
      )

      return {
        placeholder,
        generatedImageUrl,
        success: !!generatedImageUrl
      }
    } catch (error) {
      logger.tool('process-placeholder-images', `Error generating image ${index + 1}`, {
        toolCallId,
        error: error instanceof Error ? error.message : 'Unknown error',
        url: placeholder.placeholderUrl
      })
      
      return {
        placeholder,
        generatedImageUrl: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // Wait for all image generations to complete
  const imageResults = await Promise.all(imagePromises)

  logger.tool('process-placeholder-images', `Completed async image generation`, {
    toolCallId,
    successful: imageResults.filter(r => r.success).length,
    failed: imageResults.filter(r => !r.success).length
  })

  // Step 2: Group results by file and apply replacements
  const fileGroups = new Map<string, typeof imageResults>()
  for (const imageResult of imageResults) {
    const filePath = imageResult.placeholder.filePath
    if (!fileGroups.has(filePath)) {
      fileGroups.set(filePath, [])
    }
    fileGroups.get(filePath)!.push(imageResult)
  }

  // Process each file with its generated images
  for (const [filePath, fileResults] of fileGroups) {
    try {
      logger.tool('process-placeholder-images', `Processing file: ${filePath}`, {
        toolCallId,
        filePath,
        placeholderCount: fileResults.length
      })

      // Read the file content
      const fileContent = await readSandboxFile(sandbox, filePath)
      let updatedContent = fileContent

      // Sort by line number in reverse order to maintain positions during replacement
      const sortedResults = fileResults.sort((a, b) => b.placeholder.lineNumber - a.placeholder.lineNumber)
      
      for (const imageResult of sortedResults) {
        if (imageResult.success && imageResult.generatedImageUrl) {
          // Replace the placeholder URL with the generated image URL
          updatedContent = updatedContent.replace(imageResult.placeholder.placeholderUrl, imageResult.generatedImageUrl)
          result.successfulReplacements++
          
          logger.tool('process-placeholder-images', `Successfully replaced placeholder`, {
            toolCallId,
            filePath,
            oldUrl: imageResult.placeholder.placeholderUrl,
            newUrl: imageResult.generatedImageUrl
          })
        } else {
          result.failedReplacements++
          result.errors.push({ 
            file: filePath, 
            error: imageResult.error || `Failed to generate image for ${imageResult.placeholder.placeholderUrl}` 
          })
        }
      }

      // Write the updated content back to the file
      if (updatedContent !== fileContent) {
        await writeSandboxFile(sandbox, filePath, updatedContent)
        result.processedFiles.push(filePath)
        
        logger.tool('process-placeholder-images', `Updated file: ${filePath}`, {
          toolCallId,
          filePath
        })
      }

    } catch (error) {
      result.errors.push({ 
        file: filePath, 
        error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` 
      })
      
      // Count all placeholders in this file as failed
      const fileResultsCount = fileResults.length
      result.failedReplacements += fileResultsCount
    }
  }

  return result
}

/**
 * Read a file from the sandbox
 */
async function readSandboxFile(sandbox: Sandbox, filePath: string): Promise<string> {
  const stream = await sandbox.readFile({ path: filePath })
  
  if (!stream) {
    throw new Error(`File not found: ${filePath}`)
  }
  
  // Convert stream to string
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Write a file to the sandbox
 */
async function writeSandboxFile(sandbox: Sandbox, filePath: string, content: string): Promise<void> {
  await sandbox.writeFiles([{
    path: filePath,
    content: Buffer.from(content, 'utf-8')
  }])
}

/**
 * Extract a meaningful image description from the placeholder URL and context
 */
function extractImageDescription(placeholderUrl: string, context: string): string {
  // Extract description from URL text parameter
  const urlMatch = placeholderUrl.match(/text=([^&]*)/i)
  let description = ''
  
  if (urlMatch) {
    description = decodeURIComponent(urlMatch[1].replace(/\+/g, ' '))
  }
  
  // If no text parameter, try to extract from alt attribute or context
  if (!description) {
    const altMatch = context.match(/alt=['""]([^'"]*)['"]/i)
    if (altMatch) {
      description = altMatch[1]
    }
  }
  
  // If still no description, try to extract from title or other attributes
  if (!description) {
    const titleMatch = context.match(/title=['""]([^'"]*)['"]/i)
    if (titleMatch) {
      description = titleMatch[1]
    }
  }
  
  // Extract dimensions for better prompting
  const dimensionMatch = placeholderUrl.match(/placehold\.co\/(\d+)x(\d+)/)
  const dimensions = dimensionMatch ? `${dimensionMatch[1]}x${dimensionMatch[2]}` : '1200x800'
  
  // Fallback to generic description based on context
  if (!description) {
    if (context.includes('hero') || context.includes('banner')) {
      description = 'professional hero banner image'
    } else if (context.includes('avatar') || context.includes('profile')) {
      description = 'professional profile avatar'
    } else if (context.includes('card') || context.includes('thumbnail')) {
      description = 'modern card thumbnail image'
    } else {
      description = 'professional website image'
    }
  }
  
  return `Create a ${dimensions} ${description} with modern, professional styling`
}
