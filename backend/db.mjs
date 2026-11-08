import pg from "pg";

// Anonymous practice rows only. No names, emails, or account state belong here.
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
    close: () => pool.end(),
  };
}
