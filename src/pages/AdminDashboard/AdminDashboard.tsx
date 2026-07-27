import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, clearAdminKey } from '../../lib/ckeyApi';
import OverviewTab from './OverviewTab';
import HistoryTab from './HistoryTab';
import KeysTab from './KeysTab';
import DepositTab from './DepositTab';
import './AdminDashboard.css';

type NavKey = 'overview' | 'history' | 'keys' | 'deposit';

interface NavItem {
  key: NavKey;
  label: string;
  enabled: boolean;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    key: 'history',
    label: 'History',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: 'keys',
    label: 'API Keys',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
      </svg>
    ),
  },
  {
    key: 'deposit',
    label: 'Deposit & Finance',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? 'admin@example.com';
  const [active, setActive] = useState<NavKey>('overview');

  // Route guard: redirect to login if there is no valid admin session key.
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/admin', { replace: true });
    }
  }, [navigate]);

  const getInitials = (value: string) => value.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    clearAdminKey();
    navigate('/admin', { replace: true });
  };

  const handleNav = (item: NavItem) => {
    if (!item.enabled) return;
    setActive(item.key);
  };

  return (
    <div className="page-admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="brand-name">Admin Dashboard</span>
        </div>

        <nav className="admin-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item ${active === item.key ? 'active' : ''} ${
                item.enabled ? '' : 'disabled'
              }`}
              onClick={() => handleNav(item)}
              disabled={!item.enabled}
              title={item.label}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-avatar">{getInitials(email)}</div>
          <div className="footer-text">
            <div className="admin-user-name">{email.split('@')[0]}</div>
            <div className="admin-user-role">Administrator</div>
          </div>
          <button className="footer-icon" onClick={handleLogout} title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      <div className="admin-body">
        {active === 'overview' && (
          <OverviewTab
            onNavigateToDeposit={() => setActive('deposit')}
            onNavigateToUsage={() => setActive('history')}
          />
        )}
        {active === 'history' && <HistoryTab />}
        {active === 'keys' && <KeysTab />}
        {active === 'deposit' && <DepositTab />}
      </div>
    </div>
  );
};

export default AdminDashboard;
