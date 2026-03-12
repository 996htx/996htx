import { useState } from 'react';
import { useAuth } from '../App.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'projects', label: 'Projects', icon: '📋' },
  { id: 'timelog', label: 'Time Log', icon: '🕐' },
  { id: 'photos', label: 'Photos', icon: '📷' },
];

export default function Navbar({ page, navigate }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">⏱</span>
        <span className="brand-name">TimeTrack</span>
      </div>

      <div className="navbar-links">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-link ${page === item.id ? 'active' : ''}`}
            onClick={() => navigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      <div className="navbar-user" onClick={() => setMenuOpen(!menuOpen)}>
        <div className="avatar" style={{ background: user.avatar_color }}>
          {initials}
        </div>
        <div className="user-info">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.role}</span>
        </div>
        <span className="chevron">{menuOpen ? '▲' : '▼'}</span>

        {menuOpen && (
          <div className="user-dropdown">
            <div className="dropdown-header">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
            <button className="dropdown-item danger" onClick={logout}>
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Mobile nav */}
      <div className="mobile-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`mobile-nav-item ${page === item.id ? 'active' : ''}`}
            onClick={() => navigate(item.id)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
