/// <reference types="chrome" />
import { useState } from 'react';
import { getMessage } from '@/utils/helpers';
import type { StartCrawlRequest, MessageResponse } from '@/types';

function App() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartDownload = async () => {
    try {
      setIsProcessing(true);

      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // Check if we're on the correct domain
      if (!tab.url?.includes('hoadondientu.gdt.gov.vn')) {
        alert('Vui lòng mở trang https://hoadondientu.gdt.gov.vn trước khi sử dụng extension này.');
        setIsProcessing(false);
        return;
      }

      // Send message to content script
      const response = await chrome.tabs.sendMessage<StartCrawlRequest, MessageResponse>(
        tab.id,
        { action: 'START_CRAWL' }
      );

      if (response?.status === 'error') {
        throw new Error(response.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error starting download:', error);
      alert(error instanceof Error ? error.message : 'Có lỗi xảy ra');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-[300px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {getMessage('appName')}
        </h1>
        <p className="text-sm text-gray-600">
          {getMessage('appDescription')}
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleStartDownload}
          disabled={isProcessing}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
            isProcessing
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isProcessing ? getMessage('processing') : getMessage('startDownload')}
        </button>

        {isProcessing && (
          <div className="text-center text-sm text-gray-600">
            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            {getMessage('processing')}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-xs text-gray-700">
          <strong>Lưu ý:</strong> Đảm bảo bạn đã đăng nhập vào hệ thống và đang ở trang danh sách hóa đơn trước khi bắt đầu.
        </p>
      </div>
    </div>
  );
}

export default App;
