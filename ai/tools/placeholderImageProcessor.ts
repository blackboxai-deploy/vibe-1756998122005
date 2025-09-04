import * as path from 'path';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import { generateImage } from './generateImage';

interface PlaceholderImageInfo {
  filePath: string;
  placeholder: string;
  altText: string;
  context: string;
  width?: number;
  height?: number;
  startIndex: number;
  endIndex: number;
}

interface ProcessingResult {
  totalPlaceholders: number;
  successfulReplacements: number;
  failedReplacements: number;
  processedFiles: string[];
  errors: Array<{ file: string; error: string }>;
}

/**
 * Comprehensive placeholder image processor that scans the entire workspace
 * for placehold.co URLs and replaces them with generated images
 */
export class PlaceholderImageProcessor {
  private readonly sessionId: string;
  private readonly workspaceRoot: string;
  private readonly imgenModel?: string;
  
  // File extensions to process
  private readonly supportedExtensions = [
    '.html', '.htm', '.xml',
    '.js', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.sass', '.less',
    '.json', '.md', '.mdx',
    '.vue', '.svelte',
    '.php', '.py', '.rb',
    '.java', '.c', '.cpp', '.cs',
    '.go', '.rs', '.swift'
  ];

  constructor(workspaceRoot: string, sessionId: string, imgenModel?: string) {
    this.workspaceRoot = workspaceRoot;
    this.sessionId = sessionId;
    this.imgenModel = imgenModel;
  }

  /**
   * Main entry point - processes all placeholder images in the workspace
   */
  async processAllPlaceholderImages(): Promise<ProcessingResult> { 
    const result: ProcessingResult = {
      totalPlaceholders: 0,
      successfulReplacements: 0,
      failedReplacements: 0,
      processedFiles: [],
      errors: []
    };

    try {
      // Step 1: Find all relevant files in workspace
      const files = await this.findRelevantFiles();

      // Step 2: Extract all placeholder images from all files
      const placeholders = await this.extractAllPlaceholders(files);
    
      result.totalPlaceholders = placeholders.length;

      if (placeholders.length === 0) {
        return result;
      }

      // Step 3: Generate images for all unique placeholders
      const imageMap = await this.generateImagesForPlaceholders(placeholders);

      // Step 4: Replace placeholders in all files
      await this.replaceAllPlaceholders(placeholders, imageMap, result);

      return result;

    } catch (error) {
      console.error('❌ Error during placeholder processing:', error);
      result.errors.push({
        file: 'global',
        error: error instanceof Error ? error.message : String(error)
      });
      return result;
    }
  }

  /**
   * Find all relevant files in the workspace that might contain placeholders
   */
  private async findRelevantFiles(): Promise<string[]> {
    const patterns = this.supportedExtensions.map(ext => `**/*${ext}`);
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: this.workspaceRoot,
          ignore: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.git/**',
            '**/.vscode/**',
            '**/.next/**',
            '**/.nuxt/**',
            '**/vendor/**',
            '**/__pycache__/**',
            '**/target/**'
          ],
          absolute: true
        });
        files.push(...matches);
      } catch (error) {
        console.warn(`⚠️ Error scanning pattern ${pattern}:`, error);
      }
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Extract all placeholder images from all files
   */
  private async extractAllPlaceholders(files: string[]): Promise<PlaceholderImageInfo[]> {
    const allPlaceholders: PlaceholderImageInfo[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const placeholders = await this.extractPlaceholdersFromContent(content, filePath);
        allPlaceholders.push(...placeholders);
      } catch (error) {
        console.warn(`⚠️ Error reading file ${filePath}:`, error);
      }
    }

    return allPlaceholders;
  }

  /**
   * Extract placeholders from file content
   */
  private async extractPlaceholdersFromContent(content: string, filePath: string): Promise<PlaceholderImageInfo[]> {
    const placeholders: PlaceholderImageInfo[] = [];
    const ext = path.extname(filePath).toLowerCase();

    // Use comprehensive regex to find all placehold.co URLs
    const placeholderRegex = /https:\/\/placehold\.co\/[^?\s]+(?:\?[^\s"'`;\)}\]]*)?/gi;
    let match;

    while ((match = placeholderRegex.exec(content)) !== null) {
      const placeholder = match[0];
      const startIndex = match.index;
      const endIndex = startIndex + placeholder.length;

      // Extract context around the placeholder (200 chars before and after)
      const contextStart = Math.max(0, startIndex - 200);
      const contextEnd = Math.min(content.length, endIndex + 200);
      const context = content.slice(contextStart, contextEnd);

      // Extract alt text and dimensions
      const placeholderInfo = this.analyzePlaceholder(placeholder, context, ext);

      placeholders.push({
        filePath,
        placeholder,
        altText: placeholderInfo.altText,
        context,
        width: placeholderInfo.width,
        height: placeholderInfo.height,
        startIndex,
        endIndex
      });
    }

    return placeholders;
  }

  /**
   * Analyze a placeholder to extract meaningful information
   */
  private analyzePlaceholder(placeholder: string, context: string, fileExtension: string): {
    altText: string;
    width?: number;
    height?: number;
  } {
    let altText = '';
    let width: number | undefined;
    let height: number | undefined;

    // Extract dimensions from URL
    const dimensionMatch = placeholder.match(/placehold\.co\/(\d+)x(\d+)/);
    if (dimensionMatch) {
      width = parseInt(dimensionMatch[1]);
      height = parseInt(dimensionMatch[2]);
    }

    // Strategy 1: Extract from URL query parameters
    try {
      const urlParams = new URLSearchParams(placeholder.split('?')[1] || '');
      const textParam = urlParams.get('text');
      if (textParam) {
        altText = decodeURIComponent(textParam.replace(/\+/g, ' '));
        return { altText, width, height };
      }
    } catch (error) {
      // Ignore URL parsing errors
    }

    // Strategy 2: Context-based extraction for different file types
    if (['.html', '.htm', '.xml', '.vue'].includes(fileExtension)) {
      altText = this.extractFromHtmlContext(context);
    } else if (['.js', '.jsx', '.ts', '.tsx', '.json'].includes(fileExtension)) {
      altText = this.extractFromJsContext(context);
    } else if (['.css', '.scss', '.sass', '.less'].includes(fileExtension)) {
      altText = this.extractFromCssContext(context);
    } else if (['.md', '.mdx'].includes(fileExtension)) {
      altText = this.extractFromMarkdownContext(context);
    }

    // Fallback: Generate a descriptive name
    if (!altText) {
      altText = this.generateFallbackAltText(placeholder, width, height);
    }

    return { altText, width, height };
  }

  /**
   * Extract alt text from HTML context
   */
  private extractFromHtmlContext(context: string): string {
    // Look for alt attributes
    const altMatch = context.match(/alt\s*=\s*['"]([^'"]+)['"]/i);
    if (altMatch) return altMatch[1];

    // Look for title attributes
    const titleMatch = context.match(/title\s*=\s*['"]([^'"]+)['"]/i);
    if (titleMatch) return titleMatch[1];

    // Look for nearby headings
    const headingMatch = context.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
    if (headingMatch) return headingMatch[1].trim();

    // Look for figure captions
    const captionMatch = context.match(/<figcaption[^>]*>([^<]+)<\/figcaption>/i);
    if (captionMatch) return captionMatch[1].trim();

    return '';
  }

  /**
   * Extract alt text from JavaScript context
   */
  private extractFromJsContext(context: string): string {
    // Look for object properties that might describe the image
    const patterns = [
      /title\s*:\s*['"]([^'"]+)['"]/i,
      /name\s*:\s*['"]([^'"]+)['"]/i,
      /alt\s*:\s*['"]([^'"]+)['"]/i,
      /description\s*:\s*['"]([^'"]+)['"]/i,
      /text\s*:\s*['"]([^'"]+)['"]/i,
      /label\s*:\s*['"]([^'"]+)['"]/i,
      /caption\s*:\s*['"]([^'"]+)['"]/i
    ];

    for (const pattern of patterns) {
      const match = context.match(pattern);
      if (match) return match[1];
    }

    // Look for comments near the placeholder
    const commentMatch = context.match(/\/\/\s*(.+)|\/\*\s*(.+?)\s*\*\//);
    if (commentMatch) return (commentMatch[1] || commentMatch[2]).trim();

    return '';
  }

  /**
   * Extract alt text from CSS context
   */
  private extractFromCssContext(context: string): string {
    // Look for CSS class names or comments that might describe the image
    const classMatch = context.match(/\.([a-zA-Z-_]+)/);
    if (classMatch) {
      return classMatch[1].replace(/[-_]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    // Look for CSS comments
    const commentMatch = context.match(/\/\*\s*(.+?)\s*\*\//);
    if (commentMatch) return commentMatch[1].trim();

    return '';
  }

  /**
   * Extract alt text from Markdown context
   */
  private extractFromMarkdownContext(context: string): string {
    // Look for markdown image syntax with alt text
    const imgMatch = context.match(/!\[([^\]]+)\]/);
    if (imgMatch) return imgMatch[1];

    // Look for nearby headings
    const headingMatch = context.match(/#{1,6}\s+(.+)/);
    if (headingMatch) return headingMatch[1].trim();

    return '';
  }

  /**
   * Generate fallback alt text when no context is available
   */
  private generateFallbackAltText(placeholder: string, width?: number, height?: number): string {
    // Try to extract meaningful info from URL path
    const urlPath = placeholder.split('/').pop()?.split('?')[0] || '';
    
    if (urlPath && !['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(urlPath.toLowerCase())) {
      return urlPath.replace(/[_-]/g, ' ');
    }

    // Generate based on dimensions
    if (width && height) {
      if (width > height * 1.5) return `Wide banner image ${width}x${height}`;
      if (height > width * 1.5) return `Tall vertical image ${width}x${height}`;
      if (Math.abs(width - height) < 50) return `Square image ${width}x${height}`;
      return `Rectangle image ${width}x${height}`;
    }

    return 'Generated placeholder image';
  }

  /**
   * Generate images for all unique placeholders
   */
  private async generateImagesForPlaceholders(placeholders: PlaceholderImageInfo[]): Promise<Map<string, string>> {
    const imageMap = new Map<string, string>();
    const uniquePlaceholders = new Map<string, PlaceholderImageInfo>();
    const keyToPlaceholders = new Map<string, PlaceholderImageInfo[]>();

    // Deduplicate based on alt text and dimensions to avoid generating identical images
    // But keep track of all placeholders that share the same key
    for (const placeholder of placeholders) {
      const key = `${placeholder.altText}_${placeholder.width || 'auto'}_${placeholder.height || 'auto'}`;
      if (!uniquePlaceholders.has(key)) {
        uniquePlaceholders.set(key, placeholder);
        keyToPlaceholders.set(key, []);
      }
      keyToPlaceholders.get(key)!.push(placeholder);
    }

    const generatePromises = Array.from(uniquePlaceholders.entries()).map(async ([key, placeholder]) => {
      try {
        // Create enhanced prompt with dimensions if available
        let enhancedPrompt = placeholder.altText;
        let Prompt = enhancedPrompt;
        if (placeholder.width && placeholder.height) {
          enhancedPrompt = `${enhancedPrompt} with ${placeholder.width}x${placeholder.height} resolution`;
        }

        // Retry logic for image generation - attempt up to 3 times (initial + 2 retries)
        let imageMarkdown: string | null = null;
        const maxRetries = 2;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            if (attempt === 0) {
              // First attempt uses the original prompt
              imageMarkdown = await generateImage(enhancedPrompt, this.sessionId, null, null, this.imgenModel);
            }
            else {
              imageMarkdown = await generateImage(Prompt, this.sessionId, null, null, this.imgenModel);
            }
            // If we got a valid result, break out of retry loop
            if (imageMarkdown && imageMarkdown.trim() !== '' && imageMarkdown.startsWith('![](')) {
              break;
            }
            
            // If result is empty or invalid and we have retries left, log and continue
            if (attempt < maxRetries) {
              // Wait 1 second before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (error) {
            if (attempt === maxRetries) {
              // On final attempt, set imageMarkdown to null
              imageMarkdown = null;
            } else {
              // Wait 1 second before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }

        if (imageMarkdown && imageMarkdown.startsWith('![](')) {
          const urlMatch = imageMarkdown.match(/!\[\]\(([^)]+)\)/);
          if (urlMatch && urlMatch[1]) {
            const generatedImageUrl = urlMatch[1];
            
            // Map ALL placeholder URLs that share this key to the same generated image URL
            const relatedPlaceholders = keyToPlaceholders.get(key) || [];
          
            for (const relatedPlaceholder of relatedPlaceholders) {
              imageMap.set(relatedPlaceholder.placeholder, generatedImageUrl);
            }
            
            return { success: true, placeholder: placeholder.placeholder, count: relatedPlaceholders.length };
          }
        }

        console.log(`❌ Failed to generate image for "${placeholder.altText}"`);
        return { success: false, placeholder: placeholder.placeholder };

      } catch (error) {
        console.error(`❌ Error generating image for "${placeholder.altText}":`, error);
        return { success: false, placeholder: placeholder.placeholder };
      }
    });

    await Promise.all(generatePromises);

    return imageMap;
  }

  /**
   * Replace all placeholders in files with generated images
   */
  private async replaceAllPlaceholders(
    placeholders: PlaceholderImageInfo[],
    imageMap: Map<string, string>,
    result: ProcessingResult
  ): Promise<void> {
    // Group placeholders by file for efficient processing
    const fileGroups = new Map<string, PlaceholderImageInfo[]>();
    
    for (const placeholder of placeholders) {
      if (!fileGroups.has(placeholder.filePath)) {
        fileGroups.set(placeholder.filePath, []);
      }
      fileGroups.get(placeholder.filePath)!.push(placeholder);
    }

    for (const [filePath, filePlaceholders] of fileGroups) {
      try {
        await this.replaceInFile(filePath, filePlaceholders, imageMap, result);
        result.processedFiles.push(filePath);
      } catch (error) {
        console.error(`❌ Error updating file ${filePath}:`, error);
        result.errors.push({
          file: filePath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Replace placeholders in a single file
   */
  private async replaceInFile(
    filePath: string,
    placeholders: PlaceholderImageInfo[],
    imageMap: Map<string, string>,
    result: ProcessingResult
  ): Promise<void> {
    let content = await fs.readFile(filePath, 'utf-8');
    const originalContent = content;
    let replacements = 0;

    // Sort placeholders by start index in descending order to avoid index shifting
    placeholders.sort((a, b) => b.startIndex - a.startIndex);

    for (const placeholder of placeholders) {
      // Check if we have a generated image for this placeholder
      const generatedImageUrl = imageMap.get(placeholder.placeholder);
      
      if (generatedImageUrl) {
        try {
          // Use multiple replacement strategies to ensure we catch all instances
          const replacementStrategies = [
            // Strategy 1: Template strings with backticks (most specific first)
            () => content.replace(`\`${placeholder.placeholder}\``, `\`${generatedImageUrl}\``),
            
            // Strategy 2: Double quotes
            () => content.replace(`"${placeholder.placeholder}"`, `"${generatedImageUrl}"`),
            
            // Strategy 3: Single quotes
            () => content.replace(`'${placeholder.placeholder}'`, `'${generatedImageUrl}'`),
            
            // Strategy 4: CSS url() functions
            () => content.replace(`url('${placeholder.placeholder}')`, `url('${generatedImageUrl}')`),
            () => content.replace(`url("${placeholder.placeholder}")`, `url("${generatedImageUrl}")`),
            () => content.replace(`url(\`${placeholder.placeholder}\`)`, `url(\`${generatedImageUrl}\`)`),
            () => content.replace(`url(${placeholder.placeholder})`, `url(${generatedImageUrl})`),
            
            // Strategy 5: Global replacement with regex (most careful approach)
            () => {
              // Create a regex that matches the placeholder with proper word boundaries
              const escapedPlaceholder = this.escapeRegExp(placeholder.placeholder);
              const regex = new RegExp(`(?<=["\'\`\\s=:,\\(])${escapedPlaceholder}(?=["\'\`\\s,\\)\\;])`, 'g');
              return content.replace(regex, generatedImageUrl);
            },
            
            // Strategy 6: Direct replacement (last resort)
            () => content.replace(placeholder.placeholder, generatedImageUrl),
          ];

          // Apply the first strategy that makes a change
          let strategyApplied = false;
          for (let i = 0; i < replacementStrategies.length; i++) {
            const strategy = replacementStrategies[i];
            const newContent = strategy();
            if (newContent !== content && newContent.length > 0) {
              // Validate that the replacement didn't break string syntax
              if (this.validateStringIntegrity(newContent, generatedImageUrl)) {
                content = newContent;
                replacements++;
                result.successfulReplacements++;
                strategyApplied = true;
                break;
              } else {
                console.warn(`⚠️ Strategy ${i + 1} would break string syntax for "${placeholder.placeholder}" in ${path.basename(filePath)}, trying next strategy`);
              }
            }
          }

          if (!strategyApplied) {
            console.warn(`⚠️ No strategy worked for "${placeholder.placeholder}" in ${path.basename(filePath)}`);
            result.failedReplacements++;
          }

        } catch (error) {
          console.error(`❌ Error replacing placeholder in ${filePath}:`, error);
          result.failedReplacements++;
        }
      } else {
        result.failedReplacements++;
      }
    }

    // Write the updated content back to file if any replacements were made
    if (content !== originalContent) {
      await fs.writeFile(filePath, content, 'utf-8');
   }
  }

  /**
   * Validate that string replacement didn't break syntax
   */
  private validateStringIntegrity(content: string, replacementUrl: string): boolean {
    try {
      // Check for basic string integrity around the replacement
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes(replacementUrl)) {
          // Count quotes to ensure they're balanced
          const singleQuotes = (line.match(/'/g) || []).length;
          const doubleQuotes = (line.match(/"/g) || []).length;
          const backticks = (line.match(/`/g) || []).length;
          
          // Basic check: if we have an odd number of quotes, the string is likely broken
          if (singleQuotes % 2 !== 0 && doubleQuotes % 2 === 0 && backticks % 2 === 0) {
            return false;
          }
          if (doubleQuotes % 2 !== 0 && singleQuotes % 2 === 0 && backticks % 2 === 0) {
            return false;
          }
          if (backticks % 2 !== 0 && singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.warn('Error validating string integrity:', error);
      return true; // If validation fails, assume it's okay to avoid blocking replacements
    }
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Check if the workspace has any placeholder images
   */
  async hasPlaceholderImages(): Promise<boolean> {
    try {
      const files = await this.findRelevantFiles();
      
      for (const filePath of files.slice(0, 50)) { // Check first 50 files for performance
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes('placehold.co')) {
            return true;
          }
        } catch (error) {
          // Ignore read errors and continue
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking for placeholder images:', error);
      return false;
    }
  }

  /**
   * Get a summary of placeholder images in the workspace
   */
  async getPlaceholderSummary(): Promise<{
    totalPlaceholders: number;
    fileCount: number;
    uniqueDescriptions: string[];
  }> {
    try {
      const files = await this.findRelevantFiles();
      const placeholders = await this.extractAllPlaceholders(files);
      
      const uniqueDescriptions = [...new Set(placeholders.map(p => p.altText))];
      const fileCount = new Set(placeholders.map(p => p.filePath)).size;

      return {
        totalPlaceholders: placeholders.length,
        fileCount,
        uniqueDescriptions
      };
    } catch (error) {
      console.error('Error getting placeholder summary:', error);
      return {
        totalPlaceholders: 0,
        fileCount: 0,
        uniqueDescriptions: []
      };
    }
  }
}

/**
 * Utility function to process placeholder images in a workspace
 */
export async function processWorkspacePlaceholderImages(
  workspaceRoot: string,
  sessionId: string,
  imgenModel?: string
): Promise<ProcessingResult> {
  const processor = new PlaceholderImageProcessor(workspaceRoot, sessionId, imgenModel);
  return await processor.processAllPlaceholderImages();
}

/**
 * Utility function to check if workspace has placeholder images
 */
export async function workspaceHasPlaceholderImages(workspaceRoot: string): Promise<boolean> {
  const processor = new PlaceholderImageProcessor(workspaceRoot, 'temp', undefined);
  return await processor.hasPlaceholderImages();
}
