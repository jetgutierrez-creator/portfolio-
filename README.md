# John Emerson T. Gutierrez — Full-Stack Portfolio

A professional personal portfolio website with a working **contact form**,
**PostgreSQL database**, **email notifications**, and a **protected admin panel**.

```
Frontend (index.html)  →  Backend API (Express)  →  Database (PostgreSQL)
                        ↘  Email notification (Nodemailer / SMTP)
```

---

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Frontend  | HTML + CSS + JavaScript (single file, no frameworks) |
| Backend   | Node.js + Express                             |
| Database  | PostgreSQL (via `pg`)                         |
| Email     | Nodemailer (SMTP — works with Gmail, etc.)    |
| Security  | helmet, express-rate-limit, express-session   |

## Project Structure

```
portfolio/
├── index.html        → Main portfolio website (public)
├── admin.html        → Admin panel page (data is protected by login)
├── server.js         → Express server: API routes, security, static files
├── db.js             → PostgreSQL connection pool
├── email.js          → Email notification + auto-reply (Nodemailer)
├── schema.sql        → Database schema (auto-created on startup too)
├── package.json      → Dependencies & start scripts
├── .env.example      → Template for your secret credentials
├── .gitignore        → Keeps .env and node_modules out of git
└── assets/
    └── profile.jpg   → Profile photo
```

The `messages` table stores: `id`, `name`, `email`, `subject`, `message`,
`status` (`unread` / `read` / `replied`), and `created_at` (date & time).

---

## 1. Database Schema / SQL

The schema lives in **`schema.sql`** and is also **auto-created by the server**
the first time it connects, so in most cases you don't need to run it manually.
If you want to run it yourself:

```bash
psql "$DATABASE_URL" -f schema.sql
```

---

## 2. Environment Variables (.env)

All credentials live in a `.env` file — **never in the source code**.

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in a text editor and fill in your real values:

```ini
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/portfolio
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=465
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASSWORD=your_16_char_app_password
OWNER_EMAIL=gjohnemerson@gmail.com
ADMIN_USER=admin
ADMIN_PASSWORD=choose_a_strong_password
SESSION_SECRET=paste_a_long_random_string
PORT=3000
NODE_ENV=development
```

> Generate a strong `SESSION_SECRET` with:
> `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 3. Backend Setup (run locally)

**Prerequisites:** [Node.js 18+](https://nodejs.org) and PostgreSQL (section 5).

```bash
cd portfolio
npm install        # install dependencies (one time)
npm start          # start the server
```

Then open:

- Portfolio → http://localhost:3000
- Admin panel → http://localhost:3000/admin

For development with auto-restart on file changes: `npm run dev`

---

## 4. Email Service Configuration (Gmail — free)

The app sends email through SMTP. Gmail is the easiest free option:

1. Use the Google account **`gjohnemerson@gmail.com`** (recommended so the
   sender looks correct).
2. Turn on **2-Step Verification**: myaccount.google.com → Security.
3. Go to **myaccount.google.com/apppasswords** and create an **App Password**
   (name it e.g. "Portfolio"). Google gives you a **16-character password**.
4. Put it in `.env`:
   ```ini
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=465
   EMAIL_USER=gjohnemerson@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx   ← the App Password (spaces optional)
   OWNER_EMAIL=gjohnemerson@gmail.com
   ```

**How it works after setup:**

- A visitor submits the contact form → the message is saved in the database →
  you receive a notification email at `OWNER_EMAIL` with the visitor's name,
  email, subject, message, and the date & time submitted (replying to that email
  replies directly to the visitor).
- The visitor automatically receives a short *"your message has been received"*
  confirmation email.

**Other providers** (SendGrid, Mailgun, Brevo, Outlook…): just change
`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` to their SMTP values.
If email is not configured, everything still works — messages are saved and you
can read them in the admin panel; only the emails are skipped (a warning is
printed in the server console).

---

## 5. Database Setup (PostgreSQL)

### Option A — Local PostgreSQL

1. Install PostgreSQL (Windows: installer from postgresql.org; macOS:
   `brew install postgresql`; Ubuntu: `sudo apt install postgresql`).
2. Create the database:
   ```bash
   # Windows: use "SQL Shell (psql)"; macOS/Linux: terminal
   psql -U postgres -c "CREATE DATABASE portfolio;"
   ```
3. Set `DATABASE_URL` in `.env`:
   `postgresql://postgres:YOUR_PASSWORD@localhost:5432/portfolio`
4. Start the server — the `messages` table is created automatically.

### Option B — Free cloud database (recommended for deployment)

**Neon** (neon.tech), **Supabase** (supabase.com) and **Render** all offer a free
PostgreSQL database:

1. Create a free project/database in their dashboard.
2. Copy the connection string they show you, e.g.
   `postgresql://user:pass@xxx.neon.tech/portfolio?sslmode=require`
3. Paste it as `DATABASE_URL` (in `.env` locally, or in the hosting dashboard
   when deployed) and set `NODE_ENV=production` so SSL is enabled.

---

## 6. Deployment (example: Render — free)

1. Push this `portfolio` folder to a **GitHub** repository
   (`.gitignore` already keeps `.env` and `node_modules` out of the repo).
2. On render.com: **New → Web Service → connect your repo**.
3. Settings:
   - Build command: `npm install`
   - Start command: `npm start`
4. **Environment → Add Environment Variables:** add every variable from your
   `.env` (`DATABASE_URL`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`,
   `EMAIL_PASSWORD`, `OWNER_EMAIL`, `ADMIN_USER`, `ADMIN_PASSWORD`,
   `SESSION_SECRET`) and set `NODE_ENV=production`.
   (Use a cloud database URL from section 5 — your laptop's localhost
   database is not reachable from the internet.)
5. Deploy. Render gives you a public URL like
   `https://your-portfolio.onrender.com` and
   `https://your-portfolio.onrender.com/admin`.

The same steps work on **Railway** (railway.app) — add the variables under
*Variables*, and it auto-detects `npm start`.

---

## 7. Where Do My Credentials Go? (IMPORTANT)

| Credential                | Where it goes                                  | Where it never goes        |
|---------------------------|------------------------------------------------|----------------------------|
| `DATABASE_URL` (user+pass)| `.env` locally / host dashboard "env vars"     | index.html, JS files, git  |
| `EMAIL_PASSWORD`          | `.env` locally / host dashboard "env vars"     | anywhere public            |
| `ADMIN_USER`/`PASSWORD`   | `.env` locally / host dashboard "env vars"     | frontend source code       |
| `SESSION_SECRET`          | `.env` locally / host dashboard "env vars"     | frontend source code       |

Only `.env.example` (with fake placeholder values) may be committed.
The `.env` file is listed in `.gitignore` so it cannot be committed by accident.

---

## API Reference

| Method | Endpoint                     | Access  | Purpose                       |
|--------|------------------------------|---------|-------------------------------|
| POST   | `/api/messages`              | Public (rate-limited) | Submit contact form |
| GET    | `/api/health`                | Public  | Server status check           |
| POST   | `/api/admin/login`           | Public (rate-limited) | Admin login        |
| POST   | `/api/admin/logout`          | Admin   | Log out                       |
| GET    | `/api/admin/messages`        | Admin   | List all messages             |
| PATCH  | `/api/admin/messages/:id`    | Admin   | Mark as `read` / `replied` / `unread` |
| DELETE | `/api/admin/messages/:id`    | Admin   | Delete a message              |

## Admin Panel

Go to **`/admin`** and log in with `ADMIN_USER` / `ADMIN_PASSWORD` from your
`.env`. You can view messages (newest first), see the date & time received,
mark messages as **read** or **replied**, and **delete** them.

## Security Checklist (already implemented)

- ✅ Parameterized queries everywhere (SQL-injection safe)
- ✅ Server-side validation + input length limits + sanitization
- ✅ Rate limiting (contact form: 5 / 15 min per IP; login: 10 / 15 min)
- ✅ Honeypot anti-spam field on the contact form
- ✅ `helmet` security headers
- ✅ Admin sessions: httpOnly, signed cookies; credentials compared in constant time
- ✅ Secrets only in environment variables (never in frontend code)
- ✅ Database is only reachable by the backend — never exposed publicly
- ✅ No passwords or unnecessary personal data are stored

## Troubleshooting

| Problem | Fix |
|---|---|
| `[db] Could not connect...` in console | Check `DATABASE_URL` in `.env` (correct password? database created?) |
| Emails not arriving | Check the App Password (not your normal Gmail password); check spam folder; look at server console for `[email]` errors |
| "Admin access is not configured" | Set `ADMIN_PASSWORD` in `.env` and restart |
| Contact form says "server unreachable" | Make sure you opened the site through `http://localhost:3000` (the Node server), not by double-clicking the HTML file |
