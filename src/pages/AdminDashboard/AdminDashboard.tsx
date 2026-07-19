import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, clearAdminKey } from '../../lib/ckeyApi';
import Usage from './Usage';
import './AdminDashboard.css';

type NavKey = 'overview' | 'usage' | 'users' | 'settings' | 'logs';

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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    key: 'usage',
    label: 'Usage',
    enabled: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3v18h18" />
        <path d="M7 14l4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    key: 'users',
    label: 'Users',
    enabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    enabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    key: 'logs',
    label: 'Logs',
    enabled: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
];

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? 'admin@example.com';
  const [active, setActive] = useState<NavKey>('overview');

  // Route guard: redirect to login if there is no valid admin key.
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
          <span className="brand-name">Claude</span>
          <span className="brand-badge">Admin</span>
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
              title={item.enabled ? item.label : `${item.label} (coming soon)`}
            >
              {item.icon}
              <span>{item.label}</span>
              {!item.enabled && <span className="nav-soon">soon</span>}
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
          <main className="admin-main">
            <h1>Dashboard</h1>
            <p className="admin-subtitle">Welcome back. This is the admin control panel.</p>

            <div className="admin-stats">
              <div className="stat-card">
                <div className="stat-label">Total users</div>
                <div className="stat-value">1,284</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Active sessions</div>
                <div className="stat-value">37</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">API calls today</div>
                <div className="stat-value">9,402</div>
              </div>
            </div>

            <div className="admin-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
              <h2>Dashboard content coming soon</h2>
              <p>
                This is a placeholder for the admin dashboard. Open <strong>Usage</strong> in the
                sidebar to see model spend tracking.
              </p>
            </div>
          </main>
        )}

        {active === 'usage' && <Usage />}
      </div>
    </div>
  );
};

export default AdminDashboard;
