require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { ensureMongo } = require('./mongod');

const PORT = Number(process.env.PORT) || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cinebroke';

const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');

const isLocalMongo = /^mongodb:\/\/(127\.0\.0\.1|localhost)/.test(MONGO_URI);

async function main() {
  if (isLocalMongo) await ensureMongo();

  await db.connect(MONGO_URI);
  console.log(`Connected to MongoDB: ${MONGO_URI}`);

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true, db: 'connected' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/bookings', bookingRoutes);

  // Serve the frontend
  const webRoot = path.join(__dirname, '..');
  const indexFile = path.join(webRoot, 'index.html');
  app.use(express.static(webRoot));
  if (fs.existsSync(indexFile)) {
    app.get('*', (req, res) => res.sendFile(indexFile));
  }

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  });

  app.listen(PORT, () => {
    console.log(`CineBroke backend + frontend running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});