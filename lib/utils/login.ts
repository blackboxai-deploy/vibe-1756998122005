import { sleep } from "../utils";

// Helper function to check if URL uses HTTP/HTTPS protocol
const isHttpProtocol = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    // If URL parsing fails, check if it starts with http/https
    return url.startsWith('http://') || url.startsWith('https://');
  }
};

// Helper function to validate redirect URLs
const isValidRedirectUrl = (url: string): boolean => {
  try {
    // Allow relative paths that start with /
    if (url.startsWith('/')) {
      return true;
    }

    // For absolute URLs, check if they're same origin
    const redirectUrl = new URL(url, window.location.origin);
    return redirectUrl.origin === window.location.origin;
  } catch {
    return false;
  }
};

// Helper function to clear login-related localStorage entries
const clearLoginRedirectPath = (): void => {
  try {
    localStorage.removeItem('login_redirect_path');
  } catch (e) {
    console.error('Failed to clear login redirect path from localStorage:', e);
  }
};

// Helper function to handle redirect logic
export const handleRedirect = async (redirectPath: string | null): Promise<void> => {
  // First check URL parameter, then localStorage
  let finalRedirectPath = redirectPath;
  if (!finalRedirectPath) {
    try {
      finalRedirectPath = localStorage.getItem('login_redirect_path');
    } catch (e) {
      console.error('Failed to retrieve redirect path from localStorage:', e);
    }
  }

  // Clear the stored redirect path after catching it
  clearLoginRedirectPath();

  if (finalRedirectPath) {
    try {
      // Decode the URL-encoded redirect parameter
      const decodedRedirectPath = decodeURIComponent(finalRedirectPath);

      // Handle special cases first
      if (finalRedirectPath === 'pricing') {
        window.location.href = window.location.href;
        return;
      } else if (finalRedirectPath === 'check-subscription') {
        window.location.href = window.location.href;
        return;
      } else if (finalRedirectPath === 'affiliate') {
        window.location.href = '/affiliate';
        return;
      }

      // Validate and use the decoded redirect URL for HTTP/HTTPS URLs
      if (isValidRedirectUrl(decodedRedirectPath)) {
        if (decodedRedirectPath.includes('/api/v0/connect-ide?redirect_uri=')) {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = decodedRedirectPath;
          document.body.appendChild(iframe);
          await sleep(1200)
          window.location.href = '/';
        } else {
          window.location.href = decodedRedirectPath;
        }
        return;
      }
    } catch (error) {
      console.error('Error decoding redirect URL:', error);
    }
  }

  // Default fallback
  const isInBuilder = window.location.pathname.includes("builder")
  window.location.href = `/${isInBuilder ? 'builder' : ''}?ref=login-success`;
};
