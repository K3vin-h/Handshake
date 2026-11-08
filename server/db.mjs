import pg from "pg";

// Values always travel separately from SQL. No learner profile fields belong here.
export function createDb(url) {
  const pool = new pg.Pool({
    connectionString: url, max: 3, connectionTimeoutMillis: 3000,
    statement_timeout: 3000, query_timeout: 4000, idleTimeoutMillis: 10_000,
  });
  pool.on("error", () => console.error("Database pool connection lost."));
  return {
    async insertAttempts(learnerId, rows) {
      if (!rows.length) return;
      const values = [];
      const tuples = rows.map((r, i) => {
        values.push(r.ts, learnerId, r.item, r.correct, r.codes);
        const o = i * 5;
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`;
      });
      await pool.query(`INSERT INTO attempts (ts, learner_id, item, correct, codes) VALUES ${tuples.join(", ")}`, values);
    },
    async stats(learnerId) {
      const [daily, items] = await Promise.all([
        pool.query(
          `SELECT to_char(time_bucket('1 day', ts) AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
             count(*)::int AS attempts, avg(correct::int)::float AS accuracy
           FROM attempts WHERE learner_id = $1 AND ts > now() - interval '14 days'
           GROUP BY 1 ORDER BY 1`, [learnerId]),
        pool.query(
          `SELECT item, count(*)::int AS attempts, avg(correct::int)::float AS accuracy
           FROM attempts WHERE learner_id = $1 AND ts > now() - interval '14 days'
           GROUP BY item HAVING count(*) >= 3 ORDER BY accuracy ASC, attempts DESC, item ASC LIMIT 5`, [learnerId]),
      ]);
      return { daily: daily.rows, items: items.rows };
    },
    async createUser({ email, passwordHash = null, googleSub = null, verified = false }) {
      const r = await pool.query(
        `INSERT INTO users (email, password_hash, google_sub, email_verified_at)
         VALUES ($1, $2, $3, CASE WHEN $4::boolean THEN now() END)
         ON CONFLICT DO NOTHING RETURNING *`, [email, passwordHash, googleSub, verified]);
      return r.rows[0] ?? null;
    },
    async findUserByEmail(email) {
      return (await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email])).rows[0] ?? null;
    },
    async findUserByGoogleSub(sub) {
      return (await pool.query("SELECT * FROM users WHERE google_sub = $1", [sub])).rows[0] ?? null;
    },
    async linkGoogle(userId, sub, { clearPassword = false } = {}) {
      const r = await pool.query(
        `UPDATE users SET google_sub = $2, email_verified_at = now(),
           password_hash = CASE WHEN $3::boolean THEN NULL ELSE password_hash END
         WHERE id = $1 AND google_sub IS NULL RETURNING *`, [userId, sub, clearPassword]);
      return r.rows[0] ?? null;
    },
    async setPassword(userId, hash) {
      await pool.query("UPDATE users SET password_hash = $2, email_verified_at = now() WHERE id = $1", [userId, hash]);
    },
    async createSession(tokenHash, userId, expiresAt) {
      await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expiresAt]);
    },
    async sessionUser(tokenHash, now) {
      const r = await pool.query(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = $1 AND s.expires_at > $2`, [tokenHash, now]);
      return r.rows[0] ?? null;
    },
    async deleteSession(tokenHash) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    },
    async deleteUserSessions(userId) {
      await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    },
    async createReset(tokenHash, userId, expiresAt) {
      await pool.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expiresAt]);
    },
    async consumeReset(tokenHash, now) {
      const r = await pool.query(
        `UPDATE password_resets SET used_at = $2
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING user_id`, [tokenHash, now]);
      return r.rows[0]?.user_id ?? null;
    },
    async getState(userId) {
      const r = await pool.query("SELECT profile, progress, rev FROM user_state WHERE user_id = $1", [userId]);
      return r.rows[0] ?? null;
    },
    async saveState(userId, profile, progress, baseRev) {
      const r = baseRev === 0
        ? await pool.query(
            `INSERT INTO user_state (user_id, profile, progress, rev) VALUES ($1, $2, $3, 1)
             ON CONFLICT (user_id) DO NOTHING RETURNING rev`, [userId, profile, progress])
        : await pool.query(
            `UPDATE user_state SET profile = $2, progress = $3, rev = rev + 1, updated_at = now()
             WHERE user_id = $1 AND rev = $4 RETURNING rev`, [userId, profile, progress, baseRev]);
      if (!r.rows.length) return { conflict: true, state: await this.getState(userId) };
      return { rev: r.rows[0].rev };
    },
    async deleteUser(userId) {
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    },
    close: () => pool.end(),
  };
}
