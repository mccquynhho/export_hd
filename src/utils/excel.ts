import * as xlsx from 'xlsx';

function formatDateString(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch (e) {
    return dateStr;
  }
}

function getVerificationResult(type: number): string {
  if (type === 5) return 'Đã cấp mã hóa đơn';
  if (type === 6) return 'Tổng cục thuế đã nhận không mã';
  if (type === 8) return 'Cục thuế đã nhận hóa đơn có mã khởi tạo từ máy tính tiền';
  return '';
}

function getInvoiceStatusText(tthai: number): string {
  // Map tthai to text. Usually 1 is "Hóa đơn mới"
  return tthai === 1 ? 'Hóa đơn mới' : 'Hóa đơn mới';
}

const TYPE_SHEET_NAMES: Record<number, string> = {
  5: 'Đã cấp mã hóa đơn',
  6: 'Cục thuế đã nhận không mã',
  8: 'Khởi tạo từ máy tính tiền'
};

const EXCEL_HEADERS = [
  'STT',
  'Ký hiệu mẫu số',
  'Ký hiệu hóa đơn',
  'Số hóa đơn',
  'Ngày lập',
  'MST người bán/MST người xuất hàng',
  'Tên người bán/Tên người xuất hàng',
  'MST người mua/MST người nhận hàng',
  'Tên người mua/Tên người nhận hàng',
  'Địa chỉ người mua',
  'Tổng tiền chưa thuế',
  'Tổng tiền thuế',
  'Tổng tiền chiết khấu thương mại',
  'Tổng tiền phí',
  'Tổng tiền thanh toán',
  'Đơn vị tiền tệ',
  'Tỷ giá',
  'Trạng thái hóa đơn',
  'Kết quả kiểm tra hóa đơn'
];

/**
 * Generate Excel file as Base64 string
 */
export function generateExcelBase64(
  invoicesByType: Record<number, any[]>,
  startDate: string,
  endDate: string
): string {
  const wb = xlsx.utils.book_new();
  
  const startD = formatDateString(startDate);
  const endD = formatDateString(endDate);
  const periodText = `Từ ngày ${startD} đến ngày ${endD}`;

  for (const type of [5, 6, 8]) {
    const invoices = invoicesByType[type] || [];
    
    // Create rows data
    const rows: any[][] = [];
    
    // Row 1: Title
    rows.push(['DANH SÁCH HÓA ĐƠN']);
    
    // Row 2: Period
    rows.push([periodText]);
    
    // Row 3: Empty
    rows.push([]);
    
    // Row 4: Headers
    rows.push(EXCEL_HEADERS);
    
    // Data rows
    invoices.forEach((inv, index) => {
      rows.push([
        index + 1, // STT
        inv.khmshdon || '',
        inv.khhdon || '',
        inv.shdon || '',
        formatDateString(inv.tdlap),
        inv.nbmst || '',
        inv.nbten || '',
        inv.nmmst || '',
        inv.nmten || '',
        inv.nmdchi || '',
        inv.tgtcthue || 0,
        inv.tgtthue || 0,
        inv.ttcktmai || '',
        inv.tgtphi || '',
        inv.tgtttbso || 0,
        inv.dvtte || 'VND',
        inv.tgia || '1.0',
        getInvoiceStatusText(inv.tthai),
        getVerificationResult(type)
      ]);
    });
    
    const ws = xlsx.utils.aoa_to_sheet(rows);
    
    // Add sheet to workbook
    const sheetName = TYPE_SHEET_NAMES[type] || `Loại ${type}`;
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  }

  // Write to base64
  const base64Str = xlsx.write(wb, { type: 'base64', bookType: 'xlsx' });
  return base64Str;
}
