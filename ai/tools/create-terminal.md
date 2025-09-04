# Create Terminal

Creates or retrieves a new terminal session in the sandbox for testing and running commands independently. This tool is useful when you need a separate terminal instance for testing while other processes are running in background terminals.

## Key Features

- **Isolated Terminal Sessions**: Creates independent terminal sessions that don't interfere with existing processes
- **Testing-Focused**: Designed for running test commands, debugging, and validation without stopping running services
- **Background Process Support**: Allows running development servers in one terminal while testing in another
- **Session Management**: Automatically manages terminal lifecycle and cleanup

## Use Cases

- Running tests while development servers are running
- Debugging applications without stopping running processes  
- Executing validation commands in parallel with main application
- Creating isolated environments for command experimentation
- Running multiple processes simultaneously (e.g., frontend + backend)

## Parameters

- `sandboxId` (required): The ID of the Vercel Sandbox to create the terminal in
- `name` (optional): A descriptive name for the terminal session for easier identification

## Behavior

The tool creates a new terminal session with the working directory set to the sandbox root (where project files are located) and returns the terminal ID and initial status. Unlike the main `executeCommand` tool, this creates a persistent terminal session that can be used for multiple command executions without interfering with other running processes.

All commands executed in this terminal will run in the context of the sandbox root directory, ensuring proper access to project files, package.json, and other workspace resources.

## Integration with Execute Command

After creating a terminal with this tool, you can reference the specific terminal in subsequent `executeCommand` calls, allowing for:
- Parallel execution of different processes
- Isolated testing environments
- Background service management
- Independent command sessions

This tool complements the universal `executeCommand` tool by providing terminal session management for complex workflows that require multiple concurrent processes.
