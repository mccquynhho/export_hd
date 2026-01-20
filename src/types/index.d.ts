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
}

// Response message from content script to background
export interface MessageResponse {
  status: 'started' | 'error';
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
