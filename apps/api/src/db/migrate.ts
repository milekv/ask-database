import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

const migrationDir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const client = new Client({
  connectionString: databaseUrl
});

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _ask_database_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const migrations = ["0001_initial.sql"];
  for (const migration of migrations) {
    const alreadyApplied = await client.query(
      "SELECT 1 FROM _ask_database_migrations WHERE name = $1",
      [migration]
    );
    if (alreadyApplied.rowCount && alreadyApplied.rowCount > 0) {
      continue;
    }

    const sql = await readFile(join(migrationDir, migration), "utf8");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("INSERT INTO _ask_database_migrations (name) VALUES ($1)", [migration]);
    await client.query("COMMIT");
    console.log(`Applied migration ${migration}`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  throw error;
} finally {
  await client.end();
}
