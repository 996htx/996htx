const express = require('express');
const db = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const projects = db.prepare(`
    SELECT p.*, u.name as created_by_name,
      COUNT(DISTINCT t.id) as entry_count,
      COALESCE(SUM(t.duration_minutes), 0) as total_minutes,
      COUNT(DISTINCT ph.id) as photo_count
    FROM projects p
    LEFT JOIN users u ON p.created_by = u.id
    LEFT JOIN time_entries t ON t.project_id = p.id
    LEFT JOIN photos ph ON ph.project_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(projects);
});

router.get('/:id', requireAuth, (req, res) => {
  const project = db.prepare(`
    SELECT p.*, u.name as created_by_name
    FROM projects p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const entries = db.prepare(`
    SELECT t.*, u.name as user_name, u.avatar_color
    FROM time_entries t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.project_id = ?
    ORDER BY t.clock_in DESC
    LIMIT 20
  `).all(req.params.id);

  const photos = db.prepare(`
    SELECT ph.*, u.name as user_name
    FROM photos ph
    LEFT JOIN users u ON ph.user_id = u.id
    WHERE ph.project_id = ?
    ORDER BY ph.created_at DESC
    LIMIT 20
  `).all(req.params.id);

  res.json({ ...project, entries, photos });
});

router.post('/', requireAuth, (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  const result = db.prepare(
    'INSERT INTO projects (name, description, color, created_by) VALUES (?, ?, ?, ?)'
  ).run(name, description || null, color || '#4f46e5', req.user.id);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid);
  res.json(project);
});

router.put('/:id', requireAuth, (req, res) => {
  const { name, description, color, status } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  db.prepare(
    'UPDATE projects SET name = ?, description = ?, color = ?, status = ? WHERE id = ?'
  ).run(
    name || project.name,
    description !== undefined ? description : project.description,
    color || project.color,
    status || project.status,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
