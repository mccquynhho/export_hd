import type { InvoiceParams, InvoiceDetailResponse } from '@/types';
import { retry } from './helpers';

const API_BASE_URL = 'https://hoadondientu.gdt.gov.vn:30000/query/invoices/detail';

/**
 * Fetch invoice detail from API
 */
export async function fetchInvoiceDetail(
  params: InvoiceParams,
  token: string
): Promise<InvoiceDetailResponse> {
  const url = new URL(API_BASE_URL);
  url.searchParams.set('nbmst', params.nbmst);
  url.searchParams.set('khhdon', params.khhdon);
  url.searchParams.set('shdon', params.shdon);
  url.searchParams.set('khmshdon', params.khmshdon);

  const fetchFn = async () => {
    // Debug log (mask token)
    const maskedToken = token ? `${token.slice(0, 10)}...` : 'null';
    console.log('[Background] fetchInvoiceDetail', {
      url: url.toString(),
      nbmst: params.nbmst,
      shdon: params.shdon,
      khhdon: params.khhdon,
      khmshdon: params.khmshdon,
      token: maskedToken,
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        // Mirror browser request headers as much as possible (some headers like Referer are controlled by the browser)
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Use ASCII-only to avoid non-ISO errors in RequestInit
        'action': 'In hoa don (hoa don mua vao)',
        'end-point': '/tra-cuu/tra-cuu-hoa-don',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as InvoiceDetailResponse;
  };

  return retry(fetchFn, 3, 500);
}

/**
 * Get auth token from page's localStorage via injected script
 * This function communicates with the injected script to get the token
 */
export function getAuthToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `token-request-${Date.now()}-${Math.random()}`;
    
    // Set up listener for response
    const messageHandler = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === 'AUTH_TOKEN_RESPONSE' &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener('message', messageHandler);
        resolve(event.data.token || null);
      }
    };

    window.addEventListener('message', messageHandler);

    // Request token from injected script
    window.postMessage(
      {
        type: 'GET_AUTH_TOKEN',
        requestId: requestId,
      },
      '*'
    );

    // Timeout after 2 seconds
    setTimeout(() => {
      window.removeEventListener('message', messageHandler);
      console.warn('[Export HD] Timeout waiting for token response');
      resolve(null);
    }, 2000);
  });
}
