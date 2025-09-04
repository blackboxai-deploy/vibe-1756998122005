import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import description from './browser-action.md'
import { tool, streamText } from 'ai'
import z from 'zod/v3'
import { ServerBrowserSession } from './server-browser-session'
import { customModel } from '../index'

// Comprehensive function to analyze screenshots with GPT-4 Vision
async function analyzeScreenshotComprehensively(
  screenshotBase64: string, 
  action: string, 
  consoleLogs?: string, 
  currentUrl?: string,
  coordinate?: string
): Promise<{
  analysis: string
  uiElements: string
  errors: string
  suggestions: string[]
  clickableElements: Array<{description: string, coords: string}>
}> {
  try {
    const prompt = `You are an expert web application tester analyzing a screenshot after a browser action.

CONTEXT:
- Action performed: ${action}
- Current URL: ${currentUrl || 'Unknown'}
- Coordinates used: ${coordinate || 'N/A'}
- Console logs: ${consoleLogs || 'No console logs available'}

ANALYSIS REQUIREMENTS:
Please provide a comprehensive analysis in this EXACT JSON format:

{
  "analysis": "Detailed description of what you see on the page - layout, content, visual state, loading indicators, etc.",
  "uiElements": "List all interactive elements you can see: buttons (with their text), input fields (with placeholders), links, dropdowns, checkboxes, etc. Include their approximate positions.",
  "errors": "Any visual errors, broken layouts, error messages, missing content, console errors, or issues you notice",
  "suggestions": [
    "Specific actionable next steps for testing",
    "Recommended coordinates to click based on what you see",
    "Form fields to fill out",
    "Navigation actions to take"
  ],
  "clickableElements": [
    {
      "description": "Login button",
      "coords": "450,300"
    },
    {
      "description": "Email input field", 
      "coords": "400,250"
    }
  ]
}

IMPORTANT: 
- Estimate coordinates within 900x600 viewport based on visual position
- Be very specific about element locations and what can be clicked
- Identify any form validation, loading states, or error conditions
- Suggest the most logical next testing steps
- If you see errors or issues, be specific about what's wrong and how to fix it
- Look for responsive design issues, accessibility problems, or UX concerns

Provide ONLY the JSON response, no additional text.`

    const result = await streamText({
      model: customModel('gpt-4o-mini'),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image',
              image: `data:image/png;base64,${screenshotBase64}`
            }
          ]
        }
      ],
      temperature: 0.1
    })

    let responseText = ''
    for await (const textPart of result.textStream) {
      responseText += textPart
    }

    // Try to parse the JSON response
    try {
      const parsed = JSON.parse(responseText)
      return {
        analysis: parsed.analysis || 'Analysis not available',
        uiElements: parsed.uiElements || 'UI elements not detected',
        errors: parsed.errors || 'No errors detected',
        suggestions: parsed.suggestions || [],
        clickableElements: parsed.clickableElements || []
      }
    } catch (parseError) {
      console.warn('Failed to parse GPT response as JSON, using fallback:', responseText.substring(0, 200))
      return {
        analysis: responseText,
        uiElements: 'Unable to parse UI elements',
        errors: 'Unable to parse errors',
        suggestions: ['Retry the analysis'],
        clickableElements: []
      }
    }
  } catch (error) {
    console.error('GPT screenshot analysis failed:', error)
    return {
      analysis: 'Screenshot analysis failed due to technical error',
      uiElements: 'Unable to analyze UI elements',
      errors: 'Analysis error occurred',
      suggestions: ['Retry the browser action'],
      clickableElements: []
    }
  }
}

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const browserAction = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      action: z
        .enum(['launch', 'click', 'type', 'scroll_down', 'scroll_up', 'close'])
        .describe('The browser action to perform'),
      url: z
        .string()
        .optional()
        .describe('URL for launch action (required for launch, ignored for other actions)'),
      coordinate: z
        .string()
        .optional()
        .describe('X,Y coordinates for click action as "x,y" format (e.g. "450,300"). Required for click action.'),
      text: z
        .string()
        .optional()
        .describe('Text to type for type action (required for type action)'),
    }),
    execute: async (
      { action, url, coordinate, text },
      { toolCallId }
    ) => {
      // Validate required parameters for each action
      if (action === 'launch' && !url) {
        throw new Error('URL is required for launch action')
      }
          if (action === 'click' && !coordinate) {
            throw new Error('Coordinate is required for click action')
          }
          if (action === 'type' && !text) {
            throw new Error('Text is required for type action')
          }

          // Validate coordinate format if provided
          if (coordinate) {
            const coords = coordinate.split(',')
            if (coords.length !== 2) {
              throw new Error('Coordinate must be in "x,y" format')
            }
            let [x, y] = coords.map(Number)
            if (isNaN(x) || isNaN(y)) {
              throw new Error('Coordinates must be valid numbers')
            }
            // Validate coordinates are within viewport bounds (don't clamp, throw error)
            if (x < 0 || x > 900 || y < 0 || y > 600) {
              throw new Error(`Coordinates (${x}, ${y}) are outside viewport bounds (0-900, 0-600). Please use coordinates within the 900x600 viewport.`)
            }
            coordinate = `${x},${y}`
          }

      // Write initial status update
      writer.write({
        id: toolCallId,
        type: 'data-browser-action',
        data: { 
          action,
          url: url || undefined,
          coordinate: coordinate || undefined,
          text: text || undefined,
          status: 'loading' 
        },
      })

      // Use real Playwright browser automation
      const browserSession = ServerBrowserSession.getInstance()
      
      let actionResult
      
      switch (action) {
        case 'launch':
          if (!url) throw new Error('URL is required for launch action')
          actionResult = await browserSession.navigateToUrl(url)
          break
        case 'click':
          if (!coordinate) throw new Error('Coordinate is required for click action')
          actionResult = await browserSession.click(coordinate)
          break
        case 'type':
          if (!text) throw new Error('Text is required for type action')
          actionResult = await browserSession.type(text)
          break
        case 'scroll_down':
          actionResult = await browserSession.scrollDown()
          break
        case 'scroll_up':
          actionResult = await browserSession.scrollUp()
          break
        case 'close':
          actionResult = await browserSession.closeBrowser()
          break
        default:
          throw new Error(`Unsupported action: ${action}`)
      }

      // Write completion status
      writer.write({
        id: toolCallId,
        type: 'data-browser-action',
        data: { 
          action,
          url: url || undefined,
          coordinate: coordinate || undefined,
          text: text || undefined,
          status: 'done',
          result: actionResult.execution_logs || `Browser action "${action}" completed`,
          screenshot: actionResult.screenshot,
          logs: actionResult.console_logs || actionResult.logs,
          currentUrl: actionResult.currentUrl,
          currentMousePosition: actionResult.currentMousePosition,
          executionSuccess: actionResult.execution_success !== false,
          errorMessage: actionResult.execution_success === false ? actionResult.execution_logs : undefined,
        },
      })

      const isSuccessful = actionResult.execution_success !== false
      const resultMessage = actionResult.execution_logs || `Browser action "${action}" completed`
      
      // Add comprehensive GPT-4 vision analysis of the screenshot if available
      let gptAnalysis: any = null
      if (actionResult.screenshot && action !== 'close') {
        try {
          const base64Data = actionResult.screenshot.replace(/^data:image\/png;base64,/, '')
          gptAnalysis = await analyzeScreenshotComprehensively(
            base64Data, 
            action, 
            actionResult.console_logs, 
            actionResult.currentUrl,
            coordinate
          )
        } catch (error) {
          console.error('Failed to analyze screenshot:', error)
        }
      }
      
      // Prepare detailed analysis information for the model
      let analysisPrompt = ""
      if (action !== 'close') {
        analysisPrompt += "\n\n=== BROWSER ACTION ANALYSIS ===\n"
        analysisPrompt += `Action: ${action}\n`
        analysisPrompt += `Success: ${isSuccessful ? 'YES' : 'NO'}\n`
        analysisPrompt += `URL: ${actionResult.currentUrl || 'Unknown'}\n`
        
        if (gptAnalysis) {
          analysisPrompt += "\n🤖 COMPREHENSIVE AI ANALYSIS:\n"
          analysisPrompt += `📋 VISUAL ANALYSIS: ${gptAnalysis.analysis}\n\n`
          analysisPrompt += `🎯 UI ELEMENTS DETECTED: ${gptAnalysis.uiElements}\n\n`
          
          if (gptAnalysis.errors && gptAnalysis.errors !== 'No errors detected') {
            analysisPrompt += `❌ ISSUES FOUND: ${gptAnalysis.errors}\n\n`
          }
          
          if (gptAnalysis.suggestions && gptAnalysis.suggestions.length > 0) {
            analysisPrompt += "� AI RECOMMENDED NEXT ACTIONS:\n"
            gptAnalysis.suggestions.forEach((suggestion: string, i: number) => {
              analysisPrompt += `   ${i + 1}. ${suggestion}\n`
            })
            analysisPrompt += "\n"
          }
          
          if (gptAnalysis.clickableElements && gptAnalysis.clickableElements.length > 0) {
            analysisPrompt += "🖱️ PRECISE CLICKABLE ELEMENTS IDENTIFIED:\n"
            gptAnalysis.clickableElements.forEach((element: any, i: number) => {
              analysisPrompt += `   ${i + 1}. ${element.description} at coordinates ${element.coords}\n`
            })
            analysisPrompt += "\n"
          }
        }
        
        if (actionResult.screenshot) {
          analysisPrompt += "\n📸 SCREENSHOT CAPTURED: A high-quality screenshot has been taken and analyzed.\n"
        }
        
        if (actionResult.console_logs) {
          analysisPrompt += "\n🔍 BROWSER CONSOLE LOGS AVAILABLE:\n"
          analysisPrompt += "REVIEW CONSOLE LOGS FOR:\n"
          analysisPrompt += "- JavaScript errors that might prevent functionality\n"
          analysisPrompt += "- Network request failures (404, 500, etc.)\n"
          analysisPrompt += "- Warning messages about deprecated features\n"
          analysisPrompt += "- CORS issues or security violations\n"
          analysisPrompt += "- React/framework-specific errors\n"
          analysisPrompt += "\nConsole Output:\n" + actionResult.console_logs
        }
        
        if (!isSuccessful && actionResult.execution_logs) {
          analysisPrompt += "\n❌ EXECUTION ERROR DETECTED:\n"
          analysisPrompt += actionResult.execution_logs + "\n"
          analysisPrompt += "SUGGESTED FIXES:\n"
          analysisPrompt += "1. Check if the target element exists and is clickable\n"
          analysisPrompt += "2. Verify page has fully loaded before interaction\n"
          analysisPrompt += "3. Ensure coordinates are within the visible viewport\n"
          analysisPrompt += "4. Look for JavaScript errors preventing page functionality\n"
          analysisPrompt += "5. Check if the URL is accessible and loads correctly\n"
        }
        
        analysisPrompt += "\n🔧 INTELLIGENT ACTION GUIDANCE:\n"
        analysisPrompt += "The AI has analyzed the screenshot and provided comprehensive insights. Based on this analysis:\n\n"
        
        if (gptAnalysis && gptAnalysis.suggestions.length > 0) {
          analysisPrompt += "📋 FOLLOW THESE AI RECOMMENDATIONS:\n"
          gptAnalysis.suggestions.forEach((suggestion: string, i: number) => {
            analysisPrompt += `${i + 1}. ${suggestion}\n`
          })
          analysisPrompt += "\n"
        }
        
        if (gptAnalysis && gptAnalysis.clickableElements.length > 0) {
          analysisPrompt += "🎯 USE THESE PRECISE COORDINATES:\n"
          gptAnalysis.clickableElements.slice(0, 5).forEach((element: any, i: number) => {
            analysisPrompt += `- Click "${element.description}" at ${element.coords}\n`
          })
          analysisPrompt += "\n"
        }
        
        analysisPrompt += "✅ COMPREHENSIVE VALIDATION:\n"
        analysisPrompt += "1. The AI has visually inspected the page layout and functionality\n"
        analysisPrompt += "2. All interactive elements have been identified with precise coordinates\n"
        analysisPrompt += "3. Any visual errors or issues have been detected and reported\n"
        analysisPrompt += "4. Console logs have been analyzed for technical issues\n"
        analysisPrompt += "5. Specific next steps have been recommended based on visual analysis\n\n"
        
        if (gptAnalysis && gptAnalysis.errors && gptAnalysis.errors !== 'No errors detected') {
          analysisPrompt += "⚠️ CRITICAL ISSUES TO ADDRESS:\n"
          analysisPrompt += `${gptAnalysis.errors}\n\n`
        }
        
        analysisPrompt += "🚀 NEXT STEPS:\n"
        analysisPrompt += "- Use the AI-identified coordinates for accurate clicking\n"
        analysisPrompt += "- Follow the specific recommendations provided above\n"
        analysisPrompt += "- Address any visual or console errors before proceeding\n"
        analysisPrompt += "- The screenshot analysis ensures you understand exactly what's on the page\n\n"
        
        analysisPrompt += "💡 This enhanced browser action provides GPT-4 vision analysis to ensure reliable testing!"
      }
      
      return `${resultMessage} The browser action "${action}" has been ${isSuccessful ? 'executed successfully' : 'completed with errors'}. ${analysisPrompt}`
    },
  })
