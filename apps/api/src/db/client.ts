import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema.js";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the ASK DATABASE API.");
  }

  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000
  });
}

export function createDatabase(connectionString = process.env.DATABASE_URL) {
  const pool = createPool(connectionString);
  return {
    pool,
    db: drizzle(pool, { schema })
  };
}

export type Database = ReturnType<typeof createDatabase>["db"];
