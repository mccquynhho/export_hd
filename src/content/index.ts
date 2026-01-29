/// <reference types="chrome" />
import type { StartCrawlRequest, StopCrawlRequest, MessageResponse, InvoiceParams } from '@/types';
import { getMessage } from '@/utils/helpers';
import { fetchAllPurchaseInvoices } from '@/utils/api';
import type { GetAuthTokenRequest, GetAuthTokenResponse } from '@/types';

// Invoice types to fetch (mua vào)
const INVOICE_TYPES = [5, 6, 8];

// Flag to signal stop request
let stopRequested = false;

/**
 * Check if stop has been requested
 */
export function isStopRequested(): boolean {
  return stopRequested;
}

/**
 * Reset stop flag
 */
function resetStopFlag(): void {
  stopRequested = false;
}

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
 * Map API response invoice to InvoiceParams
 */
function mapToInvoiceParams(invoice: any): InvoiceParams {
  return {
    nbmst: String(invoice.nbmst || ''),
    khmshdon: String(invoice.khmshdon || ''),
    khhdon: String(invoice.khhdon || ''),
    shdon: String(invoice.shdon || ''),
  };
}

/**
 * Main function to start the download process using API
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
async function startDownloadProcess(startDate: string, endDate: string): Promise<void> {
  resetStopFlag();

  const token = await getTokenFromBackground();

  if (!token) {
    alert(getMessage('noTokenError'));
    return;
  }

  // Parse dates
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  console.log(`[Export HD] Fetching invoices from ${startDate} to ${endDate}`);

  let totalInvoices = 0;

  try {
    // Fetch all invoice types
    for (const invoiceType of INVOICE_TYPES) {
      // Check for stop request
      if (stopRequested) {
        console.log('[Export HD] Stop requested, aborting...');
        return;
      }

      console.log(`[Export HD] Fetching invoice type: ${invoiceType}`);

      const invoices = await fetchAllPurchaseInvoices(start, end, invoiceType, token);

      // Check for stop request after fetch
      if (stopRequested) {
        console.log('[Export HD] Stop requested, aborting...');
        return;
      }

      if (invoices.length > 0) {
        // Map to InvoiceParams
        const invoiceParams: InvoiceParams[] = invoices.map(mapToInvoiceParams);
        totalInvoices += invoiceParams.length;

        console.log(`[Export HD] Found ${invoiceParams.length} invoices for type ${invoiceType}. Total: ${totalInvoices}`);

        // Send invoice data to background for download
        chrome.runtime.sendMessage({
          action: 'DOWNLOAD_BATCH',
          data: invoiceParams,
          token: token,
        });
      }
    }

    if (!stopRequested) {
      console.log(`[Export HD] Completed. Total invoices: ${totalInvoices}`);
    }
  } catch (error) {
    console.error('[Export HD] Error in download process:', error);
    throw error;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener(
  (request: StartCrawlRequest | StopCrawlRequest, _sender: chrome.runtime.MessageSender, sendResponse: (response: MessageResponse) => void) => {
    if (request.action === 'START_CRAWL') {
      const { startDate, endDate } = request as StartCrawlRequest;

      if (!startDate || !endDate) {
        sendResponse({
          status: 'error',
          message: 'Missing start or end date'
        });
        return true;
      }

      startDownloadProcess(startDate, endDate)
        .then(() => {
          sendResponse({ status: stopRequested ? 'stopped' : 'started' });
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

    if (request.action === 'STOP_CRAWL') {
      stopRequested = true;
      console.log('[Export HD] Stop signal received');
      sendResponse({ status: 'stopped' });
      return true;
    }
  }
);

console.log('[Export HD] Content script loaded');
