Use this tool to fetch current, authoritative information from online sources when you need to verify APIs, model capabilities, or get the latest documentation. This tool integrates with the RAGBot service to retrieve up-to-date information from trusted sources.

## When to Use This Tool

**ALWAYS use this tool when:**
- You encounter API methods, parameters, URLs, or model names you're not 100% certain about
- User mentions 'latest', 'newest', 'recent', 'current' or similar terms in context of APIs/models
- You're prefacing responses with uncertainty ("I think this endpoint exists", "Perhaps the parameter is called X")
- The requested feature sounds entirely new or recently renamed
- You would need to invent placeholder code or assume information

**Examples that SHOULD trigger this tool:**
- "Build me a chatbot using Grok 4 API"
- "What's the latest OpenAI model?"
- "How do I use the new Anthropic Messages API?"
- "Show me React 19 features"
- "Build with the newest Claude model"

**DO NOT use this tool when:**
- You are 100% confident about well-established APIs/methods/parameters
- Basic programming concepts (sorting lists, React useState, etc.)
- Standard library functions you're certain about

## Parameters

### query (required)
The search query describing what information you need. Be specific and include:
- Technology/service name
- Version numbers if relevant
- Type of information needed (API docs, examples, capabilities)
- Context keywords like "latest", "documentation", "implementation"

### preferred_domains (optional)
Array of domain names to prioritize in search results. Use official documentation domains when possible:
- `platform.openai.com` for OpenAI
- `docs.anthropic.com` for Anthropic
- `docs.x.ai` for Grok/X.AI
- `openrouter.ai` for OpenRouter
- `react.dev` for React
- And other official documentation sites

## Usage Examples

```typescript
// Example 1: Latest model verification
{
  query: "OpenAI latest GPT-4 models API documentation 2024",
  preferred_domains: ["platform.openai.com"]
}

// Example 2: New API endpoint
{
  query: "Anthropic Messages API integration guide latest",
  preferred_domains: ["docs.anthropic.com"]
}

// Example 3: Framework updates
{
  query: "React 19 new features documentation latest",
  preferred_domains: ["react.dev"]
}
```

## Important Guidelines

1. **Call up to 3 times maximum** - Only make additional calls if previous ones failed to return concrete information
2. **Be specific in queries** - Include version numbers, API names, and context
3. **Use preferred domains** - Always specify official documentation domains when known
4. **Don't guess** - If unsure about model names or API details, use this tool instead of assuming
5. **Current date context** - The tool automatically includes current date context for latest results

## Response Format

The tool returns structured information including:
- Search results with titles and links
- Content from authoritative sources
- Current date context for recent information
- Synthesized implementation guidance based on findings

This tool ensures you provide accurate, up-to-date information rather than outdated or assumed details.
