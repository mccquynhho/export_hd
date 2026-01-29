/// <reference types="chrome" />
import type { StartCrawlRequest, StopCrawlRequest, MessageResponse, InvoiceParams, ProgressUpdate } from '@/types';
import { getMessage } from '@/utils/helpers';
import { fetchAllPurchaseInvoices } from '@/utils/api';
import type { GetAuthTokenRequest, GetAuthTokenResponse } from '@/types';

// Invoice types to fetch (mua vào)
const INVOICE_TYPES = [5, 6, 8];
const INVOICE_TYPE_NAMES: Record<number, string> = {
  5: 'Đã cấp mã hoá đơn',
  6: 'Cục thuế đã nhận không mã',
  8: 'Cục thuế đã nhận hoá đơn có mã khởi tạo từ máy tính tiền'
};

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
 * Update progress in storage for popup to read
 */
function updateProgress(progress: ProgressUpdate): void {
  chrome.storage.local.set({ progress });
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

  // Initialize progress
  updateProgress({ phase: 'idle', message: 'Đang khởi tạo...' });

  const token = await getTokenFromBackground();

  if (!token) {
    updateProgress({ phase: 'idle', message: 'Lỗi: Không lấy được token' });
    alert(getMessage('noTokenError'));
    return;
  }

  // Parse dates
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  console.log(`[Export HD] Fetching invoices from ${startDate} to ${endDate}`);

  let totalFetched = 0;
  const allInvoiceParams: InvoiceParams[] = [];

  try {
    // Phase 1: Fetch all invoice types
    for (const invoiceType of INVOICE_TYPES) {
      // Check for stop request
      if (stopRequested) {
        console.log('[Export HD] Stop requested, aborting...');
        updateProgress({ phase: 'stopped', message: 'Đã dừng bởi người dùng' });
        return;
      }

      updateProgress({
        phase: 'fetching',
        invoiceType,
        invoiceTypeName: INVOICE_TYPE_NAMES[invoiceType],
        totalFetched,
        message: `Đang lấy danh sách ${INVOICE_TYPE_NAMES[invoiceType]}...`
      });

      console.log(`[Export HD] Fetching invoice type: ${invoiceType}`);

      const invoices = await fetchAllPurchaseInvoices(start, end, invoiceType, token);

      // Check for stop request after fetch
      if (stopRequested) {
        console.log('[Export HD] Stop requested, aborting...');
        updateProgress({ phase: 'stopped', message: 'Đã dừng bởi người dùng' });
        return;
      }

      if (invoices.length > 0) {
        // Map to InvoiceParams
        const invoiceParams: InvoiceParams[] = invoices.map(mapToInvoiceParams);
        allInvoiceParams.push(...invoiceParams);
        totalFetched += invoiceParams.length;

        updateProgress({
          phase: 'fetching',
          invoiceType,
          invoiceTypeName: INVOICE_TYPE_NAMES[invoiceType],
          fetchedCount: invoiceParams.length,
          totalFetched,
          message: `Đã lấy ${invoiceParams.length} ${INVOICE_TYPE_NAMES[invoiceType]}`
        });

        console.log(`[Export HD] Found ${invoiceParams.length} invoices for type ${invoiceType}. Total: ${totalFetched}`);
      }
    }

    // Phase 2: Send to background for download
    if (allInvoiceParams.length > 0 && !stopRequested) {
      updateProgress({
        phase: 'downloading',
        downloadCurrent: 0,
        downloadTotal: allInvoiceParams.length,
        message: `Bắt đầu tải ${allInvoiceParams.length} hoá đơn...`
      });

      // Send invoice data to background for download
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_BATCH',
        data: allInvoiceParams,
        token: token,
      });
    }

    if (!stopRequested) {
      updateProgress({
        phase: 'completed',
        totalFetched,
        downloadTotal: allInvoiceParams.length,
        message: `Hoàn thành! Đã gửi ${allInvoiceParams.length} hoá đơn để tải`
      });
      console.log(`[Export HD] Completed. Total invoices: ${totalFetched}`);
    }
  } catch (error) {
    console.error('[Export HD] Error in download process:', error);
    updateProgress({
      phase: 'idle',
      message: `Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
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
      updateProgress({ phase: 'stopped', message: 'Đang dừng...' });
      console.log('[Export HD] Stop signal received');
      sendResponse({ status: 'stopped' });
      return true;
    }
  }
);

console.log('[Export HD] Content script loaded');

