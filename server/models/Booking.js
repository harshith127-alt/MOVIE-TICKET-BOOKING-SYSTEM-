const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ticketId: { type: String, required: true, unique: true },
    movie: { type: String, required: true },
    date: { type: String, required: true },
    dateOffset: { type: Number, required: true },
    time: { type: String, required: true },
    seats: { type: [String], required: true },
    price: { type: Number, required: true },
    lang: { type: String, default: '' },
    screen: { type: String, default: '' },
    showtime: { type: Number, required: true },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    cancelledAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: 'bookings' }
);

bookingSchema.index({ user: 1, createdAt: -1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;