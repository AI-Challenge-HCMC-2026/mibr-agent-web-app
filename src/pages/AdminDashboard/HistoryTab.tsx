import React, { useEffect, useState, useMemo } from 'react';
import {
  fetchLLMUsage,
  formatVND,
  formatCompact,
  formatModelName,
  type LLMUsageItem,
  type Pagination,
} from '../../lib/ckeyApi';

const HistoryTab: React.FC = () => {
  const [items, setItems] = useState<LLMUsageItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 1,
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch paginated usage logs when page or limit changes
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLLMUsage(page, limit)
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          setItems(res.data.items);
          setPagination(res.data.pagination);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load request history.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [page, limit]);

  // Client-side filtering on the fetched page items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'success'
          ? item.status === 'success' || item.http_status === 200
          : item.status !== 'success' && item.http_status !== 200;

      const matchSearch =
        !searchQuery ||
        item.model_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.request_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.request_id.toLowerCase().includes(searchQuery.toLowerCase());

      return matchStatus && matchSearch;
    });
  }, [items, statusFilter, searchQuery]);

  return (
    <div className="history-tab">
      <div className="tab-header">
        <div>
          <h1>Request History</h1>
          <p className="tab-subtitle">Search and look up detailed LLM API request logs</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="usage-filter-bar">
        <div className="filter-group">
          <div className="search-box-wrapper">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search by Model, Path, Request ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="status-tabs">
            <button
              className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            <button
              className={`status-tab ${statusFilter === 'success' ? 'active' : ''}`}
              onClick={() => setStatusFilter('success')}
            >
              Success
            </button>
            <button
              className={`status-tab ${statusFilter === 'error' ? 'active' : ''}`}
              onClick={() => setStatusFilter('error')}
            >
              Error
            </button>
          </div>
        </div>

        <div className="limit-selector">
          <label htmlFor="limit-select">Display:</label>
          <select
            id="limit-select"
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </div>
      </div>

      {error && <div className="tab-error" role="alert">{error}</div>}

      {/* Logs Table Card */}
      <div className="card-section">
        {loading ? (
          <div className="tab-loading">Loading API history...</div>
        ) : filteredItems.length === 0 ? (
          <div className="empty-state">No matching API requests found.</div>
        ) : (
          <div className="table-scroll">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Time</th>
                  <th>Model</th>
                  <th className="num">Input Tok</th>
                  <th className="num">Output Tok</th>
                  <th className="num">Total Tok</th>
                  <th className="num">Cost</th>
                  <th className="num">Latency</th>
                  <th className="text-center">Stream</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const { provider, name } = formatModelName(item.model_name);
                  return (
                    <tr key={item.request_id || item.created_at}>
                      <td className="font-mono text-xs">{item.request_id}</td>
                      <td className="nowrap text-xs">{item.created_at_text}</td>
                      <td>
                        <span className="model-name">
                          {provider && <span className="model-provider">{provider}/</span>}
                          <span className="model-label">{name}</span>
                        </span>
                      </td>
                      <td className="num text-xs">{formatCompact(item.prompt_tokens)}</td>
                      <td className="num text-xs">{formatCompact(item.completion_tokens)}</td>
                      <td className="num strong text-xs">{formatCompact(item.total_tokens)}</td>
                      <td className="num strong">{formatVND(item.charged_vnd)}</td>
                      <td className="num text-xs">{(item.latency_ms / 1000).toFixed(2)}s</td>
                      <td className="text-center">
                        {item.stream ? (
                          <span className="icon-badge-stream" title="Stream enabled">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                            </svg>
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination.total_pages > 1 && (
          <div className="pagination-bar">
            <span className="pagination-info">
              Page {pagination.page} of {pagination.total_pages} (Total {pagination.total} records)
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
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryTab;
