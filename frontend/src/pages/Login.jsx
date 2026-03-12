import { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'employee' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (mode === 'login') {
        res = await api.login(form.email, form.password);
      } else {
        if (!form.name) { setError('Name is required'); setLoading(false); return; }
        res = await api.register(form.name, form.email, form.password, form.role);
      }
      onLogin(res.token, res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-hero">
          <div className="hero-icon">⏱</div>
          <h1>TimeTrack</h1>
          <p>Track time, manage projects, and keep your team on task — from anywhere.</p>
          <div className="hero-features">
            <div className="hero-feature">
              <span>📍</span>
              <span>GPS Clock In/Out</span>
            </div>
            <div className="hero-feature">
              <span>📋</span>
              <span>Project Management</span>
            </div>
            <div className="hero-feature">
              <span>📷</span>
              <span>Photo Documentation</span>
            </div>
            <div className="hero-feature">
              <span>📊</span>
              <span>Time Reports</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>
              Sign In
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>
              Register
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'register' && (
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" placeholder="John Smith" value={form.name} onChange={set('name')} required />
              </div>
            )}

            <div className="form-group">
              <label>Email Address</label>
              <input type="email" placeholder="you@company.com" value={form.email} onChange={set('email')} required />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required minLength={6} />
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={set('role')}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? <span className="spinner" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
