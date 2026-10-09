import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

// One small pool per serverless instance. DATABASE_URL = your Neon / Vercel Postgres connection string (pooled).
let _db: ReturnType<typeof make> | undefined

function make() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!url) throw new Error('DATABASE_URL is not set. Add it in Vercel > Project Settings > Environment Variables.')
  const pool = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } })
  return drizzle({ client: pool, schema })
}

// Lazy, so `vite build` never needs the database.
export const db = new Proxy({} as ReturnType<typeof make>, {
  get(_t, prop) {
    _db ??= make()
    return Reflect.get(_db as object, prop)
  },
})
