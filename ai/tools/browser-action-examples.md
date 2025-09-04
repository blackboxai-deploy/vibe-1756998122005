# Browser Action Tool - Real Playwright Implementation

This file demonstrates how to use the Browser Action tool for automated testing of web applications using Playwright.

## ✅ Real Browser Automation

The Browser Action tool now uses **real Playwright browser automation** with:
- **Actual Screenshots**: Real browser screenshots captured with every action
- **Console Logs**: Genuine browser console output, errors, and warnings
- **Mouse Tracking**: Accurate mouse position coordinates
- **URL Monitoring**: Real-time page navigation and URL changes
- **Network Activity**: Detection of navigation events and loading states

## Basic Testing Workflow

### 1. Launch Browser and Navigate
```typescript
browserAction({
  action: 'launch',
  url: 'http://localhost:3000'
})
// Returns: Screenshot of loaded page + console logs
```

### 2. Interact with Elements
```typescript
// Click on a button at coordinates (based on screenshot analysis)
browserAction({
  action: 'click',
  coordinate: '450,300'
})
// Returns: Screenshot after click + any console logs from interaction

// Type text into an input field (after clicking it)
browserAction({
  action: 'type',
  text: 'test@example.com'
})
// Returns: Screenshot showing typed text + console feedback

// Scroll to see more content
browserAction({
  action: 'scroll_down'
})
// Returns: Screenshot of new scroll position
```

### 3. Close Browser Session
```typescript
browserAction({
  action: 'close'
})
// Properly closes the Playwright browser instance
```

## Testing Scenarios

### Form Testing Example
1. **Launch**: `browserAction({ action: 'launch', url: 'http://localhost:3000/form' })`
2. **Analyze Screenshot**: Look at the returned screenshot to identify form elements
3. **Click Email Field**: `browserAction({ action: 'click', coordinate: '300,200' })`
4. **Type Email**: `browserAction({ action: 'type', text: 'test@example.com' })`
5. **Click Password Field**: `browserAction({ action: 'click', coordinate: '300,250' })`
6. **Type Password**: `browserAction({ action: 'type', text: 'password123' })`
7. **Click Submit**: `browserAction({ action: 'click', coordinate: '300,300' })`
8. **Verify Result**: Check screenshot and console logs for success/error messages
9. **Close**: `browserAction({ action: 'close' })`

### UI Component Testing
1. **Launch Component Demo**: Navigate to component showcase page
2. **Take Initial Screenshot**: Verify initial state
3. **Interact with Controls**: Click buttons, toggle switches, etc.
4. **Verify State Changes**: Each action returns updated screenshot
5. **Check Console**: Monitor for any JavaScript errors or warnings
6. **Test Responsive Behavior**: Scroll to test different viewport areas

## Real Implementation Features

### 🖼️ Screenshot Analysis
- High-quality PNG screenshots (900x600 viewport)
- Clickable screenshots that open in new tabs for detailed analysis  
- Screenshots automatically captured after every action
- Visual verification of page state changes

### 📜 Console Log Monitoring
- Real browser console output (log, warn, error, info)
- JavaScript errors and exceptions captured
- Network request logs and errors
- Page navigation events logged

### 🖱️ Mouse Position Tracking
- Accurate coordinate tracking for click actions
- Mouse position displayed in browser state info
- Coordinates validated against 900x600 viewport bounds

### 🔗 URL and Navigation Monitoring
- Real-time URL tracking as pages navigate
- Automatic waiting for page loads and network activity
- HTML stability checking to ensure pages are fully loaded

## Error Handling and Debugging

### Browser State Monitoring
The tool provides comprehensive feedback:
```typescript
{
  execution_success: true,
  screenshot: "data:image/png;base64,iVBORw0K...", // Real screenshot
  console_logs: "Page loaded successfully\n[info] Component initialized",
  execution_logs: "Click Action Performed!\nAction executed Successfully!",
  currentUrl: "http://localhost:3000/dashboard",
  currentMousePosition: "450,300"
}
```

### Common Issues and Solutions

1. **Element Not Found**: Use screenshot to identify correct coordinates
2. **Page Not Loaded**: Check execution logs for loading errors
3. **Console Errors**: Review console_logs for JavaScript issues  
4. **Navigation Issues**: Monitor currentUrl for unexpected redirects

## Best Practices for Testing

### 1. Visual Verification Workflow
- Always check screenshots before and after interactions
- Use screenshot coordinates to target elements precisely
- Verify visual changes match expected behavior

### 2. Console Log Analysis
- Monitor console logs for JavaScript errors
- Check for network request failures
- Watch for performance warnings or issues

### 3. Coordinate-Based Testing
- Take screenshot first to identify element positions
- Click in center of elements for reliability
- Account for dynamic content that may shift positions

### 4. Sequential Testing
- Always launch browser first
- Wait for each action to complete before proceeding
- Close browser at the end of each test session

## Integration with Sandbox Testing

Perfect for testing applications running in Vercel Sandbox:

```typescript
// 1. Create sandbox and start app
createSandbox({ ports: [3000] })
generateFiles({ /* app files */ })
runCommand({ command: 'pnpm', args: ['install'] })
waitCommand({ /* wait for install */ })
runCommand({ command: 'pnpm', args: ['dev'] })
getSandboxURL({ port: 3000 })

// 2. Test the running application
browserAction({ action: 'launch', url: 'https://sandbox-url.com' })
// ... perform test interactions
browserAction({ action: 'close' })
```

This provides end-to-end testing capabilities for the entire development workflow!
