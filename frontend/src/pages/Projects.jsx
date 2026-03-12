import { useState, useEffect, useCallback } from 'react';
import { api, formatDuration, formatDate } from '../api.js';
import { useAuth } from '../App.jsx';

const COLORS = ['#4f46e5','#0891b2','#059669','#d97706','#dc2626','#7c3aed','#db2777','#2563eb','#ea580c','#0d9488'];

export default function Projects({ navigate }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', color: '#4f46e5' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');

  const load = useCallback(async () => {
    try {
      const data = await api.projects();
      setProjects(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditProject(null);
    setForm({ name: '', description: '', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    setShowForm(true);
    setError('');
  };

  const openEdit = (p) => {
    setEditProject(p);
    setForm({ name: p.name, description: p.description || '', color: p.color });
    setShowForm(true);
    setError('');
  };

  const saveProject = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editProject) {
        await api.updateProject(editProject.id, form);
      } else {
        await api.createProject(form);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (p) => {
    try {
      await api.updateProject(p.id, { status: p.status === 'active' ? 'archived' : 'active' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteProject = async (p) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProject(p.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = projects.filter(p => filter === 'all' ? true : p.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-subtitle">{projects.filter(p => p.status === 'active').length} active projects</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Project</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="filter-tabs">
        {['active','archived','all'].map(f => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner-large" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No projects yet</h3>
          <p>Create your first project to start tracking time</p>
          <button className="btn-primary" onClick={openCreate}>Create Project</button>
        </div>
      ) : (
        <div className="projects-grid">
          {filtered.map(p => (
            <div key={p.id} className={`project-card ${p.status === 'archived' ? 'archived' : ''}`}>
              <div className="project-card-header" style={{ borderTopColor: p.color }}>
                <div className="project-color-bar" style={{ background: p.color }} />
                <div className="project-card-title">
                  <h3>{p.name}</h3>
                  {p.status === 'archived' && <span className="badge-archived">Archived</span>}
                </div>
                <div className="project-actions">
                  <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✏️</button>
                  <button className="btn-icon" onClick={() => toggleStatus(p)} title={p.status === 'active' ? 'Archive' : 'Activate'}>
                    {p.status === 'active' ? '📁' : '♻️'}
                  </button>
                  {user.role === 'admin' && (
                    <button className="btn-icon danger" onClick={() => deleteProject(p)} title="Delete">🗑️</button>
                  )}
                </div>
              </div>
              {p.description && <p className="project-description">{p.description}</p>}
              <div className="project-stats">
                <div className="project-stat">
                  <span className="project-stat-value">{formatDuration(p.total_minutes)}</span>
                  <span className="project-stat-label">Total Time</span>
                </div>
                <div className="project-stat">
                  <span className="project-stat-value">{p.entry_count}</span>
                  <span className="project-stat-label">Entries</span>
                </div>
                <div className="project-stat">
                  <span className="project-stat-value">{p.photo_count}</span>
                  <span className="project-stat-label">Photos</span>
                </div>
              </div>
              <div className="project-footer">
                <span className="project-created">Created {formatDate(p.created_at)}</span>
                <button className="btn-link" onClick={() => navigate('timelog')}>View Entries →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editProject ? 'Edit Project' : 'New Project'}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <form onSubmit={saveProject} className="modal-body">
              <div className="form-group">
                <label>Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Kitchen Renovation"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief project description..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Color</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch ${form.color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                    />
                  ))}
                </div>
              </div>
              {error && <div className="form-error">{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : (editProject ? 'Save Changes' : 'Create Project')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
