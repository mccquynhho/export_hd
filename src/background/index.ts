/// <reference types="chrome" />
import type {
  DownloadRequest,
  InvoiceParams,
  InvoiceDetailResponse,
  PrintInvoiceRequest,
  PrintInvoiceResponse,
} from '@/types';
import { fetchInvoiceDetail } from '@/utils/api';
import { sleep } from '@/utils/helpers';
import type { GetAuthTokenRequest, GetAuthTokenResponse } from '@/types';
import type { ClosePrintTabRequest } from '@/types';

const DOWNLOAD_DELAY = 300; // Base delay between downloads to avoid rate limiting
const DOWNLOAD_DELAY_ON_429 = 2000; // @instruction.md:91
const COOKIE_URL = 'https://hoadondientu.gdt.gov.vn';
const COOKIE_NAME = 'jwt';
const DEBUG = true;

// Map to track tabs waiting for ready signal
const pendingTabs = new Map<number, { resolve: () => void; reject: (error: Error) => void }>();

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
 * Wait for tab to fully load and render (including fonts, images, etc.)
 */
async function waitForTabReady(tabId: number, timeout = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    // Register this tab as pending
    pendingTabs.set(tabId, { resolve, reject });
    
    const checkReady = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          pendingTabs.delete(tabId);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (tab.status === 'complete') {
          // Print page will send CHECK_READY message when ready
          // Wait for it or timeout
          if (Date.now() - startTime > timeout) {
            const pending = pendingTabs.get(tabId);
            if (pending) {
              pendingTabs.delete(tabId);
              log('Tab ready timeout, proceeding anyway', { tabId });
              resolve();
            }
          } else {
            setTimeout(checkReady, 500);
          }
        } else if (Date.now() - startTime > timeout) {
          pendingTabs.delete(tabId);
          reject(new Error('Tab load timeout'));
        } else {
          setTimeout(checkReady, 200);
        }
      });
    };
    
    checkReady();
  });
}

/**
 * Generate PDF from invoice using Chrome Debugger API
 */
async function generatePDFFromInvoice(
  invoice: InvoiceParams,
  data: InvoiceDetailResponse
): Promise<void> {
  const key = buildPrintKey(invoice);
  await savePrintData(key, data, invoice);
  
  // Create hidden tab first to get tabId
  const tab = await chrome.tabs.create({ 
    url: chrome.runtime.getURL('src/print/index.html'),
    active: false 
  });
  const tabId = tab.id!;
  
  // Update URL with hash containing key and tabId
  const url = chrome.runtime.getURL(`src/print/index.html#${encodeURIComponent(key)}&tabId=${tabId}`);
  await chrome.tabs.update(tabId, { url });
  
  try {
    // Wait for tab to load and render
    log('Waiting for tab to render', { tabId, shdon: invoice.shdon });
    await waitForTabReady(tabId, 15000);
    
    // Attach debugger
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.attach({ tabId }, '1.0', () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    log('Debugger attached, calling Page.printToPDF', { tabId });
    
    // Enable Page domain
    await new Promise<void>((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, 'Page.enable', {}, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Call Page.printToPDF
    const pdfData = await new Promise<string>((resolve, reject) => {
      chrome.debugger.sendCommand(
        { tabId },
        'Page.printToPDF',
        {
          printBackground: true,
          paperWidth: 8.27,  // A4 width in inches
          paperHeight: 11.69, // A4 height in inches
          marginTop: 0,
          marginBottom: 0,
          marginLeft: 0,
          marginRight: 0,
        },
        (result: any) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (result?.data) {
            resolve(result.data);
          } else {
            reject(new Error('No PDF data returned'));
          }
        }
      );
    });
    
    log('PDF generated, downloading', { shdon: invoice.shdon });
    
    // Download PDF
    const base64Url = `data:application/pdf;base64,${pdfData}`;
    await new Promise<void>((resolve, reject) => {
      chrome.downloads.download(
        {
          url: base64Url,
          filename: `Invoices/HoaDon_${invoice.nbmst}_${invoice.shdon}_Print.pdf`,
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
    
    log('PDF downloaded successfully', { shdon: invoice.shdon });
    
  } catch (error) {
    console.error('[Background] Error generating PDF:', error);
    throw error;
  } finally {
    // Detach debugger
    try {
      await new Promise<void>((resolve) => {
        chrome.debugger.detach({ tabId }, () => {
          // Ignore errors on detach
          resolve();
        });
      });
    } catch (e) {
      log('Error detaching debugger:', e);
    }
    
    // Close tab
    try {
      await chrome.tabs.remove(tabId);
    } catch (e) {
      log('Error closing tab:', e);
    }
  }
}

async function fetchAndDownloadInvoiceWithPrint(
  invoice: InvoiceParams,
  token: string
): Promise<void> {
  log('Fetching invoice detail', invoice);
  const data = await fetchInvoiceDetail(invoice, token);
  log('Invoice detail fetched', { shdon: invoice.shdon });

  // 1) Always download JSON/XML/PDF (current behavior)
  await downloadInvoice(invoice, data);
  console.log(`[Background] Downloaded invoice data: ${invoice.shdon}`);

  // 2) Generate PDF from print view using Chrome Debugger API
  await generatePDFFromInvoice(invoice, data);
  console.log(`[Background] Generated PDF for invoice: ${invoice.shdon}`);
}

/**
 * Process batch of invoices with rate limiting
 */
async function processBatch(invoices: InvoiceParams[], token: string): Promise<void> {
  log('Processing batch', { count: invoices.length });
  for (const invoice of invoices) {
    try {
      await fetchAndDownloadInvoiceWithPrint(invoice, token);
      await sleep(DOWNLOAD_DELAY);
    } catch (error) {
      console.error(`[Background] Failed to download invoice ${invoice.shdon}:`, error);
      const msg = error instanceof Error ? error.message : String(error);
      // @instruction.md:91 - if API rate limits, back off more
      if (msg.includes('HTTP 429')) {
        log('Hit 429, backing off', { ms: DOWNLOAD_DELAY_ON_429 });
        await sleep(DOWNLOAD_DELAY_ON_429);
      }
      // Continue with next invoice even if one fails
    }
  }
}

function buildPrintKey(invoice: InvoiceParams): string {
  return `print_invoice_${invoice.nbmst}_${invoice.khmshdon}_${invoice.khhdon}_${invoice.shdon}`;
}

async function savePrintData(key: string, data: InvoiceDetailResponse, invoice: InvoiceParams): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.session.set({ [key]: { invoice, data } }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

async function handlePrintInvoice(
  request: PrintInvoiceRequest,
  sendResponse: (response: PrintInvoiceResponse) => void
) {
  try {
    const token = await getAuthTokenFromCookies();
    if (!token) {
      sendResponse({ status: 'error', message: 'Không tìm thấy token jwt trong cookie' });
      return;
    }
    const key = buildPrintKey(request.invoice);
    log('PRINT_INVOICE start', { key, invoice: request.invoice });
    const detail = await fetchInvoiceDetail(request.invoice, token);
    await savePrintData(key, detail, request.invoice);
    const url = chrome.runtime.getURL(`src/print/index.html#${encodeURIComponent(key)}`);
    chrome.tabs.create({ url });
    sendResponse({ status: 'ok', key });
  } catch (error) {
    console.error('[Background] PRINT_INVOICE error:', error);
    sendResponse({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
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

// Listen for ready signal from print pages
chrome.runtime.onMessage.addListener(
  (
    request: { action: string; tabId?: number },
    sender: chrome.runtime.MessageSender,
    _sendResponse: () => void
  ) => {
    if (request.action === 'CHECK_READY') {
      // Get tabId from request or sender
      const tabId = request.tabId || sender.tab?.id;
      if (tabId) {
        const pending = pendingTabs.get(tabId);
        if (pending) {
          pendingTabs.delete(tabId);
          log('Print page signaled ready', { tabId });
          pending.resolve();
        }
      }
      return false; // No async response needed
    }
  }
);

// Listen for download requests from content script
chrome.runtime.onMessage.addListener(
  (
    request: DownloadRequest | GetAuthTokenRequest | PrintInvoiceRequest | ClosePrintTabRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: { success?: boolean; error?: string } | GetAuthTokenResponse | PrintInvoiceResponse) => void
  ) => {
    if (request.action === 'DOWNLOAD_BATCH') {
      console.log('[Background] Received DOWNLOAD_BATCH', request.data);
      processBatch(request.data, request.token)
        .then(() => {
          sendResponse({ success: true });
          console.log('[Background] Batch processing completed');
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

    if (request.action === 'PRINT_INVOICE') {
      handlePrintInvoice(request, sendResponse);
      return true;
    }

    if (request.action === 'CLOSE_PRINT_TAB') {
      // Close the sender tab (print window) to avoid tab explosion during batch
      const tabId = _sender.tab?.id;
      if (tabId) {
        chrome.tabs.remove(tabId);
      }
      return false;
    }
  }
);

console.log('[Background] Service worker loaded');
