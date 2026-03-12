const express = require('express');
const db = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const { user_id, project_id, date_from, date_to, limit = 50, offset = 0 } = req.query;

  let where = [];
  let params = [];

  // Non-admins can only see their own entries
  if (req.user.role !== 'admin') {
    where.push('t.user_id = ?');
    params.push(req.user.id);
  } else if (user_id) {
    where.push('t.user_id = ?');
    params.push(user_id);
  }

  if (project_id) { where.push('t.project_id = ?'); params.push(project_id); }
  if (date_from) { where.push('t.clock_in >= ?'); params.push(date_from); }
  if (date_to) { where.push('t.clock_in <= ?'); params.push(date_to + ' 23:59:59'); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  params.push(parseInt(limit), parseInt(offset));

  const entries = db.prepare(`
    SELECT t.*, u.name as user_name, u.avatar_color, p.name as project_name, p.color as project_color
    FROM time_entries t
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN projects p ON t.project_id = p.id
    ${whereClause}
    ORDER BY t.clock_in DESC
    LIMIT ? OFFSET ?
  `).all(...params);

  res.json(entries);
});

router.get('/active', requireAuth, (req, res) => {
  const userId = req.user.role === 'admin' && req.query.user_id ? req.query.user_id : req.user.id;
  const entry = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM time_entries t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = ? AND t.clock_out IS NULL
    ORDER BY t.clock_in DESC
    LIMIT 1
  `).get(userId);
  res.json(entry || null);
});

router.get('/summary', requireAuth, (req, res) => {
  const userId = req.user.role === 'admin' && req.query.user_id ? req.query.user_id : req.user.id;
  const today = new Date().toISOString().split('T')[0];

  const todayTotal = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN clock_out IS NULL
        THEN ROUND((julianday('now') - julianday(clock_in)) * 1440)
        ELSE duration_minutes
      END
    ), 0) as minutes
    FROM time_entries
    WHERE user_id = ? AND DATE(clock_in) = ?
  `).get(userId, today);

  const weekTotal = db.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN clock_out IS NULL
        THEN ROUND((julianday('now') - julianday(clock_in)) * 1440)
        ELSE duration_minutes
      END
    ), 0) as minutes
    FROM time_entries
    WHERE user_id = ? AND clock_in >= datetime('now', '-7 days')
  `).get(userId);

  const projectBreakdown = db.prepare(`
    SELECT p.name, p.color, COALESCE(SUM(t.duration_minutes), 0) as minutes
    FROM time_entries t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.user_id = ? AND t.clock_in >= datetime('now', '-7 days') AND t.clock_out IS NOT NULL
    GROUP BY t.project_id
    ORDER BY minutes DESC
    LIMIT 5
  `).all(userId);

  res.json({
    today_minutes: todayTotal.minutes,
    week_minutes: weekTotal.minutes,
    project_breakdown: projectBreakdown
  });
});

router.post('/clock-in', requireAuth, (req, res) => {
  const active = db.prepare('SELECT id FROM time_entries WHERE user_id = ? AND clock_out IS NULL').get(req.user.id);
  if (active) return res.status(409).json({ error: 'Already clocked in. Clock out first.' });

  const { project_id, lat, lng, address, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO time_entries (user_id, project_id, clock_in, clock_in_lat, clock_in_lng, clock_in_address, notes)
    VALUES (?, ?, datetime('now'), ?, ?, ?, ?)
  `).run(req.user.id, project_id || null, lat || null, lng || null, address || null, notes || null);

  const entry = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM time_entries t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);
  res.json(entry);
});

router.post('/clock-out', requireAuth, (req, res) => {
  const active = db.prepare('SELECT * FROM time_entries WHERE user_id = ? AND clock_out IS NULL').get(req.user.id);
  if (!active) return res.status(404).json({ error: 'No active clock-in found' });

  const { lat, lng, address, notes } = req.body;
  const duration = db.prepare(`
    SELECT ROUND((julianday('now') - julianday(?)) * 1440) as minutes
  `).get(active.clock_in);

  db.prepare(`
    UPDATE time_entries
    SET clock_out = datetime('now'), clock_out_lat = ?, clock_out_lng = ?, clock_out_address = ?,
        notes = COALESCE(?, notes), duration_minutes = ?
    WHERE id = ?
  `).run(lat || null, lng || null, address || null, notes || null, duration.minutes, active.id);

  const entry = db.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM time_entries t LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(active.id);
  res.json(entry);
});

router.put('/:id', requireAuth, (req, res) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (entry.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { project_id, notes } = req.body;
  db.prepare('UPDATE time_entries SET project_id = ?, notes = ? WHERE id = ?')
    .run(project_id ?? entry.project_id, notes ?? entry.notes, req.params.id);

  res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireAuth, (req, res) => {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Entry not found' });
  if (entry.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
