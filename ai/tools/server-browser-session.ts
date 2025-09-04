import * as fs from "fs/promises"
import * as path from "path"
import { Browser, Page, chromium } from "playwright"

export interface BrowserActionResult {
  execution_success?: boolean
  screenshot?: string
  logs?: string
  console_logs?: string
  execution_logs?: string
  currentUrl?: string
  currentMousePosition?: string
}

export class ServerBrowserSession {
  private browser?: Browser
  private page?: Page
  private currentMousePosition?: string
  private static instance?: ServerBrowserSession

  private constructor() {}

  static getInstance(): ServerBrowserSession {
    if (!ServerBrowserSession.instance) {
      ServerBrowserSession.instance = new ServerBrowserSession()
    }
    return ServerBrowserSession.instance
  }

  async launchBrowser(): Promise<BrowserActionResult> {
    console.log("Launching browser...")
    if (this.browser) {
      await this.closeBrowser()
    }

    try {
      this.browser = await chromium.launch({
        args: [
          "--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-extensions",
          "--force-device-scale-factor=1",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding"
        ],
        headless: true,
      })
      
      const context = await this.browser.newContext({
        viewport: { width: 900, height: 600 },
        deviceScaleFactor: 1,
        screen: { width: 900, height: 600 },
        ignoreHTTPSErrors: true,
        bypassCSP: true
      })
      this.page = await context.newPage()
      
      // Set a default background to ensure screenshots work
      await this.page.addStyleTag({
        content: `
          html, body {
            background-color: white !important;
            min-height: 100vh;
          }
        `
      })
      
      console.log("Browser launched successfully with 900x600 viewport")
      return {
        execution_success: true,
        logs: "Browser session started successfully with 900x600 viewport",
        execution_logs: "Browser launched and ready for interaction at 900x600 resolution"
      }
    } catch (error) {
      const errorMessage = `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`
      console.error(`[Error] Exception during Starting browser - ${errorMessage}`)
      return {
        execution_success: false,
        logs: errorMessage,
        execution_logs: errorMessage
      }
    }
  }

  async closeBrowser(): Promise<BrowserActionResult> {
    if (this.browser || this.page) {
      console.log("Closing browser...")
      try {
        await this.browser?.close()
        this.browser = undefined
        this.page = undefined
        this.currentMousePosition = undefined
        return {
          execution_success: true,
          logs: "Browser session closed successfully",
          execution_logs: "Browser closed successfully"
        }
      } catch (error) {
        const errorMessage = `Error closing browser: ${error instanceof Error ? error.message : String(error)}`
        console.warn(errorMessage)
        return {
          execution_success: false,
          logs: errorMessage,
          execution_logs: errorMessage
        }
      }
    }
    return {
      execution_success: true,
      logs: "Browser was already closed",
      execution_logs: "No browser to close"
    }
  }

  private async waitTillHTMLStable(timeout: number = 5000): Promise<void> {
    if (!this.page) return

    const checkDurationMs = 500
    const maxChecks = timeout / checkDurationMs
    let lastHTMLSize = 0
    let checkCounts = 1
    let countStableSizeIterations = 0
    const minStableSizeIterations = 3

    while (checkCounts <= maxChecks) {
      try {
        const html = await this.page.content()
        const currentHTMLSize = html.length
        
        console.log(`last: ${lastHTMLSize} <> curr: ${currentHTMLSize}`)
        
        if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
          countStableSizeIterations++
        } else {
          countStableSizeIterations = 0
        }

        if (countStableSizeIterations >= minStableSizeIterations) {
          console.log("Page rendered fully...")
          break
        }

        lastHTMLSize = currentHTMLSize
        await new Promise(resolve => setTimeout(resolve, checkDurationMs))
        checkCounts++
      } catch (error) {
        console.warn("Error checking HTML stability:", error)
        break
      }
    }
  }

  private async doAction(action: () => Promise<string>): Promise<BrowserActionResult> {
    let executionSuccess = true
    let screenshot: string | undefined
    
    if (!this.page) {
      executionSuccess = false
      throw new Error("Browser is not launched. This may occur if the browser was automatically closed.")
    }

    const logs: string[] = []
    let executionLog = ""
    let lastLogTs = Date.now()

    const consoleListener = (msg: any) => {
      try {
        if (msg.type() === "log") {
          logs.push(msg.text())
        } else {
          logs.push(`[${msg.type()}] ${msg.text()}`)
        }
        lastLogTs = Date.now()
      } catch (error) {
        logs.push(`[Console Error] ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    this.page.on("console", consoleListener)

    try {
      const result = await action()
      executionLog += `
 ${result}`
    } catch (err) {
      executionLog += `
 [Error] ${err instanceof Error ? err.message : String(err)}`
      executionSuccess = false
    }

    // Wait for console inactivity
    try {
      await this.waitForConsoleInactivity(lastLogTs)
    } catch (error) {
      // Timeout is expected
    }

    try {
      // Ensure page is ready for screenshot
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 })
      
      // Take high-quality screenshot with exact 900x600 dimensions to match viewport
      const screenshotBytes = await this.page.screenshot({ 
        type: 'png',
        fullPage: false, // Only capture viewport
        clip: { x: 0, y: 0, width: 900, height: 600 }, // Exact viewport dimensions
        omitBackground: false
      })
      
      if (screenshotBytes && screenshotBytes.length > 0) {
        const screenshotBase64 = screenshotBytes.toString('base64')
        screenshot = `data:image/png;base64,${screenshotBase64}`
        
        // Log screenshot success with dimensions
        console.log(`Screenshot captured: 900x600px, ${screenshotBase64.length} chars, data URI length: ${screenshot.length}`)
        executionLog += `\nScreenshot captured at 900x600 resolution (1:1 scale with viewport)`
      } else {
        console.error("Screenshot capture returned empty buffer")
        executionLog += `\n[Error] Screenshot capture returned empty buffer`
      }
    } catch (error) {
      console.error("Screenshot capture failed:", error)
      executionLog += `\n[Error] Error taking screenshot of the current state of page! ${error instanceof Error ? error.message : String(error)}`
      
      // Try alternative screenshot method as fallback
      try {
        console.log("Attempting fallback screenshot method...")
        const fallbackBytes = await this.page.screenshot({ 
          type: 'png',
          fullPage: false
        })
        if (fallbackBytes && fallbackBytes.length > 0) {
          const fallbackBase64 = fallbackBytes.toString('base64')
          screenshot = `data:image/png;base64,${fallbackBase64}`
          console.log(`Fallback screenshot captured: ${fallbackBase64.length} chars`)
          executionLog += `\nFallback screenshot captured successfully`
        }
      } catch (fallbackError) {
        console.error("Fallback screenshot also failed:", fallbackError)
        executionLog += `\n[Error] Fallback screenshot also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      }
    }

    try {
      this.page.off("console", consoleListener)
    } catch (error) {
      console.log(`Error removing console listener: ${error instanceof Error ? error.message : String(error)}`)
    }
    
    if (executionSuccess) {
      executionLog += "\n Action executed Successfully!"
    }

    return {
      execution_success: executionSuccess,
      screenshot,
      console_logs: logs.join("\n"),
      execution_logs: executionLog,
      currentUrl: this.page.url(),
      currentMousePosition: this.currentMousePosition,
      // Also provide the old format for backward compatibility
      logs: logs.join("\n")
    }
  }

  private async waitForConsoleInactivity(lastLogTs: number, timeout = 3000): Promise<void> {
    const startTime = Date.now()
    while (Date.now() - lastLogTs < 500 && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  async navigateToUrl(url: string): Promise<BrowserActionResult> {
    if (!this.page || !this.browser) {
      const launchResult = await this.launchBrowser()
      if (!launchResult.execution_success) {
        return launchResult
      }
    }
    
    return this.doAction(async () => {
      if (!this.page) throw new Error("Page not available")
      
      let executionLog = ""
      
      console.log(`Navigating to URL: ${url}`)
      
      try {
        const response = await this.page.goto(url, {
          timeout: 30000,
          waitUntil: "domcontentloaded"
        })

        if (!response) {
          executionLog += `\nNavigation failed or no response received for URL: ${url}`
          throw new Error(`Navigation failed or no response received for URL: ${url}`)
        } 
        
        const status = response.status()
        executionLog += `\nNavigated to URL: ${url} (Status: ${status})`
        
        if (status >= 400) {
          executionLog += `\nWarning: HTTP status ${status} - page may have errors`
        }
        
        // Wait for network to be idle and page to stabilize
        await this.page.waitForLoadState("networkidle", { timeout: 10000 })
        await this.waitTillHTMLStable()
        
        console.log(`Page navigation completed successfully for: ${url}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`Navigation error for ${url}:`, errorMsg)
        executionLog += `\nNavigation error: ${errorMsg}`
        throw error
      }
      
      return executionLog
    })
  }

  async click(coordinate: string): Promise<BrowserActionResult> {
    const [x, y] = coordinate.split(",").map(Number)
    
    // Validate coordinates are within viewport bounds
    if (isNaN(x) || isNaN(y)) {
      throw new Error(`Invalid coordinates: ${coordinate}. Must be in "x,y" format with valid numbers.`)
    }
    
    if (x < 0 || x > 900 || y < 0 || y > 600) {
      throw new Error(`Coordinates (${x}, ${y}) are outside viewport bounds (0-900, 0-600).`)
    }
    
    return this.doAction(async () => {
      if (!this.page) throw new Error("Page not available")
      
      let hasNetworkActivity = false
      let executionLog = ""
      
      console.log(`Clicking at coordinates: (${x}, ${y}) within 900x600 viewport`)
      
      const requestListener = () => {
        hasNetworkActivity = true
      }
      
      try {
        this.page.on("request", requestListener)
        
        // Move mouse to position first, then click
        await this.page.mouse.move(x, y)
        await this.page.mouse.click(x, y)
        
        this.currentMousePosition = coordinate
        executionLog += `\nClick Action Performed at exact coordinates (${x}, ${y})`
        executionLog += `\nViewport: 900x600 pixels, Click position: ${((x/900)*100).toFixed(1)}% from left, ${((y/600)*100).toFixed(1)}% from top`
        
        // Wait a moment for potential page changes
        await new Promise(resolve => setTimeout(resolve, 500))
        
        if (hasNetworkActivity) {
          try {
            console.log("Network activity detected, waiting for page to stabilize...")
            await this.page.waitForLoadState("networkidle", { timeout: 7000 })
            await this.waitTillHTMLStable()
            executionLog += "\nPage updated after click"
          } catch (error) {
            // Navigation timeout is common and not necessarily an error
            console.log("Navigation wait timeout (expected for non-navigating clicks)")
            executionLog += "\nClick completed (no page navigation)"
          }
        } else {
          executionLog += "\nClick completed (no network activity)"
        }
        
        console.log("Click action completed successfully")
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error("Click action failed:", errorMsg)
        executionLog += `\nClick error: ${errorMsg}`
        throw error
      } finally {
        this.page.off("request", requestListener)
      }
      
      return executionLog
    })
  }

  async type(text: string): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error("Page not available")
      
      await this.page.keyboard.type(text)
      return "Type action performed!"
    })
  }

  async scrollDown(): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error("Page not available")
      
      await this.page.evaluate("window.scrollBy({top: 400, behavior: 'auto'})")
      await new Promise(resolve => setTimeout(resolve, 300))
      return "Scroll down action performed!"
    })
  }

  async scrollUp(): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error("Page not available")
      
      await this.page.evaluate("window.scrollBy({top: -600, behavior: 'auto'})")
      await new Promise(resolve => setTimeout(resolve, 300))
      return "Scroll up action performed!"
    })
  }
}
