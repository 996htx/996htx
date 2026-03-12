import { useState, useEffect, useCallback } from 'react';
import { api, formatDuration, formatTime, formatDateTime } from '../api.js';
import { useAuth } from '../App.jsx';

function useGPS() {
  const [location, setLocation] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GPS not supported on this device'));
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setLocation(loc);
          setLoading(false);
          resolve(loc);
        },
        (err) => {
          const msg = err.code === 1 ? 'GPS permission denied' : err.code === 2 ? 'GPS unavailable' : 'GPS timeout';
          setGpsError(msg);
          setLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  return { location, gpsError, loading, getLocation };
}

export default function Dashboard({ navigate }) {
  const { user } = useAuth();
  const [activeEntry, setActiveEntry] = useState(null);
  const [summary, setSummary] = useState(null);
  const [projects, setProjects] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [notes, setNotes] = useState('');
  const [clockLoading, setClockLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const { location, gpsError, loading: gpsLoading, getLocation } = useGPS();

  const loadData = useCallback(async () => {
    try {
      const [active, sum, projs, entries] = await Promise.all([
        api.activeEntry(),
        api.summary(),
        api.projects(),
        api.timeEntries({ limit: 5 })
      ]);
      setActiveEntry(active);
      setSummary(sum);
      setProjects(projs.filter(p => p.status === 'active'));
      setRecentEntries(entries);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live elapsed timer
  useEffect(() => {
    if (!activeEntry) return;
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(activeEntry.clock_in + 'Z').getTime()) / 60000);
      setElapsed(diff);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [activeEntry]);

  const handleClockIn = async () => {
    setError('');
    setClockLoading(true);
    try {
      const loc = await getLocation();
      let address = null;
      if (loc) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`);
          const d = await r.json();
          address = d.display_name?.split(',').slice(0, 3).join(',').trim() || null;
        } catch {}
      }
      await api.clockIn({
        project_id: selectedProject || null,
        lat: loc?.lat, lng: loc?.lng, address, notes
      });
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    setError('');
    setClockLoading(true);
    try {
      const loc = await getLocation();
      let address = null;
      if (loc) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${loc.lat}&lon=${loc.lng}&format=json`);
          const d = await r.json();
          address = d.display_name?.split(',').slice(0, 3).join(',').trim() || null;
        } catch {}
      }
      await api.clockOut({ lat: loc?.lat, lng: loc?.lng, address });
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setClockLoading(false);
    }
  };

  if (dataLoading) return <div className="page-loading"><div className="spinner-large" /></div>;

  const isClockedIn = !!activeEntry;
  const todayHours = summary ? formatDuration(summary.today_minutes) : '0h';
  const weekHours = summary ? formatDuration(summary.week_minutes) : '0h';

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Good {getGreeting()}, {user.name.split(' ')[0]}!</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Clock Widget */}
        <div className={`clock-widget ${isClockedIn ? 'clocked-in' : ''}`}>
          <div className="clock-status-badge">
            <span className={`status-dot ${isClockedIn ? 'green' : 'gray'}`} />
            {isClockedIn ? 'Clocked In' : 'Clocked Out'}
          </div>

          {isClockedIn ? (
            <div className="clock-active">
              <div className="clock-elapsed">{formatDuration(elapsed)}</div>
              <div className="clock-since">Since {formatTime(activeEntry.clock_in)}</div>
              {activeEntry.project_name && (
                <div className="clock-project" style={{ borderColor: activeEntry.project_color }}>
                  <span className="project-dot" style={{ background: activeEntry.project_color }} />
                  {activeEntry.project_name}
                </div>
              )}
              {activeEntry.clock_in_address && (
                <div className="clock-location">
                  <span>📍</span> {activeEntry.clock_in_address}
                </div>
              )}
              <button
                className="btn-clock btn-clock-out"
                onClick={handleClockOut}
                disabled={clockLoading || gpsLoading}
              >
                {clockLoading || gpsLoading ? <span className="spinner" /> : ''}
                Clock Out
              </button>
            </div>
          ) : (
            <div className="clock-idle">
              <div className="clock-idle-icon">⏱</div>
              <div className="clock-idle-text">Ready to start work?</div>
              <div className="form-group">
                <label>Project (optional)</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">— No Project —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input
                  type="text"
                  placeholder="What are you working on?"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <button
                className="btn-clock btn-clock-in"
                onClick={handleClockIn}
                disabled={clockLoading || gpsLoading}
              >
                {clockLoading || gpsLoading ? <span className="spinner" /> : ''}
                {gpsLoading ? 'Getting GPS...' : 'Clock In'}
              </button>
            </div>
          )}

          {(gpsError || error) && (
            <div className="clock-error">
              ⚠ {gpsError || error}
            </div>
          )}
          {location && (
            <div className="gps-badge">
              <span>📍</span> GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              {location.accuracy && <span> (±{Math.round(location.accuracy)}m)</span>}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">☀️</div>
            <div className="stat-value">{todayHours}</div>
            <div className="stat-label">Today</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📅</div>
            <div className="stat-value">{weekHours}</div>
            <div className="stat-label">This Week</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('projects')}>
            <div className="stat-icon">📋</div>
            <div className="stat-value">{projects.length}</div>
            <div className="stat-label">Projects</div>
          </div>
        </div>

        {/* Project breakdown */}
        {summary?.project_breakdown?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>This Week by Project</h3>
            </div>
            <div className="project-bars">
              {summary.project_breakdown.map((p, i) => {
                const max = summary.project_breakdown[0].minutes;
                const pct = max > 0 ? (p.minutes / max) * 100 : 0;
                return (
                  <div key={i} className="project-bar-row">
                    <div className="project-bar-label">
                      <span className="project-dot" style={{ background: p.color || '#4f46e5' }} />
                      {p.name || 'No Project'}
                    </div>
                    <div className="project-bar-track">
                      <div className="project-bar-fill" style={{ width: `${pct}%`, background: p.color || '#4f46e5' }} />
                    </div>
                    <div className="project-bar-time">{formatDuration(p.minutes)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Entries */}
        <div className="card">
          <div className="card-header">
            <h3>Recent Entries</h3>
            <button className="btn-link" onClick={() => navigate('timelog')}>View All →</button>
          </div>
          {recentEntries.length === 0 ? (
            <div className="empty-state-small">No time entries yet. Clock in to get started!</div>
          ) : (
            <div className="entry-list">
              {recentEntries.map(entry => (
                <div key={entry.id} className="entry-row">
                  <div className="entry-row-left">
                    {entry.project_name && (
                      <span className="entry-project-tag" style={{ borderColor: entry.project_color, color: entry.project_color }}>
                        {entry.project_name}
                      </span>
                    )}
                    <span className="entry-time">{formatDateTime(entry.clock_in)}</span>
                    {entry.notes && <span className="entry-notes">{entry.notes}</span>}
                  </div>
                  <div className="entry-duration">
                    {entry.clock_out ? formatDuration(entry.duration_minutes) : <span className="badge-active">Active</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
