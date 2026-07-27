import React, { useEffect, useState, useMemo } from 'react';
import {
  fetchLLMModels,
  formatVND,
  formatCompact,
  formatModelName,
  type LLMModel,
} from '../../lib/ckeyApi';

const ModelsTab: React.FC = () => {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    fetchLLMModels()
      .then((res) => {
        if (!alive) return;
        if (res.success) {
          setModels(res.data.models || []);
        }
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load AI models list.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // Extract unique providers for filter tabs
  const providers = useMemo(() => {
    const set = new Set<string>();
    models.forEach((m) => {
      const p = m.provider_username || (m.public_name.includes('/') ? m.public_name.split('/')[0] : '');
      if (p) set.add(p);
    });
    return Array.from(set).sort();
  }, [models]);

  // Filtered models list
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchProvider =
        selectedProvider === 'all'
          ? true
          : (m.provider_username || m.public_name).toLowerCase() === selectedProvider.toLowerCase();

      const query = search.toLowerCase().trim();
      const matchSearch =
        !query ||
        m.display_name.toLowerCase().includes(query) ||
        m.model_name.toLowerCase().includes(query) ||
        m.public_name.toLowerCase().includes(query);

      return matchProvider && matchSearch;
    });
  }, [models, selectedProvider, search]);

  return (
    <div className="models-tab">
      <div className="tab-header">
        <div>
          <h1>AI Models & Pricing Catalog</h1>
          <p className="tab-subtitle">
            Catalog of {models.length} supported AI models on ckey.vn and rate limits
          </p>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Display as Table"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>Table</span>
          </button>
          <button
            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Display as Cards"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span>Grid</span>
          </button>
        </div>
      </div>

      {/* Search & Provider Filter Bar */}
      <div className="models-filter-bar">
        <div className="search-box-wrapper">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search model name (e.g. gpt-4, claude, gemini, deepseek...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="provider-scroll">
          <button
            className={`provider-chip ${selectedProvider === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedProvider('all')}
          >
            All ({models.length})
          </button>
          {providers.map((p) => {
            const count = models.filter(
              (m) => (m.provider_username || m.public_name).toLowerCase() === p.toLowerCase()
            ).length;
            return (
              <button
                key={p}
                className={`provider-chip ${selectedProvider === p ? 'active' : ''}`}
                onClick={() => setSelectedProvider(p)}
              >
                {p} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {error && <div className="tab-error" role="alert">{error}</div>}

      {loading ? (
        <div className="tab-loading">Loading AI models list...</div>
      ) : filteredModels.length === 0 ? (
        <div className="empty-state">No matching models found.</div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="card-section">
          <div className="table-scroll">
            <table className="models-table">
              <thead>
                <tr>
                  <th>Model Name</th>
                  <th>Public Name</th>
                  <th className="num">Input / 1M</th>
                  <th className="num">Output / 1M</th>
                  <th className="num">Min Charge</th>
                  <th>Context Limit</th>
                  <th>Cache</th>
                  <th>Supported Paths</th>
                </tr>
              </thead>
              <tbody>
                {filteredModels.map((m) => {
                  const { provider } = formatModelName(m.public_name);
                  return (
                    <tr key={m.public_name || m.model_name}>
                      <td>
                        <div className="model-cell-title">
                          <span className="model-display-name">{m.display_name}</span>
                          <code className="model-codename">{m.model_name}</code>
                        </div>
                      </td>
                      <td>
                        <span className="badge-provider">
                          {provider ? provider : m.provider_username || 'default'}
                        </span>
                      </td>
                      <td className="num strong">{formatVND(m.input_price_per_million_vnd)}</td>
                      <td className="num strong">{formatVND(m.output_price_per_million_vnd)}</td>
                      <td className="num">{m.min_charge_per_request_vnd} VND</td>
                      <td>
                        {m.context_tokens_limit > 0
                          ? `${formatCompact(m.context_tokens_limit)} tok`
                          : 'Unlimited'}
                      </td>
                      <td>
                        <span className={`badge-cache ${m.cache_enabled ? 'enabled' : 'disabled'}`}>
                          {m.cache_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <div className="tag-cloud">
                          {m.supported_paths?.map((path) => (
                            <span key={path} className="path-tag">
                              {path}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="models-grid">
          {filteredModels.map((m) => {
            const { provider } = formatModelName(m.public_name);
            return (
              <div className="model-card" key={m.public_name || m.model_name}>
                <div className="model-card-header">
                  <div>
                    <h3>{m.display_name}</h3>
                    <code className="model-code">{m.model_name}</code>
                  </div>
                  <span className="badge-provider">
                    {provider || m.provider_username || 'System'}
                  </span>
                </div>

                <div className="model-pricing-grid">
                  <div className="price-box">
                    <span className="price-label">Input / 1M tok</span>
                    <span className="price-val">{formatVND(m.input_price_per_million_vnd)}</span>
                  </div>
                  <div className="price-box">
                    <span className="price-label">Output / 1M tok</span>
                    <span className="price-val">{formatVND(m.output_price_per_million_vnd)}</span>
                  </div>
                </div>

                <div className="model-card-footer">
                  <div className="meta-item">
                    <span className="meta-label">Min charge:</span>
                    <span>{m.min_charge_per_request_vnd} VND</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Context limit:</span>
                    <span>
                      {m.context_tokens_limit > 0
                        ? `${formatCompact(m.context_tokens_limit)}`
                        : 'Unlimited'}
                    </span>
                  </div>
                  {m.cache_enabled && (
                    <div className="meta-item">
                      <span className="meta-label">Cache Read:</span>
                      <span>{formatVND(m.cache_read_price_per_million_vnd)}/1M</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ModelsTab;
