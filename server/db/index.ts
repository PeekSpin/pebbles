import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("Missing POSTGRES_URL environment variable");
}

export const db = drizzle(neon(databaseUrl));
console.info("[database] Neon HTTP client initialized");
