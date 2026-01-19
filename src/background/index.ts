/// <reference types="chrome" />
import type { DownloadRequest, InvoiceParams, InvoiceDetailResponse } from '@/types';
import { fetchInvoiceDetail } from '@/utils/api';
import { sleep } from '@/utils/helpers';
import type { GetAuthTokenRequest, GetAuthTokenResponse } from '@/types';

const DOWNLOAD_DELAY = 300; // Delay between downloads to avoid rate limiting
const COOKIE_URL = 'https://hoadondientu.gdt.gov.vn';
const COOKIE_NAME = 'jwt';
const DEBUG = true;

const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[Background]', ...args);
  }
};

/**
 * Convert blob to base64 data URI
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download invoice file
 */
async function downloadInvoice(
  invoice: InvoiceParams,
  data: InvoiceDetailResponse
): Promise<void> {
  let blob: Blob;
  let filename: string;

  // Check if response contains XML or PDF
  if (data.xml) {
    // Decode base64 XML if needed, or use as-is
    const xmlContent = typeof data.xml === 'string' 
      ? (data.xml.startsWith('<?xml') ? data.xml : atob(data.xml))
      : JSON.stringify(data, null, 2);
    
    blob = new Blob([xmlContent], { type: 'application/xml' });
    filename = `HoaDon_${invoice.nbmst}_${invoice.shdon}.xml`;
  } else if (data.pdfUrl) {
    // If PDF URL is provided, download it
    const response = await fetch(data.pdfUrl);
    blob = await response.blob();
    filename = `HoaDon_${invoice.nbmst}_${invoice.shdon}.pdf`;
  } else {
    // Fallback: save as JSON
    blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    filename = `HoaDon_${invoice.nbmst}_${invoice.shdon}.json`;
  }

  const base64 = await blobToBase64(blob);

  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: base64,
        filename: `Invoices/${filename}`,
        conflictAction: 'overwrite',
      },
      (_downloadId: number) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Fetch and download a single invoice
 */
async function fetchAndDownloadInvoice(
  invoice: InvoiceParams,
  token: string
): Promise<void> {
  try {
    log('Fetching invoice detail', invoice);
    const data = await fetchInvoiceDetail(invoice, token);
    log('Invoice detail fetched', { shdon: invoice.shdon });
    await downloadInvoice(invoice, data);
    console.log(`[Background] Downloaded invoice: ${invoice.shdon}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Background] Error downloading invoice ${invoice.shdon}:`, errorMessage);
    throw error;
  }
}

/**
 * Process batch of invoices with rate limiting
 */
async function processBatch(invoices: InvoiceParams[], token: string): Promise<void> {
  log('Processing batch', { count: invoices.length });
  for (const invoice of invoices) {
    try {
      await fetchAndDownloadInvoice(invoice, token);
      // Rate limiting delay
      await sleep(DOWNLOAD_DELAY);
    } catch (error) {
      console.error(`[Background] Failed to download invoice ${invoice.shdon}:`, error);
      // Continue with next invoice even if one fails
    }
  }
}

/**
 * Get auth token from cookies (jwt) on hoadondientu.gdt.gov.vn
 */
async function getAuthTokenFromCookies(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: COOKIE_URL, name: COOKIE_NAME }, (cookie) => {
      if (chrome.runtime.lastError) {
        console.error('[Background] cookies.get error:', chrome.runtime.lastError);
        resolve(null);
        return;
      }
      if (cookie?.value) {
        const masked = cookie.value.slice(0, 10) + '...';
        log('Cookie jwt found', { masked });
        resolve(cookie.value);
      } else {
        log('Cookie jwt not found');
        resolve(null);
      }
    });
  });
}

// Listen for download requests from content script
chrome.runtime.onMessage.addListener(
  (
    request: DownloadRequest | GetAuthTokenRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success?: boolean; error?: string } | GetAuthTokenResponse) => void
  ) => {
    if (request.action === 'DOWNLOAD_BATCH') {
      log('Received DOWNLOAD_BATCH', { count: request.data.length });
      processBatch(request.data, request.token)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((error) => {
          console.error('[Background] Batch processing error:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        });
      
      // Return true to indicate we will send a response asynchronously
      return true;
    }

    if (request.action === 'GET_AUTH_TOKEN') {
      getAuthTokenFromCookies()
        .then((token) => sendResponse({ token }))
        .catch((error) => {
          console.error('[Background] Failed to get auth token:', error);
          sendResponse({ token: null });
        });
      return true;
    }
  }
);

console.log('[Background] Service worker loaded');
