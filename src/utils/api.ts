import type { InvoiceParams, InvoiceDetailResponse, InvoiceQuery, InvoiceResponse } from '@/types';
import { retry, sleep } from './helpers';

const API_BASE_URL = 'https://hoadondientu.gdt.gov.vn:30000';
const API_URL_INVOICE_DETAIL = API_BASE_URL + '/query/invoices/detail';
const API_URL_PURCHASE_INVOICES = API_BASE_URL + '/query/invoices/purchase';
const REQUEST_DELAY = 2000;

/**
 * Fetch invoice detail from API
 */
export async function fetchInvoiceDetail(
  params: InvoiceParams,
  token: string
): Promise<InvoiceDetailResponse> {
  const url = new URL(API_URL_INVOICE_DETAIL);
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


function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Format theo request bạn sniff: dd/MM/yyyyTHH:mm:ss
 */
export function formatVNDateTime(d: Date) {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const HH = pad2(d.getHours());
  const MM = pad2(d.getMinutes());
  const SS = pad2(d.getSeconds());
  return `${dd}/${mm}/${yyyy}T${HH}:${MM}:${SS}`;
}

export function buildPurchaseInvoicesUrl(q: InvoiceQuery, state?: string) {
  const size = q.size ?? 50;

  // sort bạn đang dùng
  const sort = "tdlap:desc";

  const search =
    `tdlap=ge=${formatVNDateTime(q.from)};` +
    `tdlap=le=${formatVNDateTime(q.to)};` +
    `ttxly==${q.ttxly}`;

  const url = new URL(API_URL_PURCHASE_INVOICES);
  url.searchParams.set("sort", sort);
  url.searchParams.set("size", String(size));
  url.searchParams.set("search", search);

  // Add state parameter for pagination (if provided)
  if (state) {
    url.searchParams.set("state", state);
  }

  return url.toString();
}

export async function fetchPurchaseInvoices(
  q: InvoiceQuery,
  accessToken: string,
  state?: string
): Promise<InvoiceResponse> {
  const url = buildPurchaseInvoicesUrl(q, state);

  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "vi",
      action: "tim-kiem",
      authorization: `Bearer ${accessToken}`,
      "end-point": "/tra-cuu/tra-cuu-hoa-don",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return (await res.json()) as InvoiceResponse;
}

/**
 * Split date range into 30-day chunks (API limit)
 */
function splitDateRange(startDate: Date, endDate: Date): Array<{ from: Date; to: Date }> {
  const chunks: Array<{ from: Date; to: Date }> = [];
  const MAX_DAYS = 30;

  let currentStart = new Date(startDate);

  while (currentStart < endDate) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + MAX_DAYS - 1);

    // Set end time to 23:59:59
    currentEnd.setHours(23, 59, 59, 999);

    // Don't go past the actual end date
    const actualEnd = currentEnd > endDate ? endDate : currentEnd;

    chunks.push({
      from: new Date(currentStart),
      to: actualEnd
    });

    // Move to next chunk
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    currentStart.setHours(0, 0, 0, 0);
  }

  return chunks;
}

/**
 * Fetch all invoices for a date range and invoice type
 * Handles pagination via state parameter and 30-day chunks
 */
export async function fetchAllPurchaseInvoices(
  startDate: Date,
  endDate: Date,
  ttxly: number,
  accessToken: string
): Promise<any[]> {
  const allInvoices: any[] = [];

  // Split into 30-day chunks
  const chunks = splitDateRange(startDate, endDate);

  console.log(`[Export HD] Fetching invoices for type ${ttxly}, ${chunks.length} time chunks`);

  for (const chunk of chunks) {
    let state: string | undefined = undefined;
    let hasMore = true;

    const query: InvoiceQuery = {
      from: chunk.from,
      to: chunk.to,
      ttxly: ttxly,
      size: 50
    };

    while (hasMore) {
      try {
        const response = await fetchPurchaseInvoices(query, accessToken, state);
        await sleep(REQUEST_DELAY);

        if (response.datas && response.datas.length > 0) {
          allInvoices.push(...response.datas);
          console.log(`[Export HD] Fetched ${response.datas.length} invoices, total: ${allInvoices.length}`);
        }

        // Check if there are more pages
        if (response.state) {
          state = response.state;
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`[Export HD] Error fetching invoices:`, error);
        throw error;
      }
    }
  }

  return allInvoices;
}

