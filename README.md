# CineBroke — Movie Ticket Booking (Prototype)

Frontend + backend with **user accounts** stored in **local MongoDB**.
No payments, no deployment — everything runs on your machine.

## Stack
- Frontend: single `index.html` (same app as before)
- Backend: Node.js + Express + Mongoose
- Database: MongoDB Community (free, unlimited, runs locally)

## What's included (backend)
| Endpoint | What it does |
|----------|--------------|
| `POST /api/auth/register` | Create account (name, email, password) |
| `POST /api/auth/login` | Log in, returns a session token |
| `POST /api/auth/logout` | End the session |
| `GET /api/auth/me` | Who am I? |
| `GET /api/bookings` | List current user's tickets |
| `POST /api/bookings` | Book tickets (no payment) |
| `DELETE /api/bookings/:id` | Cancel booking (24h before showtime) |

Passwords are hashed (bcrypt). Sessions and bookings live in MongoDB, so
accounts survive restarts.

## How to run
```sh
cd server
npm install        # only the first time
npm start
```
Then open **http://localhost:3000** in your browser.

The server automatically starts `mongod.exe` (auto-detected, already installed
at `C:\Users\<user>\.local\mongodb`) using the data folder `server\.data\db`.
No MongoDB install/mongod steps needed by hand.

## Notes
- Click "Login / Sign Up" in the nav to create an account or log in.
- Booking now saves the ticket to MongoDB, tied to the logged-in user.
- "Tickets" shows the current user's tickets; cancellation is stored too.
- `.env` optional: copy `.env.example` to `.env` to change PORT / MONGO_URI.