import { useState, useEffect, useCallback } from 'react';
import { api, formatDuration, formatDate, formatTime, formatDateTime } from '../api.js';
import { useAuth } from '../App.jsx';

export default function TimeLog() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ project_id: '', date_from: '', date_to: '', user_id: '' });
  const [error, setError] = useState('');
  const [totalMinutes, setTotalMinutes] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.project_id) params.project_id = filters.project_id;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.user_id && user.role === 'admin') params.user_id = filters.user_id;

      const data = await api.timeEntries({ ...params, limit: 100 });
      setEntries(data);
      setTotalMinutes(data.reduce((acc, e) => acc + (e.duration_minutes || 0), 0));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, user.role]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.projects().then(setProjects).catch(console.error);
    if (user.role === 'admin') {
      api.employees().then(setEmployees).catch(console.error);
    }
  }, [user.role]);

  const deleteEntry = async (id) => {
    if (!confirm('Delete this time entry?')) return;
    try {
      await api.deleteEntry(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters({ project_id: '', date_from: '', date_to: '', user_id: '' });

  // Group entries by date
  const grouped = entries.reduce((acc, entry) => {
    const date = new Date(entry.clock_in + 'Z').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Time Log</h1>
          <p className="page-subtitle">
            {entries.length} entries · {formatDuration(totalMinutes)} total
          </p>
        </div>
        <div className="export-actions">
          <button className="btn-secondary" onClick={() => exportCSV(entries)}>Export CSV</button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-row">
          <div className="form-group-inline">
            <label>Project</label>
            <select value={filters.project_id} onChange={e => setFilter('project_id', e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group-inline">
            <label>From</label>
            <input type="date" value={filters.date_from} onChange={e => setFilter('date_from', e.target.value)} />
          </div>
          <div className="form-group-inline">
            <label>To</label>
            <input type="date" value={filters.date_to} onChange={e => setFilter('date_to', e.target.value)} />
          </div>
          {user.role === 'admin' && (
            <div className="form-group-inline">
              <label>Employee</label>
              <select value={filters.user_id} onChange={e => setFilter('user_id', e.target.value)}>
                <option value="">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          )}
          <button className="btn-link" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner-large" /></div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🕐</div>
          <h3>No time entries found</h3>
          <p>Adjust your filters or clock in from the Dashboard</p>
        </div>
      ) : (
        <div className="timelog-groups">
          {Object.entries(grouped).map(([date, dayEntries]) => {
            const dayTotal = dayEntries.reduce((a, e) => a + (e.duration_minutes || 0), 0);
            return (
              <div key={date} className="timelog-day">
                <div className="timelog-day-header">
                  <span className="timelog-day-date">{date}</span>
                  <span className="timelog-day-total">{formatDuration(dayTotal)}</span>
                </div>
                <div className="timelog-entries">
                  {dayEntries.map(entry => (
                    <EntryRow key={entry.id} entry={entry} user={user} onDelete={deleteEntry} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EntryRow({ entry, user, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`timelog-entry ${!entry.clock_out ? 'active' : ''}`}>
      <div className="timelog-entry-main" onClick={() => setExpanded(!expanded)}>
        <div className="timelog-entry-left">
          {user.role === 'admin' && (
            <div className="entry-avatar" style={{ background: entry.avatar_color || '#4f46e5' }}>
              {(entry.user_name || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="timelog-entry-info">
            {user.role === 'admin' && <div className="entry-user-name">{entry.user_name}</div>}
            <div className="entry-times">
              <span>{formatTime(entry.clock_in)}</span>
              <span className="entry-arrow">→</span>
              <span>{entry.clock_out ? formatTime(entry.clock_out) : <span className="badge-active">Now</span>}</span>
            </div>
            {entry.project_name && (
              <span className="entry-project-tag" style={{ borderColor: entry.project_color, color: entry.project_color }}>
                {entry.project_name}
              </span>
            )}
          </div>
        </div>
        <div className="timelog-entry-right">
          <div className="entry-duration-large">
            {entry.clock_out ? formatDuration(entry.duration_minutes) : <span className="badge-active">Active</span>}
          </div>
          <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div className="timelog-entry-detail">
          {entry.notes && (
            <div className="detail-row">
              <span className="detail-label">Notes</span>
              <span>{entry.notes}</span>
            </div>
          )}
          {(entry.clock_in_lat || entry.clock_in_address) && (
            <div className="detail-row">
              <span className="detail-label">Clock In Location</span>
              <div className="location-info">
                {entry.clock_in_address && <span>{entry.clock_in_address}</span>}
                {entry.clock_in_lat && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${entry.clock_in_lat}&mlon=${entry.clock_in_lng}&zoom=16`}
                    target="_blank"
                    rel="noreferrer"
                    className="map-link"
                  >
                    📍 View on Map
                  </a>
                )}
              </div>
            </div>
          )}
          {(entry.clock_out_lat || entry.clock_out_address) && (
            <div className="detail-row">
              <span className="detail-label">Clock Out Location</span>
              <div className="location-info">
                {entry.clock_out_address && <span>{entry.clock_out_address}</span>}
                {entry.clock_out_lat && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${entry.clock_out_lat}&mlon=${entry.clock_out_lng}&zoom=16`}
                    target="_blank"
                    rel="noreferrer"
                    className="map-link"
                  >
                    📍 View on Map
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="detail-actions">
            <button className="btn-danger-sm" onClick={() => onDelete(entry.id)}>Delete Entry</button>
          </div>
        </div>
      )}
    </div>
  );
}

function exportCSV(entries) {
  const headers = ['Date', 'Employee', 'Project', 'Clock In', 'Clock Out', 'Duration (min)', 'Clock In Location', 'Clock Out Location', 'Notes'];
  const rows = entries.map(e => [
    new Date(e.clock_in).toLocaleDateString(),
    e.user_name || '',
    e.project_name || '',
    formatDateTime(e.clock_in),
    e.clock_out ? formatDateTime(e.clock_out) : '',
    e.duration_minutes || '',
    e.clock_in_address || (e.clock_in_lat ? `${e.clock_in_lat},${e.clock_in_lng}` : ''),
    e.clock_out_address || (e.clock_out_lat ? `${e.clock_out_lat},${e.clock_out_lng}` : ''),
    e.notes || ''
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `timelog-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
