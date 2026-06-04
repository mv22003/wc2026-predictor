require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./src/db');
const { startAutoSync, isConfigured } = require('./src/services/liveScores');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json());

initDb();

app.use('/api/matches',     require('./src/routes/matches'));
app.use('/api/predictions', require('./src/routes/predictions'));
app.use('/api/leaderboard', require('./src/routes/leaderboard'));
app.use('/api/admin',       require('./src/routes/admin'));
app.get('/api/health',      (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (_, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🌍 WC2026 Predictor running on http://localhost:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   Admin key: ${process.env.ADMIN_KEY || 'wc2026admin'}`);
  }

  // Start live scores auto-sync if configured
  const syncInterval = parseInt(process.env.WORLDCUP_SYNC_INTERVAL || '0', 10);
  if (isConfigured() && syncInterval > 0) {
    startAutoSync(syncInterval);
  } else if (isConfigured()) {
    console.log('⚽ Live scores API configured. Set WORLDCUP_SYNC_INTERVAL=5 for auto-sync.');
  } else {
    console.log('ℹ️  Live scores: add WORLDCUP_API_TOKEN to .env to enable auto-sync.');
  }
});
