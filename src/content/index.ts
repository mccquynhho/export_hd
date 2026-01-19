/// <reference types="chrome" />
import type { StartCrawlRequest, MessageResponse } from '@/types';
import { scrapeCurrentPage, hasNextPage, goToNextPage } from './domScraper';
import { getMessage } from '@/utils/helpers';
import type { GetAuthTokenRequest, GetAuthTokenResponse } from '@/types';

/**
 * Request token from background (reads cookie jwt)
 */
function getTokenFromBackground(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage<GetAuthTokenRequest, GetAuthTokenResponse>(
      { action: 'GET_AUTH_TOKEN' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Export HD] Failed to get token:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        resolve(response?.token || null);
      }
    );
  });
}

/**
 * Main function to start the download process
 * Handles pagination and data extraction
 */
async function startDownloadProcess(): Promise<void> {
  const token = await getTokenFromBackground();

  if (!token) {
    alert(getMessage('noTokenError'));
    return;
  }

  let hasMorePages = true;
  let totalInvoices = 0;

  try {
    while (hasMorePages) {
      // 1. Scrape data from current page
      const invoices = scrapeCurrentPage();
      totalInvoices += invoices.length;
      
      console.log(`[Export HD] Tìm thấy ${invoices.length} hóa đơn trên trang này. Tổng: ${totalInvoices}`);

      if (invoices.length > 0) {
        // 2. Send invoice data to background for download
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_BATCH',
          data: invoices,
          token: token,
        });
      }

      // 3. Check and navigate to next page
      if (hasNextPage()) {
        await goToNextPage();
      } else {
        hasMorePages = false;
        console.log('[Export HD] Đã hết trang. Tổng số hóa đơn:', totalInvoices);
      }
    }
  } catch (error) {
    console.error('[Export HD] Error in download process:', error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (request: StartCrawlRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    if (request.action === 'START_CRAWL') {
      startDownloadProcess()
        .then(() => {
          sendResponse({ status: 'started' });
        })
        .catch((error) => {
          console.error('[Export HD] Failed to start crawl:', error);
          sendResponse({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Unknown error' 
          });
        });
      
      // Return true to indicate we will send a response asynchronously
      return true;
    }
  }
);

console.log('[Export HD] Content script loaded');
