import { useState, useEffect, useCallback, useRef } from 'react';
import { api, formatDateTime } from '../api.js';
import { useAuth } from '../App.jsx';

export default function Photos() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [filterProject, setFilterProject] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef();

  const [uploadForm, setUploadForm] = useState({
    project_id: '',
    caption: '',
    file: null,
    preview: null,
    lat: null,
    lng: null
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterProject) params.project_id = filterProject;
      const data = await api.photos({ ...params, limit: 100 });
      setPhotos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterProject]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.projects().then(setProjects).catch(console.error); }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setUploadForm(f => ({ ...f, file, preview: ev.target.result }));
    reader.readAsDataURL(file);

    // Get GPS for photo
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUploadForm(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude })),
        () => {}
      );
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.file) { setError('Please select a photo'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('photo', uploadForm.file);
      if (uploadForm.project_id) formData.append('project_id', uploadForm.project_id);
      if (uploadForm.caption) formData.append('caption', uploadForm.caption);
      if (uploadForm.lat) formData.append('lat', uploadForm.lat);
      if (uploadForm.lng) formData.append('lng', uploadForm.lng);

      await api.uploadPhoto(formData);
      setShowUpload(false);
      setUploadForm({ project_id: '', caption: '', file: null, preview: null, lat: null, lng: null });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setUploadForm(f => ({ ...f, file, preview: ev.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const deletePhoto = async (id) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.deletePhoto(id);
      if (lightbox?.id === id) setLightbox(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openLightbox = (photo, idx) => setLightbox({ ...photo, idx });
  const closeLightbox = () => setLightbox(null);

  const navLightbox = (dir) => {
    const newIdx = lightbox.idx + dir;
    if (newIdx >= 0 && newIdx < photos.length) setLightbox({ ...photos[newIdx], idx: newIdx });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Photos</h1>
          <p className="page-subtitle">{photos.length} photos</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowUpload(true); setError(''); }}>+ Upload Photo</button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {/* Filters */}
      <div className="filter-bar">
        <div className="filter-row">
          <div className="form-group-inline">
            <label>Project</label>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}>
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {filterProject && (
            <button className="btn-link" onClick={() => setFilterProject('')}>Clear</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="page-loading"><div className="spinner-large" /></div>
      ) : photos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📷</div>
          <h3>No photos yet</h3>
          <p>Upload photos to document your project work</p>
          <button className="btn-primary" onClick={() => setShowUpload(true)}>Upload Photo</button>
        </div>
      ) : (
        <div className="photo-grid">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="photo-card" onClick={() => openLightbox(photo, idx)}>
              <div className="photo-img-wrap">
                <img src={`/uploads/${photo.filename}`} alt={photo.caption || photo.original_name} loading="lazy" />
                <div className="photo-overlay">
                  <span className="photo-zoom">🔍</span>
                </div>
              </div>
              <div className="photo-info">
                {photo.project_name && (
                  <span className="photo-project" style={{ color: photo.project_color }}>
                    {photo.project_name}
                  </span>
                )}
                {photo.caption && <p className="photo-caption">{photo.caption}</p>}
                <div className="photo-meta">
                  <span>{photo.user_name}</span>
                  <span>{formatDateTime(photo.created_at)}</span>
                </div>
                {photo.lat && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${photo.lat}&mlon=${photo.lng}&zoom=16`}
                    target="_blank"
                    rel="noreferrer"
                    className="map-link"
                    onClick={e => e.stopPropagation()}
                  >
                    📍 Location
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload Photo</h2>
              <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload} className="modal-body">
              <div
                className={`dropzone ${uploadForm.preview ? 'has-preview' : ''}`}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current.click()}
              >
                {uploadForm.preview ? (
                  <img src={uploadForm.preview} alt="Preview" className="upload-preview" />
                ) : (
                  <div className="dropzone-content">
                    <span className="dropzone-icon">📷</span>
                    <span>Click or drag a photo here</span>
                    <span className="dropzone-hint">JPG, PNG, GIF, WebP · Max 10MB</span>
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
              </div>

              {uploadForm.lat && (
                <div className="gps-badge">
                  <span>📍</span> GPS: {uploadForm.lat.toFixed(4)}, {uploadForm.lng.toFixed(4)}
                </div>
              )}

              <div className="form-group">
                <label>Project</label>
                <select
                  value={uploadForm.project_id}
                  onChange={e => setUploadForm(f => ({ ...f, project_id: e.target.value }))}
                >
                  <option value="">— No Project —</option>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Caption</label>
                <input
                  type="text"
                  placeholder="Describe what's in this photo..."
                  value={uploadForm.caption}
                  onChange={e => setUploadForm(f => ({ ...f, caption: e.target.value }))}
                />
              </div>

              {error && <div className="form-error">{error}</div>}

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={uploading || !uploadForm.file}>
                  {uploading ? <span className="spinner" /> : 'Upload Photo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>✕</button>
          {lightbox.idx > 0 && (
            <button className="lightbox-nav lightbox-prev" onClick={e => { e.stopPropagation(); navLightbox(-1); }}>‹</button>
          )}
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <img src={`/uploads/${lightbox.filename}`} alt={lightbox.caption || ''} />
            <div className="lightbox-info">
              {lightbox.project_name && (
                <span className="photo-project" style={{ color: lightbox.project_color }}>{lightbox.project_name}</span>
              )}
              {lightbox.caption && <p>{lightbox.caption}</p>}
              <div className="lightbox-meta">
                <span>📷 {lightbox.user_name}</span>
                <span>{formatDateTime(lightbox.created_at)}</span>
                {lightbox.lat && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${lightbox.lat}&mlon=${lightbox.lng}&zoom=16`}
                    target="_blank"
                    rel="noreferrer"
                    className="map-link"
                  >
                    📍 View Location
                  </a>
                )}
              </div>
              <button className="btn-danger-sm" onClick={() => deletePhoto(lightbox.id)}>Delete Photo</button>
            </div>
          </div>
          {lightbox.idx < photos.length - 1 && (
            <button className="lightbox-nav lightbox-next" onClick={e => { e.stopPropagation(); navLightbox(1); }}>›</button>
          )}
        </div>
      )}
    </div>
  );
}
