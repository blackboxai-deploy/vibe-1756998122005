# List Files Tool

Lists files and directories within the specified directory path in the Vercel Sandbox, automatically filtering out unnecessary build artifacts, dependencies, and temporary files.

## Usage

This tool provides clean, focused directory exploration by automatically excluding common build artifacts, dependencies, and temporary files that clutter development environments.

### Parameters

- **sandboxId**: The ID of the Vercel Sandbox to list files in
- **path**: The directory path to explore (relative to sandbox root)
- **recursive** (optional): Whether to list files recursively

### Automatic Filtering

The tool automatically excludes common unnecessary files and directories:

**Excluded Directories:**
- `node_modules` - Package dependencies
- `.git` - Git repository files
- `.next` - Next.js build output
- `dist`, `build` - Build output directories
- `.cache`, `coverage`, `.nyc_output` - Cache and coverage files
- `logs`, `tmp`, `temp` - Temporary directories
- `.vscode`, `.idea` - IDE configuration

**Excluded Files:**
- `*.log` - Log files
- `*.map` - Source map files
- `*.tsbuildinfo` - TypeScript build info
- `.DS_Store` - macOS system files
- `*.tmp`, `*.temp` - Temporary files
- `.env.*.local` - Local environment files

## Examples

### Clean Project Overview
```
path: "."
recursive: false
```
Lists only relevant files in project root (excludes node_modules, .git, etc.)

### Source Code Exploration  
```
path: "src"
recursive: true
```
Recursively explores source code while filtering out build artifacts.

### App Directory Structure
```
path: "app"
recursive: true
```
Shows complete app structure without clutter from temporary files.

## Performance Benefits

**Cleaner Output**: Focuses on relevant development files only
**Faster Processing**: Skips large dependency directories like `node_modules`  
**Better Navigation**: Easier to understand project structure without noise
**Focused Development**: See only files that matter for development

## Implementation Details

- **Recursive Mode**: Uses `find` command with exclusion patterns for deep traversal
- **Non-Recursive**: Uses `ls -1a` with post-processing filtering
- **Smart Detection**: Automatically identifies and excludes unnecessary files
- **Consistent Filtering**: Same exclusion rules apply to both recursive and non-recursive modes

## Important Notes

- If you need to access excluded directories (like `node_modules`), create a specific tool request
- Filtering helps keep file lists manageable and focused on development files
- The tool prioritizes showing source code, configuration, and documentation files
- Build artifacts and dependencies are hidden by default to reduce noise
