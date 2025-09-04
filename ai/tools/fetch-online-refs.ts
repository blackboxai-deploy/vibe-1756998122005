import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import description from './fetch-online-refs.md'
import { tool } from 'ai'
import z from 'zod/v3'

// Import the RAGBot client from the provided code
import axios, { AxiosInstance } from 'axios'

interface SearchResult {
  title: string;
  link: string;
  content: string;
  snippet?: string;
  source?: string;
  rank?: number;
  content_length?: number;
}

interface RAGBotResponse {
  results: Array<{
    title: string;
    link: string;
    content: string;
    snippet?: string;
  }>;
}

interface SearchResponse {
  result: string;
}

// Configuration constants
const RAGBOT_API_URL = "https://ragbot-0s1w.onrender.com/retrieve";
const RAGBOT_MAX_RETRIES = 1;

class RAGBotClient {
  private apiUrl: string;
  private httpClient: AxiosInstance;
  private cache: Map<string, any>;

  constructor(apiUrl: string = RAGBOT_API_URL) {
    this.apiUrl = apiUrl;
    this.cache = new Map();
    this.httpClient = axios.create({
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private log(message: string): void {
    // console.log(message);
  }

  /**
   * Main entry point for web search - fully data-driven with AI-powered analysis
   */
  async lookup_online_refs(searchQuery: string, preferredDomains: string[] = []): Promise<SearchResponse> {
    try {
      // Always get the current date for ultra-recent data
      const today = new Date().toISOString().split('T')[0];
      const currentDateTime = new Date().toISOString();
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      
      this.log(`[RAGBOT] Current date: ${today} | DateTime: ${currentDateTime} | Getting latest data for ${currentYear}`);
        
      // Remove year patterns and add current year context for latest data
      const yearPattern = /\b(20[0-2][0-9])\b/g;
      let processedQuery = searchQuery.replace(yearPattern, '');

      processedQuery = processedQuery.replace(/\s+/g, ' ').trim();
       
      // Enhance query with current date context for latest results
      processedQuery = `${processedQuery} latest updates ${currentYear} ${currentMonth}`;

      this.log(`Processing query with current date context: "${processedQuery}"`);
      
      const searchQueries = [processedQuery];
      const searchResults = await this.executeDataCollectionSearches(searchQueries);
      
      if (!searchResults.length) {
        return { result: "Sorry, I couldn't find relevant implementation information." };
      }
      
      const implementation = await this.synthesizeDataDrivenImplementation(
        processedQuery, 
        searchResults, 
        today,
        currentDateTime,
        currentYear,
        preferredDomains,
      );
      
      return { result: implementation };
      
    } catch (error) {
      console.error(`Error in data-driven web search: ${error}`);
      return await this.fallbackSearch(searchQuery);
    }
  }

  private async executeDataCollectionSearches(queries: string[]): Promise<SearchResult[]> {
    this.log(`Executing ${queries.length} data collection searches...`);
    
    const allResults: SearchResult[] = [];
    const searchPromises = queries.map(query => this.processSingleQuery(query));
    const queryResults = await Promise.all(searchPromises);

    for (const results of queryResults) {
      for (const result of results) {
        if (result.link) {
          allResults.push(result);
        }
      }
    }
    
    this.log(`Collected ${allResults.length} from web searches`);
    return allResults.slice(0, 40); // Limit for processing
  }

  private async synthesizeDataDrivenImplementation(
    query: string, 
    results: SearchResult[], 
    today: string,
    currentDateTime: string,
    currentYear: number,
    preferredDomains: string[],
  ): Promise<string> {
    let synthesisPrompt = `
USER REQUEST: "${query}"
CURRENT DATETIME: ${currentDateTime}

SEARCH RESULTS:
`;

    // Add search results
    results.forEach((result, index) => {
      const title = result.title || "Untitled";
      const content = result.content || "";
      const link = result.link || "";
      
      synthesisPrompt += `
Result ${index + 1}:
Title: ${title}
Source: ${link}
Content: ${content.length > 5000 ? content.substring(0, 5000) + "..." : content}

---
`;
    });

    return synthesisPrompt;
  }

  private async fallbackSearch(query: string): Promise<SearchResponse> {
    try {
      const results = await this.processSingleQuery(query);
      if (results.length > 0) {
        let fallbackResponse = `Found ${results.length} relevant results:\n\n`;
        
        results.forEach((result, index) => {
          const title = result.title || 'Untitled';
          const content = result.content || '';
          const link = result.link || '';
          
          fallbackResponse += `${index + 1}. **${title}**\n`;
          if (link) {
            fallbackResponse += `   Source: ${link}\n`;
          }
          if (content) {
            const contentPreview = content.length > 1000 ? content.substring(0, 1000) + "..." : content;
            fallbackResponse += `   ${contentPreview}\n\n`;
          }
        });
        
        return { result: fallbackResponse };
      } else {
        return { result: `I couldn't retrieve results for: ${query}` };
      }
    } catch (error) {
      return { result: `Search error: ${error}` };
    }
  }

  private async retrieve(query: string, maxRetries: number = RAGBOT_MAX_RETRIES): Promise<RAGBotResponse | null> {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().split('T')[0];
    
    // Enhanced payload with current date context for latest results
    const payload = { 
      query: `${query}`, 
      top_n: 8, 
      rank_by: "relevance",
      date_context: currentDate,
      year_filter: currentYear
    };
    let retryCount = 0;
    let backoffTime = 1000;
    
    while (retryCount < maxRetries) {
      try {
        this.log(`Querying RAGBot API with current date context (${currentDate}): ${query}`);
        const response = await this.httpClient.post(this.apiUrl, payload);
        
        if (response.status === 200) {
          const result = response.data as RAGBotResponse;
          this.cache.set(query, result);
          return result;
        } else {
          console.error(`API error: Status ${response.status}, ${response.data}`);
        }
        
      } catch (error) {
        console.error(`RAGBot API request failed: ${error}`);
      }
      
      retryCount++;
      if (retryCount < maxRetries) {
        this.log(`Retrying in ${backoffTime}ms... (Attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        backoffTime *= 2;
      }
    }
    
    console.error(`Failed to get results from RAGBot API after ${maxRetries} attempts`);
    return null;
  }

  private async formatResultsToSearchDocs(response: RAGBotResponse): Promise<SearchResult[]> {
    if (!response || !response.results) {
      console.warn("Invalid or empty RAGBot API response");
      return [];
    }
    
    try {
      const formattedDocs: SearchResult[] = [];
      this.log(`Processing ${response.results.length} results from RAGBot API`);
      
      const processedLinks = new Set<string>();
      
      response.results.forEach((result, index) => {
        const title = result.title || "Untitled Document";
        const link = result.link || "";
        
        if (!link || processedLinks.has(link)) {
          return;
        }
        
        const content = result.content || "";
        const snippet = result.snippet || "";
        const cleanContent = content || snippet;
        
        let summarizedContent: string;
        if (cleanContent.length > 5000) {
          summarizedContent = `Citation Link: ${link}\nContent: ${cleanContent.substring(0, 5000)}...${cleanContent.substring(cleanContent.length - 500)}`;
        } else {
          summarizedContent = `Citation Link: ${link}\nContent: ${cleanContent}`;
        }
        
        processedLinks.add(link);

        const formattedDoc: SearchResult = {
          title,
          link,
          content: summarizedContent,
          snippet: snippet.length > 300 ? snippet.substring(0, 300) : snippet,
          source: "ragbot_api",
          rank: index + 1,
          content_length: cleanContent.length
        };
        
        formattedDocs.push(formattedDoc);
        this.log(`Processed RAGBot result #${index + 1}: ${title} (${cleanContent.length} chars)`);
      });
      
      return formattedDocs;
      
    } catch (error) {
      console.error(`Error formatting RAGBot results: ${error}`);
      return [];
    }
  }

  private async processSingleQuery(query: string): Promise<SearchResult[]> {
    try {
      this.log(`Sending query to RAGBot API: ${query}`);
      const response = await this.retrieve(query);
      
      if (response) {
        const formattedResults = await this.formatResultsToSearchDocs(response);
        const totalResults = formattedResults.length;
        
        const topResults = totalResults > 8 ? formattedResults.slice(0, 8) : formattedResults;
        
        this.log(`Got ${totalResults} results from RAGBot API, using top ${topResults.length}`);
        return topResults;
      } else {
        console.warn(`No results returned from RAGBot API for query: ${query}`);
      }
    } catch (error) {
      console.error(`Error processing query with RAGBot API: ${error}`);
    }
    
    return [];
  }
}

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const fetchOnlineRefs = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      query: z
        .string()
        .describe('The search query describing what information you need. Be specific and include technology/service name, version numbers, and context.'),
      preferred_domains: z
        .array(z.string())
        .optional()
        .describe('Array of domain names to prioritize in search results (e.g., ["platform.openai.com", "docs.anthropic.com"]). Use official documentation domains when possible.'),
    }),
    execute: async (
      { query, preferred_domains = [] },
      { toolCallId }
    ) => {
      // Write initial status update
      writer.write({
        id: toolCallId,
        type: 'data-fetch-online-refs',
        data: { 
          query,
          preferred_domains,
          status: 'loading' 
        },
      })

      try {
        // Initialize RAGBot client and perform search
        const ragbotClient = new RAGBotClient();
        const searchResponse = await ragbotClient.lookup_online_refs(query, preferred_domains);
        
        // Write completion status with results
        writer.write({
          id: toolCallId,
          type: 'data-fetch-online-refs',
          data: { 
            query,
            preferred_domains,
            status: 'done',
            result: searchResponse.result,
            timestamp: new Date().toISOString()
          },
        })

        // Return the synthesized results for the model
        return `Online reference search completed for: "${query}"\n\nResults:\n${searchResponse.result}`
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        
        // Write error status
        writer.write({
          id: toolCallId,
          type: 'data-fetch-online-refs',
          data: { 
            query,
            preferred_domains,
            status: 'done',
            error: errorMessage
          },
        })

        return `Error fetching online references for "${query}": ${errorMessage}`
      }
    },
  })
