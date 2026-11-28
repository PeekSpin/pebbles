import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function createDatabase() {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing POSTGRES_URL environment variable");
  const database = drizzle(neon(url));
  console.info("[database] Neon HTTP client initialized");
  return database;
}

let database: ReturnType<typeof createDatabase> | undefined;

export function getDb() {
  return database ??= createDatabase();
}
