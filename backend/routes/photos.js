const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../database');
const { requireAuth } = require('./auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { project_id, user_id, limit = 50, offset = 0 } = req.query;
    let where = [];
    let params = [];

    if (req.user.role !== 'admin') {
      where.push('ph.user_id = ?'); params.push(req.user.id);
    } else if (user_id) {
      where.push('ph.user_id = ?'); params.push(user_id);
    }
    if (project_id) { where.push('ph.project_id = ?'); params.push(project_id); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(parseInt(limit), parseInt(offset));

    const photos = await db.all(`
      SELECT ph.*, u.name as user_name, p.name as project_name, p.color as project_color
      FROM photos ph
      LEFT JOIN users u ON ph.user_id = u.id
      LEFT JOIN projects p ON ph.project_id = p.id
      ${whereClause}
      ORDER BY ph.created_at DESC LIMIT ? OFFSET ?
    `, params);
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded' });

    const { project_id, time_entry_id, caption, lat, lng } = req.body;
    const result = await db.run(`
      INSERT INTO photos (user_id, project_id, time_entry_id, filename, original_name, caption, lat, lng)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [req.user.id, project_id || null, time_entry_id || null,
        req.file.filename, req.file.originalname, caption || null, lat || null, lng || null]);

    const photo = await db.get(`
      SELECT ph.*, u.name as user_name, p.name as project_name
      FROM photos ph LEFT JOIN users u ON ph.user_id = u.id LEFT JOIN projects p ON ph.project_id = p.id
      WHERE ph.id = ?
    `, [result.lastInsertRowid]);
    res.json(photo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const photo = await db.get('SELECT * FROM photos WHERE id = ?', [req.params.id]);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (photo.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const filePath = path.join(__dirname, '../uploads', photo.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.run('DELETE FROM photos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
