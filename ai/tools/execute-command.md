Use this tool to execute commands in a Vercel Sandbox with intelligent handling of command lifecycle, output monitoring, and completion detection.

This is a **universal command execution tool** that automatically:
- Runs the command
- Monitors output in real-time
- Waits appropriately based on command type
- Handles errors and provides analysis
- Stops commands when needed
- **Supports terminal isolation** for dedicated build, test, and development workflows

## Terminal-Based Process Management

**CRITICAL**: Use with dedicated terminals created by `createTerminal` tool for optimal process management:

### Build Terminal Integration
- **Reference build terminals**: `executeCommand(command: "pnpm", args: ["build"], terminalId: "build-terminal-id")`
- **Process Isolation**: Keep builds separate from other operations
- **Long-Running Monitoring**: Build processes can take 2-5+ minutes - dedicated terminals prevent blocking
- **Error Tracking**: Monitor build-specific errors without interference from other processes

### Test Terminal Integration  
- **Reference test terminals**: `executeCommand(command: "pnpm", args: ["test"], terminalId: "test-terminal-id")`
- **Test Isolation**: Run tests independently of builds and servers
- **Parallel Testing**: Execute tests while builds or servers run in other terminals
- **Result Monitoring**: Track test results and failures in dedicated test environment

### Development Server Integration
- **Reference dev-server terminals**: `executeCommand(command: "pnpm", args: ["dev"], terminalId: "dev-server-id")`  
- **Server Isolation**: Keep development servers running independently
- **Startup Monitoring**: Monitor server startup without affecting other processes
- **Health Checks**: Continuous monitoring of server status in dedicated terminal

**Best Practice Workflow**:
```
1. createTerminal(name: "build-terminal") → Get terminal ID
2. createTerminal(name: "test-terminal") → Get terminal ID  
3. createTerminal(name: "dev-server") → Get terminal ID
4. executeCommand(..., terminalId: "build-terminal-id") → Run builds
5. executeCommand(..., terminalId: "test-terminal-id") → Run tests
6. executeCommand(..., terminalId: "dev-server-id") → Run servers
```

## Automatic Command Management

The tool intelligently handles different types of commands:

### Build Commands (`build`, `compile`, `bundle`, `webpack`, `vite`, `rollup`, `tsc`, `next build`)
- **Waits**: Always waits for completion (up to 5 minutes)
- **Monitoring**: Continuously monitors output for progress and errors
- **Analysis**: Provides detailed error analysis if build fails
- **Auto-stop**: Stops if hanging or taking too long

### Development Servers (`dev`, `start`, `serve`, `preview`, `run dev`)
- **Waits**: Short wait (5-15 seconds) to verify startup
- **Monitoring**: Checks for successful startup or errors
- **Background**: Continues running in background if successful
- **Analysis**: Reports startup success/failure and provides server URL if available

### Installation Commands (`install`, `add`, `npm i`, `pnpm i`, `yarn`)
- **Waits**: Always waits for completion (up to 3 minutes)
- **Monitoring**: Tracks installation progress
- **Analysis**: Reports installed packages and any dependency issues
- **Auto-retry**: May suggest retries for network issues

### Test Commands (`test`, `jest`, `vitest`, `cypress`, `playwright`)
- **Waits**: Always waits for completion (up to 10 minutes)
- **Monitoring**: Tracks test progress and results
- **Analysis**: Provides detailed test results and failure analysis
- **Coverage**: Reports coverage information if available

### Quick Commands (`ls`, `cat`, `echo`, `pwd`, file operations)
- **Waits**: Always waits (usually completes quickly)
- **Monitoring**: Minimal monitoring needed
- **Analysis**: Simple output display

### Long-running Processes (servers, watchers, background tasks)
- **Waits**: Smart detection of when process is ready
- **Monitoring**: Continues background monitoring
- **Health Check**: Periodic health checks
- **Auto-management**: Handles restarts and failures

## Intelligent Features

### Auto-Wait Logic
- **Smart Timeout**: Different timeouts based on command type
- **Progress Detection**: Continues waiting if progress is detected
- **Completion Detection**: Recognizes when commands are truly done
- **Background Handling**: Knows when to let commands run in background

### Error Handling
- **Pattern Recognition**: Identifies common error types
- **Suggested Fixes**: Provides actionable solutions
- **Auto-retry**: Attempts retries for transient failures
- **Graceful Degradation**: Handles command failures elegantly

### Output Analysis
- **Real-time Processing**: Analyzes output as it streams
- **Error Classification**: Categorizes different types of errors
- **Success Indicators**: Recognizes successful completion markers
- **Performance Metrics**: Reports timing and resource usage

## Working Directory Context

All commands execute in the **sandbox root directory** by default, where project files are located. This ensures:
- Access to `package.json`, `tsconfig.json`, and other configuration files
- Proper resolution of relative paths in your project
- Correct execution of npm/pnpm scripts and build commands
- Access to `src/`, `public/`, and other project directories

You can override the working directory using the `cwd` parameter if needed for specific use cases.

## Usage Examples

```typescript
// Build command - automatically waits and analyzes (runs in sandbox root)
executeCommand({ 
  sandboxId: "sandbox_123", 
  command: "npm", 
  args: ["run", "build"],
  behavior: "auto" // Automatically determines behavior
})

// Dev server - starts and monitors startup (runs in sandbox root)
executeCommand({ 
  sandboxId: "sandbox_123", 
  command: "npm", 
  args: ["run", "dev"],
  behavior: "auto"
})

// Custom working directory if needed
executeCommand({ 
  sandboxId: "sandbox_123", 
  command: "ls", 
  args: ["-la"],
  cwd: "src" // Run in src subdirectory
})

// Force specific behavior if needed
executeCommand({ 
  sandboxId: "sandbox_123", 
  command: "node", 
  args: ["server.js"],
  behavior: "background" // Force background execution
})
```

## Execution Behaviors

- **`auto`** (default): Automatically determines best behavior based on command
- **`wait`**: Always wait for completion
- **`background`**: Start and continue in background
- **`monitor`**: Start, monitor briefly, then background
- **`quick`**: For commands that complete quickly

## Error Recovery

The tool includes automatic error recovery:
- Network timeouts → Retry with exponential backoff
- Permission errors → Suggest sudo or file permission fixes
- Missing dependencies → Suggest installation commands
- Port conflicts → Suggest alternative ports or killing existing processes
- Build failures → Analyze errors and suggest fixes

## When NOT to Use This Tool

- For file operations where you just need to read/edit files (use `readFile`/`editFile`)
- For simple sandbox management (use `createSandbox`/`getSandboxURL`)
- When you need very specific control over command timing (use individual tools)

## Command State Management

Unlike the individual tools, this universal tool:
- Maintains command state across the execution lifecycle
- Provides continuous monitoring and feedback
- Handles cleanup automatically
- Manages multiple related commands intelligently
- Provides comprehensive reporting and analysis
