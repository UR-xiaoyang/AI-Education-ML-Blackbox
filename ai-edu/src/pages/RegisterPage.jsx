import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';

// Check if running on localhost (skip Turnstile for local development)
const IS_LOCALHOST = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

export function RegisterPage({ onSwitchToLogin, onClose }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [settings, setSettings] = useState({ allowRegistration: false, turnstileEnabled: false, turnstileSiteKey: '' });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const turnstileRef = useRef(null);

  const { register, isLoading, error, clearError } = useAuthStore();

  const shouldUseTurnstile = settings.turnstileEnabled && !!settings.turnstileSiteKey && !IS_LOCALHOST;

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/settings/public`)
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  // Load Turnstile script (only when enabled for non-localhost)
  useEffect(() => {
    if (!shouldUseTurnstile) return;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => setTurnstileReady(true);
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [shouldUseTurnstile]);

  // Initialize Turnstile widget (only when enabled for non-localhost)
  useEffect(() => {
    if (!shouldUseTurnstile || !turnstileReady || !window.turnstile) return;

    const timer = setTimeout(() => {
      if (turnstileRef.current && !turnstileRef.current.innerHTML) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: settings.turnstileSiteKey,
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
          theme: 'dark'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [shouldUseTurnstile, turnstileReady]);

  const validateForm = () => {
    if (username.length < 3) {
      setLocalError('用户名长度至少为 3 个字符');
      return false;
    }
    if (username.length > 50) {
      setLocalError('用户名长度不能超过 50 个字符');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('请输入有效的邮箱地址');
      return false;
    }
    if (password.length < 6) {
      setLocalError('密码长度至少为 6 个字符');
      return false;
    }
    if (password !== confirmPassword) {
      setLocalError('两次输入的密码不一致');
      return false;
    }
    setLocalError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!settings.allowRegistration) {
      setLocalError('系统暂未开放新用户注册，请联系管理员创建账号');
      return;
    }

    if (shouldUseTurnstile && !turnstileToken) {
      setLocalError('请先完成人机验证');
      return;
    }

    if (!validateForm()) {
      return;
    }

    const result = await register({
      username: username.trim(),
      email: email.trim(),
      password,
      displayName: displayName.trim() || username.trim(),
      turnstileToken
    });

    if (result.success && onClose) {
      onClose();
    }
  };

  const handleChange = (setter) => (e) => {
    setter(e.target.value);
    if (localError) setLocalError('');
    if (error) clearError();
  };

  const displayError = localError || error;

  if (!settingsLoading && !settings.allowRegistration) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">🧠</div>
            <h1 className="auth-title text-gradient">综合 AI 实验室</h1>
            <p className="auth-subtitle">注册暂未开放</p>
          </div>
          <div className="auth-error">
            <span>⚠️</span> 系统暂未开放新用户注册，请联系管理员创建账号
          </div>
          <div className="auth-footer">
            <button type="button" className="auth-link" onClick={onSwitchToLogin}>返回登录</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">🧠</div>
          <h1 className="auth-title text-gradient">综合 AI 实验室</h1>
          <p className="auth-subtitle">创建新账号</p>
        </div>

        {/* Error Message */}
        {displayError && (
          <div className="auth-error">
            <span>⚠️</span> {displayError}
          </div>
        )}

        {/* Register Form */}
        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Username */}
          <div className="auth-field">
            <label htmlFor="username">用户名 <span className="auth-required">*</span></label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={handleChange(setUsername)}
              placeholder="用于登录 (3-50字符)"
              autoComplete="username"
              autoFocus
              required
              minLength={3}
              maxLength={50}
            />
          </div>

          {/* Email */}
          <div className="auth-field">
            <label htmlFor="email">邮箱 <span className="auth-required">*</span></label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleChange(setEmail)}
              placeholder="用于找回密码和接收通知"
              autoComplete="email"
              required
            />
          </div>

          {/* Display Name */}
          <div className="auth-field">
            <label htmlFor="displayName">显示名称</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={handleChange(setDisplayName)}
              placeholder="选填，默认为用户名"
              autoComplete="nickname"
            />
          </div>

          {/* Password */}
          <div className="auth-field">
            <label htmlFor="password">密码 <span className="auth-required">*</span></label>
            <div className="auth-password-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handleChange(setPassword)}
                placeholder="至少 6 个字符"
                autoComplete="new-password"
                required
                minLength={6}
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

          {/* Confirm Password */}
          <div className="auth-field">
            <label htmlFor="confirmPassword">确认密码 <span className="auth-required">*</span></label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={handleChange(setConfirmPassword)}
              placeholder="再次输入密码"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          {/* Password Strength Indicator */}
          {password && (
            <div className="auth-password-strength">
              <span>密码强度：</span>
              <span className={
                password.length < 6 ? 'strength-weak' :
                password.length < 10 ? 'strength-medium' : 'strength-strong'
              }>
                {password.length < 6 ? '太短' :
                 password.length < 10 ? '中等' : '强'}
              </span>
            </div>
          )}

          {shouldUseTurnstile && (
            <div className="turnstile-container">
              <div ref={turnstileRef}></div>
            </div>
          )}

                    {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isLoading || !username || !email || !password || !confirmPassword || (shouldUseTurnstile && !turnstileToken)}
          >
            {isLoading ? (
              <>
                <span className="auth-spinner">⏳</span>
                注册中...
              </>
            ) : (
              '注册'
            )}
          </button>

          {/* Terms Notice */}
          <p className="auth-terms">
            注册即表示你同意我们的服务条款和隐私政策
          </p>
        </form>

        {/* Footer */}
        <div className="auth-footer">
          <p>
            已有账号？
            <button
              type="button"
              className="auth-link"
              onClick={onSwitchToLogin}
            >
              立即登录
            </button>
          </p>
        </div>
      </div>

      {/* Register Page Styles */}
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
          max-width: 420px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 40px 32px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          max-height: 90vh;
          overflow-y: auto;
        }

        .auth-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .auth-logo {
          font-size: 2.5rem;
          margin-bottom: 12px;
        }

        .auth-title {
          font-size: 1.5rem;
          margin: 0 0 6px 0;
        }

        .auth-subtitle {
          color: rgba(148, 163, 184, 0.8);
          margin: 0;
          font-size: 0.9rem;
        }

        .auth-error {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .auth-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .auth-field label {
          font-size: 0.85rem;
          color: rgba(226, 232, 240, 0.9);
          font-weight: 500;
        }

        .auth-required {
          color: var(--accent-red);
        }

        .auth-field input[type="text"],
        .auth-field input[type="email"],
        .auth-field input[type="password"] {
          width: 100%;
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-size: 0.95rem;
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
          padding-right: 44px;
        }

        .auth-password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          padding: 4px;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .auth-password-toggle:hover {
          opacity: 1;
        }

        .auth-password-strength {
          font-size: 0.8rem;
          color: rgba(148, 163, 184, 0.8);
          display: flex;
          gap: 8px;
          margin-top: -8px;
        }

        .strength-weak {
          color: #ef4444;
        }

        .strength-medium {
          color: #fbbf24;
        }

        .strength-strong {
          color: #22c55e;
        }

        .turnstile-container {
          display: flex;
          justify-content: center;
          margin: 8px 0;
        }

        .auth-submit {
          width: 100%;
          padding: 12px 24px;
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

        .auth-terms {
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.6);
          text-align: center;
          margin: 0;
          line-height: 1.5;
        }

        .auth-footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 20px;
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
      `}</style>
    </div>
  );
}
