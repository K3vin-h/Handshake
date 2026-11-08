import "dotenv/config";
import { readFile } from "node:fs/promises";
import pg from "pg";

// Explicit setup command: never run migrations as part of starting the API.
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in .env first.");
  process.exitCode = 1;
} else {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000,
    statement_timeout: 30_000, query_timeout: 35_000,
  });
  client.on("error", () => console.error("Migration database connection lost."));
  try {
    await client.connect();
    await client.query("BEGIN");
    for (const f of ["./schema.sql", "./schema.accounts.sql"]) {
      await client.query(await readFile(new URL(f, import.meta.url), "utf8"));
    }
    await client.query("COMMIT");
    console.log("schema applied");
  } catch {
    try { await client.query("ROLLBACK"); } catch { /* connection may already be closed */ }
    console.error("Schema migration failed. Check DATABASE_URL, service access and TimescaleDB 2.13+ availability.");
    process.exitCode = 1;
  } finally { await client.end(); }
}
