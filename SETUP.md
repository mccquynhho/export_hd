# Hướng dẫn Setup Dự án

## 1. Cài đặt Dependencies

```bash
npm install
```

## 2. Build Extension

```bash
npm run build
```

## 3. Development Mode (với HMR)

```bash
npm run dev
```

## 4. Load Extension vào Chrome

1. Mở Chrome và vào `chrome://extensions/`
2. Bật "Developer mode" (góc trên bên phải)
3. Click "Load unpacked"
4. Chọn thư mục `dist` sau khi build

## Cấu trúc Dự án

```
src/
├── manifest.json          # Manifest V3 configuration
├── _locales/              # i18n messages (vi)
├── assets/                # Icons và assets
├── background/            # Service worker
│   └── index.ts
├── content/               # Content scripts
│   ├── index.ts          # Main content script
│   ├── domScraper.ts     # DOM scraping và pagination logic
│   └── index.css
├── popup/                 # Popup UI (React)
│   ├── index.html
│   ├── App.tsx
│   └── main.tsx
├── utils/                 # Utilities
│   ├── api.ts            # API wrapper
│   └── helpers.ts        # Helper functions
└── types/                 # TypeScript types
    ├── index.d.ts
    └── global.d.ts
```

## Tính năng đã triển khai

✅ Cấu hình Vite + React + TypeScript
✅ Manifest V3 với i18n
✅ DOM Scraper để lấy dữ liệu từ bảng
✅ Xử lý phân trang tự động
✅ Background service worker để download files
✅ Popup UI với React
✅ TypeScript types đầy đủ
✅ Rate limiting để tránh bị block

## Lưu ý

- Đảm bảo đã đăng nhập vào https://hoadondientu.gdt.gov.vn trước khi sử dụng
- Extension sẽ tự động tìm token từ localStorage
- Files sẽ được lưu vào thư mục `Invoices/` trong Downloads
