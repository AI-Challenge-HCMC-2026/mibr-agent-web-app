import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyAdminKey, UnauthorizedError } from '../../lib/ckeyApi';
import { isAdminEmail } from '../../lib/adminAuth';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Vui lòng nhập email quản trị');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu');
      return;
    }

    setIsLoading(true);
    try {
      // Gate 1: the email must be in the admin allowlist (admin_users).
      const allowed = await isAdminEmail(email);
      if (!allowed) {
        setError('Email này không có quyền truy cập quản trị.');
        return;
      }
      // Gate 2: the password IS the admin key; verify it against the proxy.
      await verifyAdminKey(password);
      navigate('/admin/dashboard', { state: { email } });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setError('Mật khẩu không đúng.');
      } else {
        setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-admin-login-wrapper">
      <div className="login-wrap">
        <div className="brand">
          <span className="brand-name">Claude</span>
          <span className="brand-badge">Admin</span>
        </div>

        <div className="card">
          <h1>Admin sign in</h1>
          <p className="subtitle">Access the dashboard control panel</p>

          <form onSubmit={handleSubmit}>
            {error && <div className="error-banner">{error}</div>}

            <div className="field">
              <label htmlFor="admin-email">Admin email</label>
              <input
                type="email"
                id="admin-email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label htmlFor="admin-password">Password</label>
              <input
                type="password"
                id="admin-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <div className="row-between">
              <label className="remember">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={isLoading}
                />
                Keep me signed in
              </label>
              <a
                href="#forgot"
                className="forgot"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Please contact your system administrator to reset access.');
                }}
              >
                Forgot password?
              </a>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign in to dashboard'}
            </button>
          </form>

          <div className="security-note">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Restricted access. Authorized administrators only.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
