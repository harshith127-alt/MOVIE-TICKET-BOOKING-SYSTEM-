const Session = require('../models/Session');

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const session = await Session.findOne({ token }).populate('user');
  if (!session || session.expiresAt < new Date()) {
    if (session && session.expiresAt < new Date()) await Session.deleteOne({ _id: session._id });
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }

  req.user = session.user;
  req.token = token;
  next();
}

module.exports = auth;