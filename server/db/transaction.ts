import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

// A Pool transaction pins one WebSocket connection until commit or rollback.
// Node 22 supplies WebSocket. Ordinary catalogue reads can continue over HTTP.
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  max: 4,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 10000,
});
export const writeDb = drizzle(pool);
console.info("[database] Neon transaction pool initialized");
export type WriteTransaction = Parameters<
  Parameters<typeof writeDb.transaction>[0]
>[0];
