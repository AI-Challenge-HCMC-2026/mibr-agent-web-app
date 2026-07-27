import React, { useEffect, useState } from 'react';
import {
  fetchProfile,
  fetchLLMUsageStats,
  fetchLLMUsage,
  formatVND,
  formatCompact,
  formatModelName,
  type UserProfile,
  type LLMUsageStats,
  type LLMUsageItem,
} from '../../lib/ckeyApi';

interface OverviewTabProps {
  onNavigateToDeposit: () => void;
  onNavigateToUsage: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateToDeposit, onNavigateToUsage }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<LLMUsageStats | null>(null);
  const [recentLogs, setRecentLogs] = useState<LLMUsageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchProfile(),
      fetchLLMUsageStats(),
      fetchLLMUsage(1, 5),
    ])
      .then(([profRes, statsRes, usageRes]) => {
        if (!alive) return;
        if (profRes.success) setProfile(profRes.data.profile);
        if (statsRes.success) setStats(statsRes.data);
        if (usageRes.success) setRecentLogs(usageRes.data.items);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Failed to load overview data.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return <div className="tab-loading">Loading overview data...</div>;
  }

  if (error) {
    return <div className="tab-error" role="alert">{error}</div>;
  }

  const successRate = stats && stats.requests > 0
    ? ((stats.success_requests / stats.requests) * 100).toFixed(1)
    : '100';

  return (
    <div className="overview-tab">
      <div className="tab-header">
        <div>
          <h1>Ckey AI Overview</h1>
          <p className="tab-subtitle">Account management and AI consumption analytics</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={onNavigateToUsage}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="M7 14l4-4 3 3 5-6" />
            </svg>
            <span>View Usage Details</span>
          </button>
          <button className="btn-accent" onClick={onNavigateToDeposit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Deposit Funds</span>
          </button>
        </div>
      </div>

      {/* User Profile Card */}
      {profile && (
        <div className="profile-banner-card">
          <div className="profile-main">
            <div className="profile-avatar">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="profile-info">
              <div className="profile-title-row">
                <h2>{profile.name}</h2>
                <span className="badge-username">@{profile.username}</span>
              </div>
              <p className="profile-email">{profile.email}</p>
              <div className="profile-meta">
                <span>Created: {profile.created_at}</span>
                <span className="dot">•</span>
                <span>API Key: <code>{profile.api_key_masked}</code></span>
              </div>
            </div>
          </div>

          <div className="profile-balance-box">
            <span className="balance-label">Current Balance</span>
            <div className="balance-amount">{profile.balance}</div>
            <button className="btn-deposit-sm" onClick={onNavigateToDeposit}>
              Deposit
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid with Line SVGs */}
      {stats && (
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <div className="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total AI Requests</div>
              <div className="kpi-value">{stats.requests.toLocaleString('en-US')}</div>
              <div className="kpi-sub good">
                {successRate}% successful ({stats.success_requests} req)
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="4" width="16" height="16" rx="2" />
                <rect x="9" y="9" width="6" height="6" />
                <line x1="9" y1="1" x2="9" y2="4" />
                <line x1="15" y1="1" x2="15" y2="4" />
                <line x1="9" y1="20" x2="9" y2="23" />
                <line x1="15" y1="20" x2="15" y2="23" />
                <line x1="20" y1="9" x2="23" y2="9" />
                <line x1="20" y1="15" x2="23" y2="15" />
                <line x1="1" y1="9" x2="4" y2="9" />
                <line x1="1" y1="15" x2="4" y2="15" />
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total Tokens Used</div>
              <div className="kpi-value">{formatCompact(stats.total_tokens)}</div>
              <div className="kpi-sub">
                In: {formatCompact(stats.prompt_tokens)} | Out: {formatCompact(stats.completion_tokens)}
              </div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <div className="kpi-content">
              <div className="kpi-label">Total AI Spend</div>
              <div className="kpi-value">{stats.charged_vnd_text}</div>
              <div className="kpi-sub">
                Cache Read: {formatCompact(stats.cache_read_tokens)} tok
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Requests Preview */}
      <div className="card-section">
        <div className="section-header">
          <h3>Recent API Requests</h3>
          <button className="link-btn" onClick={onNavigateToUsage}>
            <span>View all</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="empty-state">No recent API request history available.</div>
        ) : (
          <div className="table-scroll">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Model</th>
                  <th className="num">Tokens</th>
                  <th className="num">Cost</th>
                  <th className="num">Latency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log) => {
                  const { provider, name } = formatModelName(log.model_name);
                  return (
                    <tr key={log.request_id || log.created_at}>
                      <td className="nowrap">{log.created_at_text}</td>
                      <td>
                        <span className="model-name">
                          {provider && <span className="model-provider">{provider}/</span>}
                          <span className="model-label">{name}</span>
                        </span>
                      </td>
                      <td className="num">{formatCompact(log.total_tokens)}</td>
                      <td className="num strong">{formatVND(log.charged_vnd)}</td>
                      <td className="num">{(log.latency_ms / 1000).toFixed(2)}s</td>
                      <td>
                        <span className={`status-badge ${log.status === 'success' || log.http_status === 200 ? 'ok' : 'fail'}`}>
                          {log.status}
                        </span>
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

export default OverviewTab;
