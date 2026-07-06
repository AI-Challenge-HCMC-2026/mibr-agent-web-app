import React, { useState } from 'react';
import './Login.css';

interface LoginProps {
  onLoginSuccess?: (email: string) => void;
  onSignUpClick?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSignUpClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email address is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setIsLoading(true);
    // Mock authentication process
    setTimeout(() => {
      setIsLoading(false);
      if (onLoginSuccess) {
        onLoginSuccess(email);
      }
    }, 1000);
  };

  return (
    <div className="page-login-wrapper">
      <div className="login-wrap">
        <div className="brand-name">Claude</div>

        <div className="card">
          <h1>Welcome back</h1>
          <p className="subtitle">Log in to continue to your account</p>

          <form onSubmit={handleSubmit}>
            {error && (
              <div 
                style={{ 
                  color: '#ea4335', 
                  backgroundColor: 'rgba(234, 67, 53, 0.1)', 
                  padding: '10px', 
                  borderRadius: '6px', 
                  marginBottom: '16px',
                  fontSize: '13px',
                  textAlign: 'center',
                  border: '1px solid rgba(234, 67, 53, 0.2)'
                }}
              >
                {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                type="email"
                id="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
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
                Remember me
              </label>
              <a 
                href="#forgot" 
                className="forgot" 
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password recovery simulated.');
                }}
              >
                Forgot password?
              </a>
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="divider">or continue with</div>

          <button 
            className="btn-secondary" 
            type="button"
            onClick={() => {
              if (onLoginSuccess) onLoginSuccess('google-user@example.com');
            }}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path 
                fill="#EA4335" 
                d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.15.8 3.88 1.5l2.65-2.55C16.9 3.15 14.7 2.2 12 2.2 6.9 2.2 2.7 6.4 2.7 11.5S6.9 20.8 12 20.8c6.9 0 9.3-4.85 9.3-8.35 0-.55-.06-1-.14-1.45z"
              />
            </svg>
            Continue with Google
          </button>
          <button 
            className="btn-secondary" 
            type="button"
            onClick={() => {
              if (onLoginSuccess) onLoginSuccess('apple-user@example.com');
            }}
            disabled={isLoading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path 
                d="M16.365 1.43c0 1.14-.42 2.07-1.15 2.87-.83.9-2.06 1.6-3.2 1.5-.14-1.1.42-2.24 1.13-3 .82-.9 2.24-1.55 3.22-1.37zm3.83 16.4c-.5 1.15-.74 1.66-1.4 2.68-.92 1.4-2.22 3.15-3.83 3.16-1.43.02-1.8-.94-3.75-.93-1.95.01-2.36.95-3.79.93-1.6-.02-2.84-1.6-3.76-3-2.58-3.88-2.85-8.44-1.26-10.86 1.13-1.73 2.9-2.75 4.57-2.75 1.7 0 2.77 1 4.18 1 1.36 0 2.2-1 4.18-1 1.5 0 3.1.82 4.24 2.24-3.72 2.04-3.12 7.36.62 8.53z"
              />
            </svg>
            Continue with Apple
          </button>

          <p className="footer-note">
            Don't have an account?{' '}
            <a 
              href="#signup" 
              onClick={(e) => {
                e.preventDefault();
                if (onSignUpClick) onSignUpClick();
              }}
            >
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
