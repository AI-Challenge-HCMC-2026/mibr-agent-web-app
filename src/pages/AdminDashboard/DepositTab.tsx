import React, { useEffect, useState } from 'react';
import {
  fetchDepositInfo,
  fetchDepositCheck,
  fetchDepositHistory,
  type BankInfo,
  type DepositItem,
  type Pagination,
} from '../../lib/ckeyApi';

const DepositTab: React.FC = () => {
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [transferContent, setTransferContent] = useState<string>('');
  const [historyItems, setHistoryItems] = useState<DepositItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [checkingDeposit, setCheckingDeposit] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch Deposit Info & Initial Deposit History
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([fetchDepositInfo(), fetchDepositHistory(page, 20)])
      .then(([infoRes, histRes]) => {
        if (!alive) return;
        if (infoRes.success) {
          setBanks(infoRes.data.banks || []);
          setTransferContent(infoRes.data.transfer_content || '');
        }
        if (histRes.success) {
          setHistoryItems(histRes.data.items || []);
          setPagination(histRes.data.pagination);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load deposit information.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page]);

  const handleCheckDeposit = async () => {
    setCheckingDeposit(true);
    setCheckResult(null);
    try {
      const res = await fetchDepositCheck(1440, 20);
      if (res.success && res.data.has_new_deposit) {
        setCheckResult({
          message: `New deposit detected! Total amount: ${res.data.total_amount_text} (${res.data.count} transaction${res.data.count > 1 ? 's' : ''}).`,
          type: 'success',
        });
        // Refresh history
        const histRes = await fetchDepositHistory(1, 20);
        if (histRes.success) {
          setHistoryItems(histRes.data.items || []);
          setPagination(histRes.data.pagination);
        }
      } else {
        setCheckResult({
          message: 'No new deposit transactions detected in the past 24 hours.',
          type: 'info',
        });
      }
    } catch (err) {
      setCheckResult({
        message: err instanceof Error ? err.message : 'Deposit check failed.',
        type: 'error',
      });
    } finally {
      setCheckingDeposit(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="deposit-tab">
      <div className="tab-header">
        <div>
          <h1>Deposit & Transaction History</h1>
          <p className="tab-subtitle">
            Automated Bank Transfer (VietQR) deposit portal and balance verification
          </p>
        </div>
        <button
          className="btn-accent"
          onClick={handleCheckDeposit}
          disabled={checkingDeposit}
        >
          <svg className={checkingDeposit ? 'spin' : ''} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>{checkingDeposit ? 'Checking...' : 'Check New Deposits'}</span>
        </button>
      </div>

      {checkResult && (
        <div className={`check-alert ${checkResult.type}`}>
          {checkResult.message}
        </div>
      )}

      {error && <div className="tab-error" role="alert">{error}</div>}

      {/* Deposit Bank Cards & VietQR */}
      {loading ? (
        <div className="tab-loading">Loading bank deposit details...</div>
      ) : (
        <div className="deposit-info-container">
          <div className="deposit-instructions-card">
            <h3>Automated Deposit Instructions</h3>
            <ol className="instructions-list">
              <li>Open your mobile Banking Application.</li>
              <li>Transfer funds with the exact <strong>Transfer Content</strong> below or scan the VietQR code.</li>
              <li>Your account balance on ckey.vn will be automatically updated within 1-3 minutes.</li>
            </ol>

            <div className="transfer-content-box">
              <span className="transfer-label">Transfer Content (Required):</span>
              <div className="transfer-code-row">
                <code className="transfer-code">{transferContent}</code>
                <button
                  className="btn-copy-sm"
                  onClick={() => copyToClipboard(transferContent, 'content')}
                >
                  {copiedText === 'content' ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copy Content</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Banks Grid */}
          <div className="banks-grid">
            {banks.map((bank) => (
              <div className="bank-card" key={bank.id || bank.bank_name}>
                <div className="bank-card-header">
                  <span className="bank-badge">{bank.bank_name}</span>
                  <span className="owner-name">{bank.account_owner}</span>
                </div>

                <div className="bank-account-box">
                  <span className="account-label">Account Number:</span>
                  <div className="account-number-row">
                    <strong className="account-number">{bank.account_number}</strong>
                    <button
                      className="btn-copy-icon"
                      onClick={() => copyToClipboard(bank.account_number, `bank-${bank.id}`)}
                      title="Copy account number"
                    >
                      {copiedText === `bank-${bank.id}` ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {bank.qr_url && (
                  <div className="qr-box">
                    <img src={bank.qr_url} alt={`VietQR Code ${bank.bank_name}`} className="qr-image" />
                    <span className="qr-caption">Scan VietQR for instant transfer</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deposit History */}
      <div className="card-section">
        <div className="section-header">
          <h3>Deposit History</h3>
        </div>

        {historyItems.length === 0 ? (
          <div className="empty-state">No deposit history available.</div>
        ) : (
          <div className="table-scroll">
            <table className="deposit-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td><code>#{item.id}</code></td>
                    <td><strong className="amount-text">{item.amount_text}</strong></td>
                    <td className="nowrap text-xs">{item.time_text}</td>
                    <td>
                      <span className="status-badge ok">Success</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Page {pagination.page} of {pagination.total_pages} (Total {pagination.total} transactions)
            </span>
            <div className="pagination-btns">
              <button
                className="btn-page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Previous</span>
              </button>
              <button
                className="btn-page"
                disabled={page >= pagination.total_pages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <span>Next</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepositTab;
