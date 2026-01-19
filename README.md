Xây dựng một Google Chrome Extension (Manifest V3) sử dụng Vite + TypeScript. Mục tiêu: Tự động tải xuống toàn bộ hóa đơn điện tử từ trang quản lý hóa đơn của Tổng cục Thuế (https://hoadondientu.gdt.gov.vn). Đối tượng: Kế toán viên cần tải hàng loạt hóa đơn (XML/PDF) về máy tính.

2. Tech Stack & Architecture
Core: React, TypeScript, Vite.

Build Tool: CRXJS Vite Plugin (Recommended for HMR).

Manifest: Version 3.

State Management: React Context hoặc Zustand (cho Popup UI).

Styling: TailwindCSS (cho UI Popup và Content Script Injection).

Zip Library: jszip (để nén toàn bộ hóa đơn thành 1 file zip nếu cần).

3. Phân tích Kỹ thuật (Technical Analysis)
3.1. DOM Structure & Data Scraping
Dữ liệu nằm trong bảng Ant Design (.ant-table-tbody). Mỗi dòng (tr) chứa một thuộc tính quan trọng là data-row-key.

Selector: tr[data-row-key]

Format của key: UUID_MSTNguoiBan_KyHieuMau_KyHieu_SoHoaDon

Ví dụ: aeaf6b5f..._0109498961_1_C25TDK_339

Cần parse chuỗi này để lấy tham số gọi API:

nbmst: (Index 1) Mã số thuế người bán.

khmshdon: (Index 2) Ký hiệu mẫu số hóa đơn.

khhdon: (Index 3) Ký hiệu hóa đơn.

shdon: (Index 4) Số hóa đơn.

3.2. Cơ chế Pagination (Phân trang)
Hệ thống sử dụng Ant Design Pagination.

Nút Next: Class .ant-pagination-next.

Trạng thái Disabled: Nút Next có attribute aria-disabled="true" hoặc class .ant-pagination-disabled -> Dừng cào.

Loading State: Khi chuyển trang, cần đợi spinner (.ant-spin-spinning) biến mất trước khi cào dữ liệu mới.

3.3. API Endpoint (Reverse Engineering)
Dựa trên request mẫu, Extension sẽ tái tạo request GET để lấy chi tiết hóa đơn.

URL: https://hoadondientu.gdt.gov.vn:30000/query/invoices/detail

Method: GET

Query Params:

nbmst: Lấy từ row key.

khhdon: Lấy từ row key.

shdon: Lấy từ row key.

khmshdon: Lấy từ row key.

Headers bắt buộc:

Authorization: QUAN TRỌNG. Cần lấy Bearer Token từ localStorage (key thường là token, access_token) hoặc chặn request header của trang hiện tại.

Content-Type: application/json

3.4. Workflow hoạt động
User Action: Người dùng vào trang tra cứu, filter dữ liệu, sau đó mở Popup extension -> Ấn "Bắt đầu tải".

Content Script:

Inject một Overlay hiển thị tiến trình (Progress Bar).

Loop qua các trang (While loop):

Parse DOM lấy danh sách invoiceParams.

Gửi message về Background để download (hoặc xử lý queue tại content).

Tìm nút Next -> Click -> Wait for loading -> Lặp lại.

Background Service Worker:

Nhận request download.

Gọi API detail fetch dữ liệu XML/PDF.

Sử dụng chrome.downloads để lưu file xuống máy.

Xử lý đặt tên file: MST_SoHoaDon.xml.

4. Quy tắc Code (Coding Rules for Cursor)
4.1. Nguyên tắc chung
Type Safety: Sử dụng TypeScript interface rõ ràng cho Invoice, MessagePayload.

Error Handling: Luôn bọc try-catch khi gọi API hoặc thao tác DOM. Nếu API lỗi (429, 500), cần có cơ chế retry (thử lại 3 lần).

Async/Await: Xử lý bất đồng bộ triệt để, đặc biệt là waitForSelector.

No Hardcoding: Các selector class nên define thành hằng số (const).

4.2. Bảo mật & Hiệu năng
Rate Limiting: Không được spam request liên tục. Cần set delay khoảng 300ms - 500ms giữa mỗi lần gọi API detail để tránh bị server block IP.

Memory: Giải phóng các biến mảng lớn sau khi đã xử lý xong.

5. Cấu trúc thư mục (File Structure)
src/
├── manifest.json
├── _locales/              # i18n (vi, en)
├── assets/
├── components/            # Reusable UI components (Button, ProgressBar)
├── background/
│   ├── index.ts           # Service worker entry
│   └── downloadManager.ts # Logic queue download
├── content/
│   ├── index.ts           # Main content script
│   ├── domScraper.ts      # Hàm parse DOM, pagination
│   └── uiInjector.tsx     # React component inject vào page
├── popup/
│   ├── index.html
│   ├── App.tsx
│   └── main.tsx
├── utils/
│   ├── api.ts             # Fetch wrapper
│   └── helpers.ts         # Sleep, Retry logic
└── types/
    └── index.d.ts         # Global types
6. Yêu cầu triển khai chi tiết (Step-by-step Implementation)
Thiết lập Manifest V3: Cấp quyền scripting, activeTab, storage, downloads. Quyền host: https://hoadondientu.gdt.gov.vn/*.

Module domScraper: Viết hàm parseRowKey tách chuỗi UUID và hàm hasNextPage kiểm tra nút next.

Module api: Viết hàm fetchInvoiceDetail nhận vào InvoiceParams và token. Xử lý việc tự động tìm token trong localStorage.

Download Logic:

Nếu API trả về JSON chứa nội dung XML (Base64), decode và lưu thành .xml.

Nếu API trả về link PDF, tải file PDF.

UI Feedback: Hiển thị số lượng đã tải / tổng số, và danh sách lỗi (nếu có) ngay trên giao diện web (Inject UI).