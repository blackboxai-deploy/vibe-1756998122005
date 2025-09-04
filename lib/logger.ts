type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`
    
    if (context && Object.keys(context).length > 0) {
      return `${prefix} ${message} ${JSON.stringify(context)}`
    }
    
    return `${prefix} ${message}`
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context))
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error instanceof Error ? {
        error: error.message,
        stack: error.stack,
      } : error ? { error: String(error) } : {})
    }
    
    console.error(this.formatMessage('error', message, errorContext))
  }

  // Specialized logging methods for different components
  api(endpoint: string, method: string, message: string, context?: LogContext): void {
    this.info(`[API:${method}:${endpoint}] ${message}`, context)
  }

  tool(toolName: string, message: string, context?: LogContext): void {
    this.info(`[TOOL:${toolName}] ${message}`, context)
  }

  sandbox(sandboxId: string, message: string, context?: LogContext): void {
    this.info(`[SANDBOX:${sandboxId}] ${message}`, context)
  }

  state(component: string, message: string, context?: LogContext): void {
    this.debug(`[STATE:${component}] ${message}`, context)
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    this.info(`[PERF:${operation}] Completed in ${duration}ms`, context)
  }
}

export const logger = new Logger()
