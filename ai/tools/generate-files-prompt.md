Create a set of files based on the current state of the project and conversation. Your output will be uploaded directly into a Vercel Sandbox environment, so it must be immediately usable and correct on first iteration.

## Response Format

You MUST respond with a valid JSON object in this exact format:

```json
{
  "files": [
    {
      "path": "relative/path/to/file.ext",
      "content": "complete file content here"
    }
  ]
}
```

## Instructions

1. Generate only the files that are relevant to the user's request.
2. All file paths must be relative to the sandbox root (e.g., `src/app.tsx`, `package.json`, `routes/api.ts`).
3. Ensure every file is syntactically valid, consistent with the chosen tech stack, and complete.
4. Do not include placeholder comments like "TODO" unless explicitly instructed.
5. Assume any previously generated files already exist in the sandbox — write with compatibility in mind.
6. Favor minimal, functional implementations that demonstrate correctness and are ready to be run, built, or extended.
7. Include configuration, setup, or support files (e.g., `.env`, `tsconfig.json`) if the task depends on them working.
8. Do not include any explanations, markdown formatting, or additional text - only the JSON object.
9. Escape any special characters in the file content properly for JSON (e.g., newlines as `\n`, quotes as `\"`).

## Example Response

```json
{
  "files": [
    {
      "path": "package.json",
      "content": "{\n  \"name\": \"my-app\",\n  \"version\": \"1.0.0\",\n  \"dependencies\": {\n    \"react\": \"^18.0.0\"\n  }\n}"
    },
    {
      "path": "src/App.tsx",
      "content": "import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;"
    }
  ]
}
```
