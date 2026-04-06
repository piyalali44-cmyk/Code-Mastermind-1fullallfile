import { Pool } from "pg";

let _pool: Pool | null = null;

export function getPgPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}
