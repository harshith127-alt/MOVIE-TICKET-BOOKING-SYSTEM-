const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const auth = require('../middleware/auth');

const router = express.Router();

const SESSION_DAYS = Number(process.env.SESSION_DURATION_DAYS) || 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ token, user: user._id, expiresAt });
  return { token, expiresAt };
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!name) return res.status(400).json({ error: 'Name is required.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash });
  const session = await createSession(user);

  res.status(201).json({ user: publicUser(user), token: session.token });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  const session = await createSession(user);
  res.json({ user: publicUser(user), token: session.token });
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) await Session.deleteOne({ token });
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;