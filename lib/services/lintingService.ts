interface LintResult {
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'error' | 'warning' | 'info';
}

interface LintRequest {
  file_path: string;
  content: string;
}

interface LintResponse {
  results: LintResult[];
}

const LINTING_API_BASE_URL = process.env.LINTING_API_BASE_URL || 'https://js-linter.onrender.com';

export class LintingService {
  private static instance: LintingService;
  private supportedExtensions: string[] | null = null;

  static getInstance(): LintingService {
    if (!LintingService.instance) {
      LintingService.instance = new LintingService();
    }
    return LintingService.instance;
  }

  async getSupportedExtensions(): Promise<string[]> {
    if (this.supportedExtensions) {
      return this.supportedExtensions;
    }

    try {
      const response = await fetch(`${LINTING_API_BASE_URL}/supported_extensions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get supported extensions: ${response.statusText}`);
      }

      this.supportedExtensions = await response.json();
      return this.supportedExtensions || [];
    } catch (error) {
      console.warn('Failed to get supported extensions from linting service:', error);
      return [];
    }
  }

  async isFileSupported(filePath: string): Promise<boolean> {
    const supportedExtensions = await this.getSupportedExtensions();
    const fileExtension = filePath.split('.').pop()?.toLowerCase();
    
    if (!fileExtension) {
      return false;
    }

    return supportedExtensions.some(ext => 
      ext.toLowerCase() === `.${fileExtension}` || 
      ext.toLowerCase() === fileExtension
    );
  }

  async lintContent(filePath: string, content: string): Promise<LintResult[]> {
    try {
      // Check if file is supported before making the request
      const isSupported = await this.isFileSupported(filePath);
      if (!isSupported) {
        return [];
      }

      // Ensure file path is absolute for the API
      const absolutePath = filePath.startsWith('/') ? filePath : `/${filePath}`;

      const request: LintRequest = {
        file_path: absolutePath,
        content,
      };

      const response = await fetch(`${LINTING_API_BASE_URL}/lint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Linting API error: ${response.statusText}`);
      }

      const result: LintResponse = await response.json();
      return result.results || [];
    } catch (error) {
      console.warn('Failed to lint content:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${LINTING_API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

export const lintingService = LintingService.getInstance();
