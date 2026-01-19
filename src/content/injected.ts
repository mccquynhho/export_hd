/**
 * Injected script - runs in page context, can access page's localStorage
 * This script is injected into the page to access the page's localStorage
 */

// Function to get token from page's localStorage
function getTokenFromPage(): string | null {
  try {
    // Common token keys to check
    const tokenKeys = [
      'token',
      'access_token',
      'authToken',
      'bearer_token',
      'accessToken',
      'auth_token',
      'jwt',
      'jwt_token',
    ];

    for (const key of tokenKeys) {
      const token = localStorage.getItem(key);
      if (token) {
        console.log(`[Export HD] Found token with key: ${key}`);
        return token;
      }
    }

    // Also check sessionStorage
    for (const key of tokenKeys) {
      const token = sessionStorage.getItem(key);
      if (token) {
        console.log(`[Export HD] Found token in sessionStorage with key: ${key}`);
        return token;
      }
    }

    return null;
  } catch (error) {
    console.error('[Export HD] Error getting token from page:', error);
    return null;
  }
}

// Listen for messages from content script
window.addEventListener('message', (event) => {
  // Only accept messages from our extension
  if (event.source !== window) return;

  if (event.data && event.data.type === 'GET_AUTH_TOKEN') {
    const token = getTokenFromPage();
    
    // Send token back to content script
    window.postMessage({
      type: 'AUTH_TOKEN_RESPONSE',
      token: token,
      requestId: event.data.requestId,
    }, '*');
  }
});

console.log('[Export HD] Injected script loaded');
