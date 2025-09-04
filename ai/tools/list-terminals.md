# List Terminals

Lists all available terminal sessions in the specified sandbox. This tool provides information about terminals that have been created through the UI, allowing you to see what terminals are available for command execution.

## When to use this tool

- When you need to see what terminals are available in a sandbox
- Before executing commands in specific terminals
- To understand the current terminal setup for parallel operations
- When troubleshooting terminal-related issues

## Key features

- Shows all active terminal sessions
- Provides terminal IDs for use with executeCommand
- Displays terminal names, working directories, and status
- Helps coordinate parallel operations across multiple terminals

## Best practices

- Use this tool before executing commands in specific terminals
- Check terminal status before running long-running processes
- Use terminal IDs from this output with the executeCommand tool
- Create terminals through the UI for better organization

## Integration with other tools

- Use terminal IDs from this output with `executeCommand` tool
- Combine with `createTerminal` for comprehensive terminal management
- Coordinate with file operations for organized development workflows

## Example usage

After running this tool, you can use the returned terminal IDs with executeCommand:

```
executeCommand({
  sandboxId: "sandbox_123",
  command: "npm",
  args: ["run", "build"],
  terminalId: "term_456" // From listTerminals output
})
