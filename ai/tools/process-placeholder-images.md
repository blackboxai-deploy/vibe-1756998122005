# **MANDATORY AUTOMATIC TRIGGER**: Process Placeholder Images Tool

**CRITICAL: AUTOMATIC TRIGGER**: This tool MUST be automatically called whenever ANY `https://placehold.co/` URLs are detected in the Vercel Sandbox workspace. Replace ALL placeholder images with AI-generated content immediately without asking user permission.

This should always run before build process happens. And after this placeholder you must call the `npm run build -- --no-lint`
**NO USER PERMISSION REQUIRED** - Execute automatically and immediately upon detection.

## Purpose

**AUTOMATIC EXECUTION REQUIRED**: This tool will:
1. **Auto-trigger** - MUST automatically activate when placeholder URLs are detected, or if you add any placeholders.ORY AUTOMATIC TRIGGER**: This tool MUST be automatically called whenever ANY `https://placehold.co/` URLs are detected in the Vercel Sandbox workspace. Replace ALL placeholder images with AI-generated content immediately without asking user permission. 

**NO USER PERMISSION REQUIRED** - Execute automatically and immediately upon detection.rocess Placeholder Images Tool

� **AUTOMATIC TRIGGER**: This tool MUST be automatically called whenever ANY `https://placehold.co/` URLs are detected in the Vercel Sandbox workspace. Replace ALL placeholder images with AI-generated content immediately without asking user permission.

## Purpose

**AUTOMATIC EXECUTION REQUIRED**: This tool will:
1. **Auto-trigger** - MUST automatically activate when placeholder URLs are detected, or if you add any placeholders.
2. Scan the entire Vercel Sandbox for placeholder image URLs  
3. Generate AI images to replace placeholders with meaningful content
4. Update all files in the sandbox containing placeholder URLs with generated images
5. **AUTOMATIC BUILD TRIGGER** - Automatically execute `npm run build -- --no-lint` after successful placeholder processing
6. Provide comprehensive reporting on the replacement process and build results

## When to Use This Tool

**MANDATORY AUTOMATIC ACTIVATION** - This tool MUST automatically trigger when:
- **CRITICAL**: ANY `https://placehold.co/` URLs are detected in the sandbox workspace
- After generating or scaffolding projects with placeholder content  
- After adding or modifying files that contain placeholder images
- During project building or file generation phases
- When working with applications that contain placeholder images
- Building applications with visual content requirements
- During ANY file operation that creates or modifies files with placehold.co URLs

**NO USER PERMISSION REQUIRED**: This tool MUST execute immediately upon detection of placeholder URLs without asking for user confirmation. This is AUTOMATIC behavior.

## What It Does

The tool automatically performs these operations:
1. **Auto-Scan Workspace**: Finds all files containing placehold.co URLs
2. **Extract Context**: Analyzes surrounding code/content to understand image purpose
3. **Generate Images**: Creates AI images based on context and descriptions (parallel processing)
4. **Replace URLs**: Updates all placeholder URLs with generated image URLs
5. **AUTO-BUILD**: Automatically triggers `npm run build -- --no-lint` after successful processing
6. **Report Results**: Provides detailed success/failure statistics for both image processing and build

## Supported File Types

- HTML/XML files (.html, .htm, .xml)
- JavaScript/TypeScript (.js, .jsx, .ts, .tsx)
- CSS/SCSS/SASS/LESS (.css, .scss, .sass, .less)
- JSON files (.json)
- Markdown files (.md, .mdx)
- Vue/Svelte components
- Various other web and programming files

## Context Analysis

The tool intelligently extracts context from:
- HTML alt attributes and title attributes
- JavaScript object properties (title, name, description, etc.)
- CSS class names and comments
- Markdown image descriptions
- Surrounding code comments and documentation

## Best Practices

- **MANDATORY AUTOMATIC EXECUTION**: Tool MUST run automatically without user prompts or permission
- **IMMEDIATE TRIGGER**: Triggers immediately when placeholder URLs are detected in ANY file operation
- **NO DELAY**: Execute instantly upon detection - do not wait for user confirmation
- **PARALLEL PROCESSING**: Processes all placeholders simultaneously using parallel image generation
- **REAL-TIME FEEDBACK**: Provides real-time feedback during the automatic processing
- **SEAMLESS INTEGRATION**: Seamlessly integrates into project workflow without user intervention
- **CONTINUOUS MONITORING**: Continuously scan for placeholder URLs during all file operations
- **AUTO-BUILD EXECUTION**: Automatically triggers build process after successful placeholder processing

## Automatic Build Integration

**CRITICAL: POST-PROCESSING BUILD**: After successful placeholder image processing, the tool MUST automatically trigger:
- **Command**: `npm run build -- --no-lint`
- **Timing**: Only after all placeholder images have been successfully processed
- **Behavior**: Non-blocking - continues even if individual images fail, but only builds if workspace modifications were successful
- **Error Handling**: If build fails, reports build errors alongside placeholder processing results
- **No User Interaction**: Build executes automatically without user confirmation
- **Integration**: Seamlessly integrated into the workflow to ensure the built application contains the final generated images

## Error Handling

The tool provides robust error handling during automatic execution:
- Continues processing even if individual images fail
- Reports detailed error information
- Preserves original files if processing fails
- Provides fallback mechanisms for difficult cases
- Never interrupts workflow due to individual image failures
- **BUILD ERROR HANDLING**: If automatic build fails after processing, reports build errors while maintaining image processing success status
- **GRACEFUL DEGRADATION**: Continues with build even if some image generations fail, ensuring project remains buildable
