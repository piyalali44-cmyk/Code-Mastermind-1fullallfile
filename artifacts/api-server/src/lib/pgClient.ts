import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!_pool) {
    // Use Replit's built-in PostgreSQL for local tables (likes, comments, etc.)
    // Supabase data is accessed via the Supabase JS client, not direct pg connection
    const connectionString = process.env.DATABASE_URL;
    _pool = new Pool({ connectionString });
  }
  return _pool;
}
