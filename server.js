/*
 * ============================================================
 *  John Emerson T. Gutierrez — Portfolio Backend Server
 *  Node.js + Express + PostgreSQL + Nodemailer
 *
 *  All secrets are read from environment variables (.env).
 *  Nothing sensitive is ever sent to the frontend.
 * ============================================================
 */
require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const db = require('./db');
const mailer = require('./email');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProd = process.env.NODE_ENV === 'production';

/* One proxy hop (Render, Railway, Nginx...) so rate limiting & secure cookies work */
app.set('trust proxy', 1);

/* Security headers (CSP off: the single-file frontend uses inline styles/scripts) */
app.use(helmet({ contentSecurityPolicy: false }));

/* Body parsing with strict size limits */
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

/* ------------------------------------------------------------
 * Rate limiting (spam / abuse protection)
 * ------------------------------------------------------------ */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please try again later.' }
});
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'You have sent too many messages recently. Please try again in a few minutes.' }
});
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Too many login attempts. Please try again later.' }
});
app.use('/api', apiLimiter);

/* ------------------------------------------------------------
 * Session (used only for the admin panel login)
 * ------------------------------------------------------------ */
if (!process.env.SESSION_SECRET) {
  console.warn('[warn] SESSION_SECRET is not set — using a random value (sessions reset on restart). Set it in .env');
}
app.use(session({
  name: 'jeg.sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 2 * 60 * 60 * 1000 }
}));

/* ------------------------------------------------------------
 * Validation helpers
 * ------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 120, email: 160, subject: 200, message: 5000 };
const pretty = { name: 'Full name', email: 'Email address', subject: 'Subject', message: 'Message' };

function cleanContact(body = {}) {
  const data = {
    name: String(body.name ?? '').trim(),
    email: String(body.email ?? '').trim(),
    subject: String(body.subject ?? '').trim(),
    message: String(body.message ?? '').trim()
  };
  const errors = {};
  if (!data.name) errors.name = 'Full name is required.';
  if (!data.email) errors.email = 'Email address is required.';
  else if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address.';
  if (!data.subject) errors.subject = 'Subject is required.';
  if (!data.message) errors.message = 'Message is required.';
  for (const key of Object.keys(LIMITS)) {
    if (data[key].length > LIMITS[key]) errors[key] = `${pretty[key]} must be ${LIMITS[key]} characters or fewer.`;
  }
  return { data, errors };
}

/* Constant-time string comparison (for admin credentials) */
function safeEqual(a, b) {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

/* Admin auth guard */
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ ok: false, error: 'Unauthorized. Please log in.' });
}

/* ------------------------------------------------------------
 * PUBLIC API — contact form
 * ------------------------------------------------------------ */
app.post('/api/messages', contactLimiter, async (req, res) => {
  try {
    /* Honeypot trap — bots fill the hidden "website" field; pretend success so they go away */
    if (req.body && req.body.website) {
      return res.json({ ok: true, message: 'Message sent successfully.' });
    }

    const { data, errors } = cleanContact(req.body);
    if (Object.keys(errors).length) {
      return res.status(400).json({ ok: false, errors, error: 'Please review the highlighted fields and try again.' });
    }

    /* Duplicate-click protection: identical message from the same email within 60s is not stored twice */
    const duplicate = await db.query(
      `SELECT 1 FROM messages
        WHERE email = $1 AND subject = $2 AND message = $3
          AND created_at > NOW() - INTERVAL '60 seconds'
        LIMIT 1`,
      [data.email, data.subject, data.message]
    );
    if (duplicate.rowCount > 0) {
      return res.json({ ok: true, message: 'Message sent successfully.' });
    }

    /* Parameterized query — safe from SQL injection */
    const result = await db.query(
      `INSERT INTO messages (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [data.name, data.email, data.subject, data.message]
    );
    const saved = result.rows[0];

    /* Emails are sent in the background. If email is not configured or fails,
       the message is still safely stored in the database. */
    mailer.sendOwnerNotification({ ...data, created_at: saved.created_at })
      .catch(err => console.error('[email] owner notification failed:', err.message));
    mailer.sendAutoReply(data)
      .catch(err => console.error('[email] auto-reply failed:', err.message));

    return res.status(201).json({ ok: true, message: 'Message sent successfully. Thank you for reaching out!' });
  } catch (err) {
    console.error('[api] POST /api/messages failed:', err.message);
    return res.status(500).json({
      ok: false,
      error: 'Something went wrong on my end while sending your message. Please try again in a moment, or email me directly at gjohnemerson@gmail.com.'
    });
  }
});

/* Health check (handy for uptime monitors / deploy platforms) */
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'running' }));

/* ------------------------------------------------------------
 * ADMIN API — protected by session login
 * ------------------------------------------------------------ */
app.post('/api/admin/login', loginLimiter, (req, res) => {
  if (!process.env.ADMIN_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Admin access is not configured on the server yet.' });
  }
  const { username = '', password = '' } = req.body || {};
  const ok = safeEqual(username, process.env.ADMIN_USER || 'admin') &&
             safeEqual(password, process.env.ADMIN_PASSWORD);
  if (!ok) {
    return res.status(401).json({ ok: false, error: 'Invalid username or password.' });
  }
  req.session.isAdmin = true;
  return res.json({ ok: true });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, email, subject, message, status, created_at
         FROM messages
        ORDER BY created_at DESC
        LIMIT 500`
    );
    return res.json({ ok: true, messages: result.rows });
  } catch (err) {
    console.error('[api] GET /api/admin/messages failed:', err.message);
    return res.status(500).json({ ok: false, error: 'Could not load messages.' });
  }
});

app.patch('/api/admin/messages/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const allowed = ['unread', 'read', 'replied'];
  if (!Number.isInteger(id) || !allowed.includes(status)) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }
  try {
    const result = await db.query(
      'UPDATE messages SET status = $1 WHERE id = $2 RETURNING id',
      [status, id]
    );
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'Message not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api] PATCH /api/admin/messages failed:', err.message);
    return res.status(500).json({ ok: false, error: 'Could not update the message.' });
  }
});

app.delete('/api/admin/messages/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid request.' });
  }
  try {
    const result = await db.query('DELETE FROM messages WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return res.status(404).json({ ok: false, error: 'Message not found.' });
    return res.json({ ok: true });
  } catch (err) {
    console.error('[api] DELETE /api/admin/messages failed:', err.message);
    return res.status(500).json({ ok: false, error: 'Could not delete the message.' });
  }
});

/* ------------------------------------------------------------
 * FRONTEND — serve the portfolio pages
 * (Only these specific files are public; nothing else on disk is exposed.)
 * ------------------------------------------------------------ */
app.use('/assets', express.static(path.join(__dirname, 'assets'), { dotfiles: 'ignore', maxAge: '7d' }));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get(['/admin', '/admin.html'], (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

/* 404 + error handlers */
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));
app.use((err, req, res, next) => {
  console.error('[server]', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

/* ------------------------------------------------------------
 * DATABASE — auto-create the messages table if it does not exist
 * ------------------------------------------------------------ */
async function initDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         SERIAL PRIMARY KEY,
        name       VARCHAR(120) NOT NULL,
        email      VARCHAR(160) NOT NULL,
        subject    VARCHAR(200) NOT NULL,
        message    TEXT         NOT NULL,
        status     VARCHAR(10)  NOT NULL DEFAULT 'unread'
                   CHECK (status IN ('unread', 'read', 'replied')),
        created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at DESC)`);
    console.log('[db] Connected — "messages" table is ready.');
  } catch (err) {
    console.error('[db] Could not connect to PostgreSQL or initialize the table.');
    console.error('[db] Make sure DATABASE_URL is set correctly in your .env file (see README.md).');
    console.error('[db] Reason:', err.message);
  }
}

app.listen(PORT, () => {
  console.log(`\n  ✦ Portfolio server running at http://localhost:${PORT}`);
  console.log(`  ✦ Admin panel:              http://localhost:${PORT}/admin\n`);
  initDatabase();
});
