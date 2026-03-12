import { useState, useEffect, createContext, useContext } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Projects from './pages/Projects.jsx';
import TimeLog from './pages/TimeLog.jsx';
import Photos from './pages/Photos.jsx';
import Navbar from './components/Navbar.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    const token = localStorage.getItem('tt_token');
    if (token) {
      api.me()
        .then(setUser)
        .catch(() => localStorage.removeItem('tt_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Hash-based routing
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      setPage(hash);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (p) => {
    window.location.hash = p;
    setPage(p);
  };

  const login = (token, userData) => {
    localStorage.setItem('tt_token', token);
    setUser(userData);
    navigate('dashboard');
  };

  const logout = () => {
    localStorage.removeItem('tt_token');
    setUser(null);
    navigate('dashboard');
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner-large" />
        <p>Loading TimeTrack...</p>
      </div>
    );
  }

  if (!user) return <Login onLogin={login} />;

  const pages = { dashboard: Dashboard, projects: Projects, timelog: TimeLog, photos: Photos };
  const PageComponent = pages[page] || Dashboard;

  return (
    <AuthContext.Provider value={{ user, logout }}>
      <div className="app-layout">
        <Navbar page={page} navigate={navigate} />
        <main className="app-main">
          <PageComponent navigate={navigate} />
        </main>
      </div>
    </AuthContext.Provider>
  );
}
