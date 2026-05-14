import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

// Cloudflare Turnstile Site Key
const TURNSTILE_SITE_KEY = '0x4AAAAAADCIV_KC4Dyc2waK';

// Check if running on localhost (skip Turnstile for local development)
const IS_LOCALHOST = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export function LoginPage({ onSwitchToRegister, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);

  const { login, isLoading, error, clearError } = useAuthStore();

  // Load Turnstile script (only for non-localhost)
  useEffect(() => {
    if (IS_LOCALHOST) return;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Initialize Turnstile widget (only for non-localhost)
  useEffect(() => {
    if (IS_LOCALHOST || !window.turnstile) return;

    const timer = setTimeout(() => {
      if (turnstileRef.current && !turnstileRef.current.innerHTML) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
          theme: 'dark'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [window.turnstile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password) {
      return;
    }

    // Skip Turnstile check on localhost
    if (!IS_LOCALHOST && !turnstileToken) {
      clearError();
      useAuthStore.setState({ error: '请先完成人机验证' });
      return;
    }

    const result = await login(username.trim(), password, turnstileToken);
    if (result.success && onClose) {
      onClose();
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (error) clearError();
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) clearError();
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">🧠</div>
          <h1 className="auth-title text-gradient">综合 AI 实验室</h1>
          <p className="auth-subtitle">用户登录</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="auth-error">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Login Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Username */}
          <div className="auth-field">
            <label htmlFor="username">用户名 / 邮箱</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleUsernameChange}
              placeholder="请输入用户名或邮箱"
              autoComplete="username"
              autoFocus
              required
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="password">密码</label>
            <div className="auth-password-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                placeholder="请输入密码"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? '隐藏密码' : '显示密码'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="auth-options">
            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>记住我</span>
            </label>
          </div>

          {/* Turnstile Widget */}
          <div className="turnstile-container">
            <div ref={turnstileRef}></div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isLoading || !username.trim() || !password || (!IS_LOCALHOST && !turnstileToken)}
          >
            {isLoading ? (
              <>
                <span className="auth-spinner">⏳</span>
                登录中...
              </>
            ) : (
              '登录'
            )}
          </button>
        </form>

        {/* Footer - Registration disabled */}
        <div className="auth-footer">
          <p style={{ color: 'rgba(148, 163, 184, 0.6)', fontSize: '0.85rem' }}>
            请联系系统管理员创建账号
          </p>
        </div>
      </div>

      {/* Auth Page Styles */}
      <style>{`
        .auth-page {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #0B1121 0%, #1e293b 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          padding: 20px;
        }

        .auth-container {
          width: 100%;
          max-width: 400px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .auth-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .auth-logo {
          font-size: 3rem;
          margin-bottom: 16px;
        }

        .auth-title {
          font-size: 1.8rem;
          margin: 0 0 8px 0;
        }

        .auth-subtitle {
          color: rgba(148, 163, 184, 0.8);
          margin: 0;
          font-size: 0.95rem;
        }

        .auth-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .auth-field label {
          font-size: 0.9rem;
          color: rgba(226, 232, 240, 0.9);
          font-weight: 500;
        }

        .auth-field input[type="text"],
        .auth-field input[type="email"],
        .auth-field input[type="password"] {
          width: 100%;
          padding: 14px 16px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #f8fafc;
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }

        .auth-field input:focus {
          outline: none;
          border-color: var(--accent-blue);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
        }

        .auth-field input::placeholder {
          color: rgba(148, 163, 184, 0.5);
        }

        .auth-password-input {
          position: relative;
        }

        .auth-password-input input {
          padding-right: 48px;
        }

        .auth-password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 4px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .auth-password-toggle:hover {
          opacity: 1;
        }

        .auth-options {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .turnstile-container {
          display: flex;
          justify-content: center;
          margin: 8px 0;
        }

        .auth-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          color: rgba(148, 163, 184, 0.9);
        }

        .auth-checkbox input {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--accent-blue);
        }

        .auth-submit {
          width: 100%;
          padding: 14px 24px;
          font-size: 1rem;
          font-weight: 600;
          margin-top: 8px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .auth-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .auth-footer {
          text-align: center;
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .auth-footer p {
          margin: 0;
          color: rgba(148, 163, 184, 0.8);
          font-size: 0.9rem;
        }

        .auth-link {
          background: none;
          border: none;
          color: var(--accent-blue);
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          margin-left: 8px;
          transition: color 0.2s;
        }

        .auth-link:hover {
          color: var(--accent-purple);
          text-decoration: underline;
        }

        /* Demo credentials */
        .auth-demo {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          padding: 16px;
          margin-top: 16px;
        }

        .auth-demo-title {
          font-size: 0.85rem;
          color: rgba(226, 232, 240, 0.8);
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .auth-demo-credentials {
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.9);
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}