# Delete File Tool

Deletes an existing file from the Vercel Sandbox.

## Usage

Use this tool to remove files from your project. You need to provide:
- The sandbox ID where the file exists
- The file path (relative to the current working directory) to delete

## Examples

### Deleting a temporary file
```
path: "temp/data.json"
```

### Deleting a component file
```
path: "src/components/OldComponent.tsx"
```

### Deleting a configuration file
```
path: ".env.local"
```

## Important Notes

- If the file does not exist, the deletion will fail with an error
- This operation cannot be undone - make sure you really want to delete the file
- Be careful when deleting configuration files or important project files
- The file path should be relative to the sandbox's current working directory
- Deleting a file that is currently being used by running processes may cause issues
