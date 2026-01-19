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

// API Response types
export interface InvoiceDetailResponse {
  xml?: string;
  pdfUrl?: string;
  data?: any;
}
