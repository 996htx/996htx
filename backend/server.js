const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/time-entries', require('./routes/timeEntries'));
app.use('/api/photos', require('./routes/photos'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`TimeTrack API running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
