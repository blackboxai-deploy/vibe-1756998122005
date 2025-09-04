Use this tool to interact with a Puppeteer-controlled browser for automated testing, web scraping, or UI interaction. This tool allows you to launch a browser, navigate to URLs, click elements, type text, scroll, and take screenshots for testing web applications.

## When to Use This Tool

Use this tool when:

1. You need to test a web application running in the sandbox
2. You want to perform automated browser testing or UI validation
3. You need to interact with web elements programmatically
4. You want to capture screenshots of web pages for debugging
5. You need to verify that a web application works correctly after deployment
6. You want to perform end-to-end testing scenarios

## Browser Action Types

### launch
- **Description**: Start a new browser instance and navigate to a URL
- **Required**: Must always be the first action in a browser session
- **Parameters**: `url` (required) - The URL to navigate to (use sandbox URL from get-sandbox-url tool)
- **Example**: Launch browser at sandbox URL obtained from get-sandbox-url tool

### click
- **Description**: Click at specific coordinates on the page
- **Parameters**: `coordinate` (required) - X,Y coordinates as "x,y" format
- **Important**: Always use coordinates from the provided screenshot to target elements accurately
- **Example**: Click at coordinates "450,300" to click a button in the center of a 900x600 viewport

### type
- **Description**: Type text into the currently focused element
- **Parameters**: `text` (required) - The text to type
- **Usage**: Usually used after clicking on an input field or text area
- **Example**: Type "Hello World" into a search box

### scroll_down
- **Description**: Scroll down the page by one viewport height (600px)
- **No Parameters**: This action scrolls automatically

### scroll_up
- **Description**: Scroll up the page by one viewport height (600px)
- **No Parameters**: This action scrolls automatically

### close
- **Description**: Close the browser instance and end the session
- **Required**: Must always be the final action in a browser session
- **No Parameters**: This action closes the browser

## Browser Session Rules

1. **Always start with `launch`**: Every browser session must begin by launching the browser at a URL
2. **Always end with `close`**: Every browser session must end by closing the browser
3. **Sequential actions**: You can only perform one action at a time and must wait for the response
4. **Screenshot feedback**: Each action (except close) returns a screenshot showing the current state
5. **Viewport size**: The browser window is 900x600 pixels - ensure coordinates are within this range
6. **Element targeting**: Always consult screenshots to determine accurate click coordinates
7. **No other tools during browsing**: While the browser is active, only use the browser_action tool

## Testing Workflow Examples

### Basic Website Testing
1. `launch` - Open the website
2. `click` - Click on navigation elements
3. `type` - Fill out forms
4. `scroll_down` - View more content
5. `close` - End the session

### Form Testing
1. `launch` - Navigate to the form page
2. `click` - Click on first input field
3. `type` - Enter test data
4. `click` - Click on next field
5. `type` - Enter more data
6. `click` - Submit the form
7. `close` - End the session

### UI Component Testing  
1. `launch` - Open the component demo page
2. `click` - Interact with buttons/controls
3. `scroll_down` - View different sections
4. Take screenshots to verify visual correctness
5. `close` - End the session

## Best Practices

- **Use accurate coordinates**: Always click in the center of elements based on screenshots
- **Wait for page loads**: The tool automatically waits for navigation and network activity
- **Test systematically**: Follow logical user flows when testing applications
- **Verify visual state**: Use the returned screenshots to confirm expected behavior
- **Handle errors gracefully**: If something doesn't work as expected, try alternative approaches
- **Keep sessions focused**: Don't mix different testing scenarios in one browser session

## Limitations

- Browser viewport is fixed at 900x600 pixels
- Cannot handle file uploads or downloads
- No support for browser extensions or plugins
- Cannot interact with browser developer tools
- Sessions must be linear (no branching or parallel actions)

## Error Recovery

If you encounter issues:
1. Close the current browser session
2. Identify the problem (wrong coordinates, page not loaded, etc.)
3. Launch a new session with corrected approach
4. Use alternative interaction methods (different coordinates, scroll first, etc.)

## Summary

Use Browser Action to automate web browser interactions for testing, validation, and debugging of web applications. Always follow the launch → interact → close pattern, use accurate coordinates from screenshots, and perform one action at a time for reliable automation.
