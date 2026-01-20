import React, { useEffect, useMemo, useState } from 'react';
import type { InvoiceDetailResponse, InvoiceParams, InvoiceLine } from '@/types';

interface StoredPrintData {
  invoice: InvoiceParams;
  data: InvoiceDetailResponse;
}

function useInvoiceData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StoredPrintData | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!hash) {
      setError('Không tìm thấy khóa dữ liệu in (hash trống)');
      setLoading(false);
      return;
    }

    // Extract tabId from URL if present (format: key&tabId=123)
    const urlParams = new URLSearchParams(hash.split('&').slice(1).join('&'));
    const extractedTabId = urlParams.get('tabId');
    if (extractedTabId) {
      setTabId(parseInt(extractedTabId, 10));
    }
    
    // Extract actual key (before &)
    const actualKey = hash.split('&')[0];

    chrome.storage.session.get(actualKey, (res) => {
      const value = res?.[actualKey] as StoredPrintData | undefined;
      if (!value) {
        setError('Không tìm thấy dữ liệu hóa đơn trong storage');
      } else {
        setPayload(value);
      }
      setLoading(false);
    });
  }, []);

  return { loading, error, payload, tabId };
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return { day: '', month: '', year: '' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { day: '', month: '', year: '' };
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return { day, month, year: String(year) };
}

function formatNumber(n?: number | null) {
  if (n === null || n === undefined) return '';
  return n.toLocaleString('vi-VN');
}

// Simple QR Code component using online API
function QRCode({ data }: { data: string }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(data)}`;
  return <img src={qrUrl} alt="QR Code" style={{ width: '80px', height: '80px' }} />;
}

const InvoicePrint: React.FC = () => {
  const { loading, error, payload, tabId } = useInvoiceData();

  // Signal to background when page is ready (fonts, images loaded)
  useEffect(() => {
    if (!loading && payload && tabId) {
      // Wait for fonts and images to load
      const checkReady = () => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => {
            // Wait for images
            const images = document.querySelectorAll('img');
            const imagePromises = Array.from(images).map((img) => {
              if (img.complete) return Promise.resolve();
              return new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve; // Resolve even on error
              });
            });
            
            Promise.all(imagePromises).then(() => {
              // Additional delay to ensure rendering is complete
              setTimeout(() => {
                // Send ready signal to background with tabId
                chrome.runtime.sendMessage({ action: 'CHECK_READY', tabId }, () => {
                  // Background will handle PDF generation
                });
              }, 500);
            });
          });
        } else {
          // Fallback if fonts API not available
          setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'CHECK_READY', tabId }, () => {});
          }, 2000);
        }
      };
      
      // Small delay to ensure React has rendered
      setTimeout(checkReady, 100);
    }
  }, [loading, payload, tabId]);

  const items: InvoiceLine[] = useMemo(() => {
    return (payload?.data?.hdhhdvu as InvoiceLine[]) || [];
  }, [payload]);

  const totals = useMemo(() => {
    if (!payload?.data) return null;
    return {
      preTax: payload.data.tgtcthue,
      tax: payload.data.tgtthue,
      total: payload.data.tgtttbso,
      totalText: payload.data.tgtttbchu,
    };
  }, [payload]);

  const taxRates = useMemo(() => {
    return payload?.data?.thttltsuat || [];
  }, [payload]);

  if (loading) return <div className="print-wrapper"><div className="content">Đang tải dữ liệu in...</div></div>;
  if (error) return <div className="print-wrapper"><div className="content">Lỗi: {error}</div></div>;
  if (!payload) return <div className="print-wrapper"><div className="content">Không có dữ liệu</div></div>;

  const { invoice, data } = payload;
  const dateParts = formatDate(data?.tdlap);

  return (
    <div id="print-layout" className="A4">
      <div className="print-page">
        <div className="bg-container"></div>
        
        <div className="main-page">
          <div className="heading-content">
            <div className="top-content">
              {data?.qrcode && (
                <QRCode data={data.qrcode} />
              )}
              <div className="code-content">
                <b className="code-ms">Mẫu số {data?.khmshdon ?? invoice.khmshdon}</b>
                <b className="code-ms">
                  Ký hiệu: {data?.khhdon ?? invoice.khhdon}
                </b>
                <b className="code-ms">Số: {data?.shdon ?? invoice.shdon}</b>
              </div>
            </div>
            
            <h2 className="main-title">HÓA ĐƠN GIÁ TRỊ GIA TĂNG</h2>
            
            <div className="day">
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div className="data-item-auto-w">
                  <div className="di-label">
                    <span>Ngày</span>
                  </div>
                  <div className="di-value">
                    <div>{dateParts.day}&nbsp;</div>
                  </div>
                </div>
                <div className="data-item-auto-w">
                  <div className="di-label">
                    <span>tháng</span>
                  </div>
                  <div className="di-value">
                    <div>{dateParts.month}&nbsp;</div>
                  </div>
                </div>
                <div className="data-item-auto-w">
                  <div className="di-label">
                    <span>năm</span>
                  </div>
                  <div className="di-value">
                    <div>{dateParts.year}</div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <div>
                  <div className="data-item">
                    <div className="di-label">
                      <span>MCCQT:</span>
                    </div>
                    <div className="di-value">
                      <div>{data?.mhdon}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="vip-divide"></div>

          <div className="content-info">
            <ul className="list-fill-out">
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Tên người bán:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nbten}</div>
                  </div>
                </div>
              </li>
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Mã số thuế:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nbmst}</div>
                  </div>
                </div>
              </li>
              {data?.nbsdthoai && (
                <li>
                  <div className="data-item">
                    <div className="di-label">
                      <span>Điện thoại:</span>
                    </div>
                    <div className="di-value">
                      <div>{data.nbsdthoai}</div>
                    </div>
                  </div>
                </li>
              )}
              {data?.nbstkhoan && (
                <li>
                  <div className="data-item">
                    <div className="di-label">
                      <span>Số tài khoản:</span>
                    </div>
                    <div className="di-value">
                      <div>{data.nbstkhoan}&nbsp;&nbsp;&nbsp;{data.nbtnhang || ''}</div>
                    </div>
                  </div>
                </li>
              )}
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Địa chỉ:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nbdchi}</div>
                  </div>
                </div>
              </li>
              
              <li>
                <div className="vip-divide" style={{ margin: '5px 0' }}></div>
              </li>

              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Tên người mua:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nmten}</div>
                  </div>
                </div>
              </li>
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Mã số thuế:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nmmst}</div>
                  </div>
                </div>
              </li>
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Địa chỉ:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.nmdchi}</div>
                  </div>
                </div>
              </li>
              <li>
                <div className="data-item">
                  <div className="di-label">
                    <span>Hình thức thanh toán:</span>
                  </div>
                  <div className="di-value">
                    <div>{data?.thtttoan}</div>
                  </div>
                </div>
              </li>
              <li className="flex-li">
                <div className="data-item" style={{ width: '50%' }}>
                  <div className="di-label">
                    <span>Đơn vị tiền tệ:</span>
                  </div>
                  <div className="di-value">
                    <div>VND</div>
                  </div>
                </div>
              </li>
            </ul>

            <table className="res-tb">
              <thead style={{ textAlign: 'center' }}>
                <tr>
                  <th className="tb-stt">STT</th>
                  <th className="tb-stt">Tính chất</th>
                  <th className="tb-stt">Loại hàng hoá đặc trưng</th>
                  <th className="tb-thh">Tên hàng hóa, dịch vụ</th>
                  <th className="tb-dvt">Đơn vị tính</th>
                  <th className="tb-sl">Số lượng</th>
                  <th className="tb-dg">Đơn giá</th>
                  <th className="tb-dg">Chiết khấu</th>
                  <th className="tb-ts">Thuế suất</th>
                  <th className="tb-ttct">Thành tiền chưa có thuế GTGT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: InvoiceLine, idx: number) => (
                  <tr key={item.id || idx}>
                    <td className="tx-center">{idx + 1}</td>
                    <td className="tx-center">Hàng hóa, dịch vụ</td>
                    <td style={{ wordWrap: 'break-word', maxWidth: '150px' }}>
                      <br />
                    </td>
                    <td style={{ wordWrap: 'break-word', wordBreak: 'break-all', maxWidth: '1000px', textAlign: 'left' }}>
                      {item.ten}
                    </td>
                    <td className="tx-center">{item.dvtinh}</td>
                    <td className="tx-center">{formatNumber(item.sluong)}</td>
                    <td className="tx-center">{formatNumber(item.dgia)}</td>
                    <td className="tx-center">{formatNumber(item.stckhau || 0)}</td>
                    <td className="tx-center">{item.ltsuat ?? item.tsuat ?? ''}</td>
                    <td className="tx-center">{formatNumber(item.thtien)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-horizontal-wrapper">
              <div style={{ marginRight: '10px' }}>
                <table className="res-tb">
                  <thead style={{ textAlign: 'center' }}>
                    <tr>
                      <th>Thuế suất</th>
                      <th>Tổng tiền chưa thuế</th>
                      <th>Tổng tiền thuế</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxRates.map((rate, idx) => (
                      <tr key={idx}>
                        <td className="tx-center">{rate.tsuat || ''}</td>
                        <td className="tx-center">{formatNumber(rate.thtien)}</td>
                        <td className="tx-center">{formatNumber(rate.tthue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div style={{ flex: 1 }}>
                <table className="res-tb">
                  <tbody>
                    <tr>
                      <td className="tx-center">
                        Tổng tiền chưa thuế
                        <br />
                        (Tổng cộng thành tiền chưa có thuế)
                      </td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        {formatNumber(totals?.preTax)}
                      </td>
                    </tr>
                    <tr>
                      <td className="tx-center">
                        Tổng tiền thuế (Tổng cộng tiền thuế)
                      </td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        {formatNumber(totals?.tax)}
                      </td>
                    </tr>
                    <tr>
                      <td className="tx-center">Tổng tiền phí</td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        
                      </td>
                    </tr>
                    <tr>
                      <td className="tx-center">
                        Tổng tiền chiết khấu thương mại
                      </td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        
                      </td>
                    </tr>
                    <tr>
                      <td className="tx-center">
                        Tổng tiền thanh toán bằng số
                      </td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        {formatNumber(totals?.total)}
                      </td>
                    </tr>
                    <tr>
                      <td className="tx-center">
                        Tổng tiền thanh toán bằng chữ
                      </td>
                      <td className="tx-center" style={{ minWidth: '200px', maxWidth: '300px' }}>
                        {totals?.totalText}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="vip-divide"></div>

          <div className="ft-sign">
            <div className="sign-dx">
              <h3>
                <p>NGƯỜI MUA HÀNG</p>
                <p>
                  <i>(Chữ ký số (nếu có))</i>
                </p>
                <div style={{ height: '50px' }}></div>
              </h3>

              <h3>
                <p>NGƯỜI BÁN HÀNG</p>
                <p>
                  <i>(Chữ ký điện tử, chữ ký số)</i>
                </p>
                {data?.nbten && (
                  <div className="sign-box">
                    <span>Signature Valid</span>
                    <span>Ký bởi {data.nbten}</span>
                    <span>
                      Ký ngày: {data.tdlap ? new Date(data.tdlap).toISOString().split('.')[0] : ''}
                    </span>
                  </div>
                )}
              </h3>
            </div>

            <div className="fd-end">
              <p>
                <i>(Cần kiểm tra, đối chiếu khi lập, nhận hóa đơn)</i>
              </p>
            </div>
          </div>

          <div className="footer_content" data-footer={new Date().toLocaleString('vi-VN')}></div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrint;
