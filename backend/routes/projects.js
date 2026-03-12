const express = require('express');
const { db } = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await db.all(`
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
    `);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await db.get(`
      SELECT p.*, u.name as created_by_name
      FROM projects p LEFT JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const entries = await db.all(`
      SELECT t.*, u.name as user_name, u.avatar_color
      FROM time_entries t LEFT JOIN users u ON t.user_id = u.id
      WHERE t.project_id = ? ORDER BY t.clock_in DESC LIMIT 20
    `, [req.params.id]);

    const photos = await db.all(`
      SELECT ph.*, u.name as user_name
      FROM photos ph LEFT JOIN users u ON ph.user_id = u.id
      WHERE ph.project_id = ? ORDER BY ph.created_at DESC LIMIT 20
    `, [req.params.id]);

    res.json({ ...project, entries, photos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const result = await db.run(
      'INSERT INTO projects (name, description, color, created_by) VALUES (?, ?, ?, ?)',
      [name, description || null, color || '#4f46e5', req.user.id]
    );
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, description, color, status } = req.body;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    await db.run(
      'UPDATE projects SET name = ?, description = ?, color = ?, status = ? WHERE id = ?',
      [name || project.name, description !== undefined ? description : project.description,
       color || project.color, status || project.status, req.params.id]
    );
    res.json(await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
