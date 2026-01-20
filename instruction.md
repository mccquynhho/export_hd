Bạn là một chuyên gia lập trình extension trên chrome bằng type script (vite) với 10 năm kinh nghiệm
Nhiệm vụ của bạn là giúp tôi lập trình extension dựa trên yêu cầu của tôi.
Khi lập trình, luôn đảm bảo nguyên tắc code dễ đọc, dễ debug, xem những lưu ý sau đây để tham khảo thêm:

1. Manifest (tối thiểu quyền, i18n)
Không hardcode chuỗi → dùng /_locales/vi/messages.json
# Project Instruction: HDDT Internal API Downloader

## 1. Project Overview
Xây dựng Chrome Extension (Manifest V3, Vite, TypeScript) để tải hàng loạt hóa đơn từ `hoadondientu.gdt.gov.vn`.
**Core Mechanism:** Thay vì cào HTML chi tiết, extension sẽ lấy danh sách ID từ bảng, sau đó **gọi trực tiếp API nội bộ** `/query/invoices/detail` để lấy dữ liệu JSON gốc.

## 2. Technical Specs

### 2.1. API Details (Reverse Engineered)
Dữ liệu hóa đơn được lấy qua request sau:
- **Base URL:** `https://hoadondientu.gdt.gov.vn:30000`
- **Path:** `/query/invoices/detail`
- **Method:** `GET`
- **Headers Bắt Buộc:**
  - `Authorization`: `Bearer <TOKEN>` (Lấy từ Cookie `jwt`).
  - `Content-Type`: `application/json`
- **Query Parameters:**
  - `nbmst`: Mã số thuế người bán.
  - `khhdon`: Ký hiệu hóa đơn (VD: C25TTN).
  - `shdon`: Số hóa đơn (VD: 124).
  - `khmshdon`: Mẫu số (VD: 1).

### 2.2. Data Mapping Strategy
Trên giao diện danh sách hóa đơn, mỗi dòng (`tr`) có thuộc tính `data-row-key` định dạng:
`UUID_MSTNguoiBan_MauSo_KyHieu_SoHoaDon`
*Ví dụ:* `aeaf6..._0109989663_1_C25TTN_124`

**Logic trích xuất:**
1. Split chuỗi `data-row-key` bằng dấu `_`.
2. Map vào params API:
   - `nbmst` = parts[1]
   - `khmshdon` = parts[2]
   - `khhdon` = parts[3]
   - `shdon` = parts[4]

## 3. Implementation Plan

### Phase 1: Authentication Handling (Content Script)
- Extension cần tự động lấy Token hiện hành của user.
- **Cách 1 (Ưu tiên):** Kiểm tra `localStorage.getItem('token')` hoặc `sessionStorage`.
- **Cách 2 (Fallback):** Đọc cookie tên `jwt` từ `document.cookie`.
- Nếu không có token, hiển thị cảnh báo yêu cầu user đăng nhập lại.

### Phase 2: Crawling & Queueing (Content Script)
1. User click "Tải tất cả" trên Popup.
2. Script quét toàn bộ `tr[data-row-key]` trên trang hiện tại.
3. Parse key thành danh sách object `InvoiceParams`.
4. Gửi danh sách này (`message: START_DOWNLOAD`) về **Background Worker**.
5. (Tùy chọn) Tự động bấm nút Next Page (`.ant-pagination-next`) và lặp lại quy trình.

### Phase 3: Downloading (Background Service Worker)
Background worker chịu trách nhiệm gọi API để tránh bị đóng khi chuyển tab/trang.

**Logic Loop:**
For each `invoice` in `queue`:
1. **Sleep:** 300ms - 500ms (Tránh rate limit/block IP).
2. **Fetch:** Gọi `GET /query/invoices/detail` với Params & Token.
3. **Response Handling:**
   - Nếu `200 OK`: Lấy JSON body.
   - Nếu `401 Unauthorized`: Dừng và báo lỗi token hết hạn.
4. **Save File:**
   - Dùng `chrome.downloads.download`.
   - **Filename:** `MST_KyHieu_SoHoaDon.json` (Ví dụ: `0109989663_C25TTN_124.json`).
   - Content: Chuyển JSON object thành string.

### Phase 4: Print View + Export PDF (Background + Print Page)
- **Mục tiêu**: Khi tải batch, ngoài JSON/XML/PDF gốc (nếu có), cần tạo thêm **PDF bản in** giống giao diện mẫu.
- **Nguồn dữ liệu**: Render từ JSON trả về của `/query/invoices/detail` (không cào DOM chi tiết).
- **Print layout**:
  - UI phải khớp mẫu “Hoá đơn - Mẫu yêu cầu” (border kép, nền watermark, header có QR, khối “Mẫu số/Ký hiệu/Số”, phần ngày dạng ô, MCCQT, bảng hàng hoá đầy đủ cột, cụm tổng hợp thuế suất + tổng tiền, chữ ký/Signature box, footer).
- **Cơ chế xuất PDF tự động**:
  - Background mở tab ẩn tới `src/print/index.html#<key>&tabId=<id>` (web_accessible).
  - Print page render xong (đợi font/ảnh) sẽ gửi message `CHECK_READY` về background.
  - Background dùng `chrome.debugger` gọi `Page.printToPDF({ printBackground: true, paperWidth: 8.27, paperHeight: 11.69 })`.
  - Nhận base64 PDF và tải bằng `chrome.downloads.download()`.
- **Permissions cần thiết**: `downloads`, `storage`, `cookies`, thêm `debugger` (và các quyền tối thiểu khác khi cần).

## 4. Coding Instructions for Cursor

### 4.1. File: `src/utils/api.ts`
Viết hàm `fetchInvoiceDetail(params: InvoiceParams, token: string)`:
- Xây dựng URL với `URLSearchParams`.
- Config `fetch` với headers chuẩn.
- Handle error: Nếu gặp lỗi mạng, retry tối đa 3 lần.

### 4.2. File: `src/content/domHelper.ts`
Viết hàm `extractInvoicesFromDOM()`:
- Query selector: `.ant-table-tbody tr[data-row-key]`.
- Regex/Split logic để tách `data-row-key` thành object sạch.

### 4.3. Manifest Configuration
- `host_permissions`: Thêm `https://hoadondientu.gdt.gov.vn:30000/*` (Lưu ý port 30000).
- `permissions`: `downloads`, `storage`, `cookies`.
  - Nếu xuất PDF bằng CDP: thêm `debugger`.

### 4.4. Error & Edge Cases
- **Token hết hạn:** Nếu API trả về 401/403, extension phải pause và alert user trên màn hình.
- **Rate Limit:** Nếu API trả về 429, tăng thời gian sleep lên 2000ms.
- **Null Data:** Một số dòng có thể là dòng tổng hợp/header ảo, cần check kỹ format của `data-row-key` trước khi push vào queue.

## 5. UI Requirements (Popup)
- Nút: "Quét trang này" (Scan Current Page).
- Nút: "Tự động tải tất cả các trang" (Auto Download All Pages).
- Progress Bar: Hiển thị trạng thái "Đang tải 5/50...".
- Log Area: Hiển thị lỗi nếu có file tải thất bại.