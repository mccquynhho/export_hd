/// <reference types="chrome" />
import { useState, useMemo } from 'react';
import { getMessage, getLastQuarterRange } from '@/utils/helpers';
import type { StartCrawlRequest, StopCrawlRequest, MessageResponse } from '@/types';

function App() {
  const defaultRange = useMemo(() => getLastQuarterRange(), []);

  const [isProcessing, setIsProcessing] = useState(false);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);

  const handleStartDownload = async () => {
    try {
      setIsProcessing(true);

      // Validate dates
      if (!startDate || !endDate) {
        alert('Vui lòng chọn khoảng thời gian');
        setIsProcessing(false);
        return;
      }

      if (new Date(startDate) > new Date(endDate)) {
        alert('Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc');
        setIsProcessing(false);
        return;
      }

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

      // Send message to content script with date range
      const response = await chrome.tabs.sendMessage<StartCrawlRequest, MessageResponse>(
        tab.id,
        {
          action: 'START_CRAWL',
          startDate: startDate,
          endDate: endDate
        }
      );

      if (response?.status === 'error') {
        throw new Error(response.message || 'Unknown error');
      }

      if (response?.status === 'stopped') {
        console.log('Process was stopped by user');
      }
    } catch (error) {
      console.error('Error starting download:', error);
      alert(error instanceof Error ? error.message : 'Có lỗi xảy ra');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStop = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.id) {
        return;
      }

      await chrome.tabs.sendMessage<StopCrawlRequest, MessageResponse>(
        tab.id,
        { action: 'STOP_CRAWL' }
      );

      console.log('Stop signal sent');
    } catch (error) {
      console.error('Error stopping:', error);
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

      {/* Date Range Inputs */}
      <div className="mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Từ ngày
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Đến ngày
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      <div className="space-y-3">
        {!isProcessing ? (
          <button
            onClick={handleStartDownload}
            className="w-full py-3 px-4 rounded-lg font-semibold transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          >
            {getMessage('startDownload')}
          </button>
        ) : (
          <>
            <div className="text-center text-sm text-gray-600">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              {getMessage('processing')}
            </div>
            <button
              onClick={handleStop}
              className="w-full py-3 px-4 rounded-lg font-semibold transition-colors bg-red-600 hover:bg-red-700 text-white"
            >
              Dừng
            </button>
          </>
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <p className="text-xs text-gray-700">
          <strong>Lưu ý:</strong> Đảm bảo bạn đã đăng nhập vào hệ thống trước khi bắt đầu. Extension sẽ tự động lấy danh sách hoá đơn qua API.
        </p>
      </div>
    </div>
  );
}

export default App;
