const express = require('express');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');

const router = express.Router();

const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

function toDto(b) {
  return {
    id: b._id,
    ticketId: b.ticketId,
    movie: b.movie,
    date: b.date,
    dateOffset: b.dateOffset,
    time: b.time,
    seats: b.seats,
    price: b.price,
    lang: b.lang,
    screen: b.screen,
    showtime: b.showtime,
    status: b.status,
    cancelledAt: b.cancelledAt ? b.cancelledAt.getTime() : null,
    createdAt: b.createdAt.getTime(),
  };
}

// GET /api/bookings - all bookings for the logged-in user
router.get('/', auth, async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ bookings: bookings.map(toDto) });
});

// POST /api/bookings - create a booking (no payment involved)
router.post('/', auth, async (req, res) => {
  const { movie, date, dateOffset, time, seats, price, lang, screen, showtime } = req.body;

  if (!movie || !time) return res.status(400).json({ error: 'Movie and showtime are required.' });
  if (!Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ error: 'Select at least one seat.' });
  }
  if (typeof price !== 'number' || price < 0) {
    return res.status(400).json({ error: 'Invalid price.' });
  }
  if (typeof showtime !== 'number') return res.status(400).json({ error: 'Invalid showtime.' });

  const ticketId = 'CB-' + String(Date.now() % 100000000) + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  const booking = await Booking.create({
    user: req.user._id,
    ticketId,
    movie,
    date,
    dateOffset,
    time,
    seats,
    price,
    lang,
    screen,
    showtime,
  });

  res.status(201).json({ booking: toDto(booking) });
});

// DELETE /api/bookings/:id - cancel a booking
router.delete('/:id', auth, async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id });
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  if (booking.status === 'cancelled') {
    return res.status(400).json({ error: 'This booking is already cancelled.' });
  }

  const hoursLeft = (booking.showtime - Date.now()) / 3600000;
  if (hoursLeft <= 24) {
    return res.status(400).json({ error: 'Cancellation is not permitted within 24 hours of the showtime.' });
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  await booking.save();

  res.json({ booking: toDto(booking) });
});

module.exports = router;