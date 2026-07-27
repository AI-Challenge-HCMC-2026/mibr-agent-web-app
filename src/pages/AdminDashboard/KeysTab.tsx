import React, { useEffect, useState } from 'react';
import { fetchLLMKeys, type LLMKeyItem } from '../../lib/ckeyApi';

const KeysTab: React.FC = () => {
  const [keys, setKeys] = useState<LLMKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLLMKeys()
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          setKeys(res.data.items || []);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load API keys list.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleCopy = (keyText: string, id: number) => {
    navigator.clipboard.writeText(keyText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="keys-tab">
      <div className="tab-header">
        <div>
          <h1>AI API Keys</h1>
          <p className="tab-subtitle">
            Manage API keys for accessing LLM services on your account
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card accent">
          <div className="kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Total API Keys</div>
            <div className="kpi-value">{keys.length}</div>
            <div className="kpi-sub">Created</div>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Active Keys</div>
            <div className="kpi-value">{keys.filter((k) => k.is_active).length}</div>
            <div className="kpi-sub good">Active status</div>
          </div>
        </div>
      </div>

      {error && <div className="tab-error" role="alert">{error}</div>}

      <div className="card-section">
        {loading ? (
          <div className="tab-loading">Loading API keys...</div>
        ) : keys.length === 0 ? (
          <div className="empty-state">No API keys created yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="keys-table">
              <thead>
                <tr>
                  <th>Key Name (Label)</th>
                  <th>API Key</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const raw = k.api_key || k.key_prefix || '';
                  const prefix = k.key_prefix || (raw.includes('-') ? raw.split('-').slice(0, 2).join('-') : raw.slice(0, 7));
                  const maskedDisplay = `${prefix || 'ck'}-••••••••`;
                  return (
                    <tr key={k.id}>
                      <td><strong className="key-name">{k.key_name}</strong></td>
                      <td>
                        <code className="key-code" title="Click Copy to copy key">{maskedDisplay}</code>
                      </td>
                      <td>
                        <span className={`status-badge ${k.is_active ? 'ok' : 'fail'}`}>
                          {k.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="nowrap text-xs">{k.created_at_text}</td>
                    <td className="text-right">
                      <button
                        className="btn-copy-sm"
                        onClick={() => handleCopy(k.api_key || k.key_prefix, k.id)}
                      >
                        {copiedId === k.id ? (
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
                            <span>Copy Key</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default KeysTab;
