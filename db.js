/*
 * PostgreSQL connection pool.
 * The connection string comes ONLY from the DATABASE_URL environment variable —
 * credentials are never written in source code.
 *
 *   Local example:   postgresql://postgres:password@localhost:5432/portfolio
 *   Cloud example:   postgresql://user:pass@host.neon.tech/dbname?sslmode=require
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  /* Cloud Postgres providers (Neon, Supabase, Render) require SSL */
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000
});

pool.on('error', err => {
  console.error('[db] Unexpected database error:', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
