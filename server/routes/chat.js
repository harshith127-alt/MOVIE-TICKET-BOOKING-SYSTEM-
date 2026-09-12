const express = require('express');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_MESSAGE = 2000;
const MAX_HISTORY = 16;
const MAX_OUTPUT = 512;
const TIMEOUT_MS = 20000;

const MOVIES = [
  { title: 'Mirzapur: The Movie', genre: 'action', rating: 7.9, price: 180, lang: 'Hindi', langs: ['Hindi', 'Kannada'] },
  { title: 'Spider-Man: Brand New Day', genre: 'action', rating: 8.1, price: 220, lang: 'English', langs: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada'] },
  { title: 'The Odyssey', genre: 'drama', rating: 8.6, price: 250, lang: 'English', langs: ['English'] },
  { title: 'I\'m Game', genre: 'action', rating: 7.5, price: 170, lang: 'Malayalam', langs: ['Malayalam', 'Telugu', 'Hindi', 'Tamil', 'Kannada'] },
  { title: 'Insidious: Out of the Further', genre: 'horror', rating: 6.5, price: 200, lang: 'English', langs: ['English'] },
  { title: 'Romanchakam', genre: 'drama', rating: 7.2, price: 160, lang: 'Telugu', langs: ['Telugu', 'Hindi', 'Tamil', 'Kannada'] },
  { title: 'Swayambhu', genre: 'action', rating: 8.3, price: 180, lang: 'Telugu', langs: ['Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam'] },
  { title: 'Coyote vs. Acme', genre: 'comedy', rating: 7.6, price: 190, lang: 'English', langs: ['English'] },
  { title: 'DC', genre: 'action', rating: 7.8, price: 170, lang: 'Tamil', langs: ['Tamil', 'Telugu', 'Hindi', 'Kannada'] },
  { title: 'Toxic: A Fairy Tale for Grown-ups', genre: 'action', rating: 7.3, price: 200, lang: 'Kannada', langs: ['Kannada', 'Hindi', 'Telugu', 'Tamil', 'Malayalam', 'English'] },
];

const OFFERS = [
  { code: 'HDFC10', title: '10% Off Upto ₹100' },
  { code: 'IMAX100', title: 'Flat ₹100 Off' },
  { code: 'STUDENT20', title: 'Student Saver 20% Off' },
  { code: 'WEEKEND50', title: 'Weekend ₹50 Off' },
];

const SYSTEM_PROMPT = [
  'You are CineBot, the friendly AI assistant for CineBroke, an Indian movie ticket booking website (a college project demo, no real payments).',
  'Keep replies concise (under 120 words), warm and helpful with light emoji. Use simple formatting. Never mention you are an AI model unless asked; just say you are CineBot.',
  '',
  'MOVIES SHOWING (title — genre — rating/10 — starting price):',
  ...MOVIES.map(
    (m) => `- ${m.title} — ${m.genre} — ${m.rating}/10 — from ₹${m.price} — languages: ${m.langs.join(', ')}`
  ),
  '',
  'ACTIVE OFFER CODES:',
  ...OFFERS.map((o) => `- ${o.code}: ${o.title}`),
  '',
  'HOW BOOKING WORKS: 1) Pick a movie, 2) choose language & screen (2D/IMAX/LASER/4DX), 3) pick a date (next 7 days) and showtime, 4) choose seats, 5) optionally apply one offer code, 6) press BOOK NOW. A login is required to book tickets — users can register or log in via the Login/Sign Up button.',
  'SEATS: rows A–D and G–H are standard; rows E and F are VIP (+₹200). Up to 10 seats per booking.',
  'CANCELLATION: tickets can be cancelled up to 24 hours before showtime. Refunds are simulated (no real money). Bookings within 24h of the show cannot be cancelled.',
  'PRICES are in Indian Rupees (₹). Movies can often be viewed in multiple languages.',
  'If asked something outside this app, politely steer the conversation back to CineBroke.',
].join('\n');

// Simple in-memory rate limiter to protect the free Gemini tier (per IP).
const buckets = new Map();
function rateLimit(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 20;
  const entry = buckets.get(ip);
  if (!entry || now - entry.start > windowMs) {
    buckets.set(ip, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  if (entry.count > max) return false;
  return true;
}

function cap(text, max) {
  const t = String(text || '');
  return t.length > max ? t.slice(0, max) : t;
}

router.post('/', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  if (process.env.DISABLE_CHAT_RATE_LIMIT !== '1' && !rateLimit(ip)) {
    return res.status(429).json({ error: 'Too many messages. Please wait a moment and try again.' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(503).json({
      error: 'CineBot AI is not configured yet. Set GEMINI_API_KEY in the server environment.',
    });
  }

  const message = String((req.body && req.body.message) || '').trim().slice(0, MAX_MESSAGE);
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const history = Array.isArray(req.body && req.body.history) ? req.body.history.slice(-MAX_HISTORY) : [];
  const contents = history
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && m.text)
    .map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: cap(m.text, MAX_MESSAGE) }],
    }));
  contents.push({ role: 'user', parts: [{ text: message }] });

  let controller;
  try {
    controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: MAX_OUTPUT,
          topP: 0.9,
        },
      }),
    });

    clearTimeout(timer);

    const data = await geminiRes.json().catch(() => null);

    if (!geminiRes.ok) {
      const gemMsg =
        (data && data.error && data.error.message) || `Gemini API error (${geminiRes.status})`;
      return res.status(geminiRes.status === 429 ? 429 : 502).json({ error: gemMsg });
    }

    const text =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!text) return res.status(502).json({ error: 'The AI returned an empty response.' });

    return res.json({ reply: text.trim() });
  } catch (e) {
    if (controller && controller.signal.aborted) {
      return res.status(504).json({ error: 'The AI took too long to respond. Please try again.' });
    }
    return res.status(502).json({ error: 'Could not reach the AI service. Please try again.' });
  }
});

module.exports = router;