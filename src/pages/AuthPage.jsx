import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Lock, User, AtSign, Mail, Phone } from 'lucide-react';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, register, setAppBusy, setAppBusyLabel } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setAppBusy(true);
    setAppBusyLabel(isLogin ? 'Signing in' : 'Creating account');

    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setLoading(false);
      setAppBusy(false);
      setAppBusyLabel('Loading');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      setAppBusy(false);
      setAppBusyLabel('Loading');
      return;
    }

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, displayName, password, { email, phone });
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Authentication failed. Please check your credentials and try again.');
      }
    } finally {
      setLoading(false);
      setAppBusy(false);
      setAppBusyLabel('Loading');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="auth-card glass animate-fade-in">
        <div className="auth-header">
          <div className="logo-icon">
            <Shield size={36} className="text-accent" />
          </div>
          <h1>{isLogin ? 'WhisperBox Login' : 'WhisperBox SignUp'}</h1>
          <p>{isLogin ? 'Welcome back.' : 'Create your secure identity.'}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="input-group">
            <User size={18} className="input-icon" />
            <input
              type="text"
              placeholder="Username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="input-group animate-fade-in">
              <AtSign size={18} className="input-icon" />
              <input
                type="text"
                placeholder="Display Name"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>
          )}

          {!isLogin && (
            <div className="input-group animate-fade-in">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                placeholder="Email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          )}

          {!isLogin && (
            <div className="input-group animate-fade-in">
              <Phone size={18} className="input-icon" />
              <input
                type="tel"
                placeholder="Phone Number"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          )}

          <div className="input-group">
            <Lock size={18} className="input-icon" />
            <input
              type="password"
              placeholder="Password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="input-group animate-fade-in">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Confirm Password"
                className="input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className={`btn btn-primary w-full auth-submit-btn ${loading ? 'btn-pulsing' : ''}`}
            disabled={loading}
          >
            {loading ? (isLogin ? 'Signing In...' : 'Creating Account...') : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="auth-footer">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="link-btn">
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
