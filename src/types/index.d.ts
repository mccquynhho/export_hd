// Invoice parameters extracted from table row
export interface InvoiceParams {
  nbmst: string;   // MST người bán
  khhdon: string;  // Ký hiệu hóa đơn
  shdon: string;   // Số hóa đơn
  khmshdon: string; // Ký hiệu mẫu số
}

// Message payload for communication between content script and background
export interface DownloadRequest {
  action: 'DOWNLOAD_BATCH';
  data: InvoiceParams[];
  token: string;
}

// Request to get auth token from background
export interface GetAuthTokenRequest {
  action: 'GET_AUTH_TOKEN';
}

export interface GetAuthTokenResponse {
  token: string | null;
}

// Request to print a single invoice
export interface PrintInvoiceRequest {
  action: 'PRINT_INVOICE';
  invoice: InvoiceParams;
}

export interface PrintInvoiceResponse {
  status: 'ok' | 'error';
  key?: string;
  message?: string;
}

export interface ClosePrintTabRequest {
  action: 'CLOSE_PRINT_TAB';
}

// Request to start the crawl process
export interface StartCrawlRequest {
  action: 'START_CRAWL';
  startDate: string;  // Format: YYYY-MM-DD
  endDate: string;    // Format: YYYY-MM-DD
}

// Request to stop the crawl process
export interface StopCrawlRequest {
  action: 'STOP_CRAWL';
}

// Response message from content script to background
export interface MessageResponse {
  status: 'started' | 'stopped' | 'error';
  message?: string;
}

// Progress state for UI
export interface ProgressState {
  total: number;
  downloaded: number;
  errors: number;
  isProcessing: boolean;
  errorMessages: string[];
}

// Real-time progress update for popup display
export interface ProgressUpdate {
  phase: 'fetching' | 'downloading' | 'idle' | 'completed' | 'stopped';
  invoiceType?: number;        // 5, 6, or 8
  invoiceTypeName?: string;    // "Loại 5", "Loại 6", "Loại 8"
  fetchedCount?: number;       // Number of invoices fetched for current type
  totalFetched?: number;       // Total invoices fetched across all types
  downloadCurrent?: number;    // Current download index (1-based)
  downloadTotal?: number;      // Total invoices to download
  currentInvoice?: string;     // Current invoice number being downloaded
  message?: string;            // Optional status message
}

export interface InvoiceLine {
  id?: string;
  idhdon?: string;
  ten?: string;
  dvtinh?: string;
  sluong?: number;
  dgia?: number;
  ltsuat?: string;
  tsuat?: number | string;
  thtien?: number;
  stt?: number;
  tthue?: number | null;
  stckhau?: number;
}

// API Response types (fields observed from request 2 sample)
export interface InvoiceDetailResponse {
  nbmst?: string;
  khmshdon?: string | number;
  khhdon?: string;
  shdon?: number | string;
  mhdon?: string;
  tdlap?: string;
  nbten?: string;
  nbdchi?: string;
  nmmst?: string;
  nmten?: string;
  nmdchi?: string;
  thtttoan?: string;
  tgtcthue?: number;
  tgtthue?: number;
  tgtttbso?: number;
  tgtttbchu?: string;
  hdhhdvu?: InvoiceLine[];
  xml?: string;
  pdfUrl?: string;
  qrcode?: string;
  nbsdthoai?: string;
  nbdctdtu?: string;
  nbstkhoan?: string;
  nbtnhang?: string;
  thttltsuat?: Array<{
    tsuat?: string;
    thtien?: number;
    tthue?: number;
  }>;
  data?: any;
}

// src/types.ts
export type ExtraField = {
  ttruong: string;
  kdlieu: string | null;
  dlieu: any;
};

export type Invoice = {
  id: string;
  nmmst: string;
  nmten: string;

  nbmst: string;
  nbten: string;

  khmshdon: number;
  khhdon: string;
  shdon: number;

  tdlap: string; // ISO string e.g. "2026-01-14T17:00:00Z"
  ttxly: number;

  tgtttbso: number; // total amount
  tgtcthue?: number;
  tgtthue?: number;

  thdon?: string;   // tên hoá đơn
  tlhdon?: string;  // loại hoá đơn
  thtttoan?: string;

  mhdon?: string;   // mã hoá đơn
  mtdtchieu?: string;

  cttkhac?: ExtraField[];
  nbttkhac?: ExtraField[];
  nmttkhac?: ExtraField[];
  ttttkhac?: ExtraField[];
  ttkhac?: ExtraField[];

  // nhiều field khác bạn có thể thêm dần khi cần
  [k: string]: any;
};

export type InvoiceQuery = {
  from: Date;        // inclusive
  to: Date;          // inclusive
  ttxly: number;     // status, ví dụ 5
  size?: number;     // ví dụ 15
  page?: number;     // nếu API có page
};

// src/types.ts
export type InvoiceResponse = {
  datas: any[];
  total?: number;
  state?: string | null;
  time?: number;
  [k: string]: any;
};


