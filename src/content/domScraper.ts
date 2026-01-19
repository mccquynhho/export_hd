import type { InvoiceParams } from '@/types';
import { sleep } from '@/utils/helpers';

// CSS Selectors constants
export const SELECTORS = {
  TABLE_ROW: '.ant-table-tbody tr[data-row-key]',
  NEXT_BUTTON: '.ant-pagination-next',
  LOADING_SPINNER: '.ant-spin-spinning',
  LOADING_NESTED: '.ant-spin-nested-loading > div > .ant-spin',
} as const;

/**
 * Parse data-row-key to extract invoice parameters
 * Format: UUID_NB-MST_MAUSO_KYHIEU_SOHOADON
 * Example: aeaf6b5f-e347..._0109498961_1_C25TDK_339
 */
export function parseRowKey(key: string): InvoiceParams | null {
  const parts = key.split('_');
  if (parts.length < 5) {
    console.warn(`Invalid row key format: ${key}`);
    return null;
  }

  return {
    nbmst: parts[1],      // MST người bán
    khmshdon: parts[2],    // Ký hiệu mẫu số
    khhdon: parts[3],      // Ký hiệu hóa đơn
    shdon: parts[4],       // Số hóa đơn
  };
}

/**
 * Scrape invoice data from current page
 */
export function scrapeCurrentPage(): InvoiceParams[] {
  const rows = document.querySelectorAll<HTMLElement>(SELECTORS.TABLE_ROW);
  const invoices: InvoiceParams[] = [];

  rows.forEach((row) => {
    const key = row.getAttribute('data-row-key');
    if (key) {
      const params = parseRowKey(key);
      if (params) {
        invoices.push(params);
      }
    }
  });

  return invoices;
}

/**
 * Check if there is a next page available
 */
export function hasNextPage(): boolean {
  const nextBtn = document.querySelector<HTMLElement>(SELECTORS.NEXT_BUTTON);
  
  if (!nextBtn) {
    return false;
  }

  const isDisabled = 
    nextBtn.getAttribute('aria-disabled') === 'true' ||
    nextBtn.classList.contains('ant-pagination-disabled');

  return !isDisabled;
}

/**
 * Click next page button and wait for loading to complete
 */
export async function goToNextPage(): Promise<void> {
  const nextBtn = document.querySelector<HTMLElement>(SELECTORS.NEXT_BUTTON);
  
  if (!nextBtn || !hasNextPage()) {
    throw new Error('Next page button not available');
  }

  // Click next button
  nextBtn.click();
  await sleep(1000); // Wait for click to register

  // Wait for loading spinner to disappear
  await waitForLoading();

  // Wait for DOM to stabilize
  await sleep(1000);
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoading(timeout: number = 10000): Promise<void> {
  const startTime = Date.now();

  return new Promise<void>((resolve, reject) => {
    const check = () => {
      const isLoading = 
        document.querySelector(SELECTORS.LOADING_SPINNER) ||
        document.querySelector(SELECTORS.LOADING_NESTED);

      if (!isLoading) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Loading timeout exceeded'));
      } else {
        setTimeout(check, 500);
      }
    };

    check();
  });
}
