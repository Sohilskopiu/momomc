// Usage: DATABASE_URL="postgres://..." npm run db:setup
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) { console.error('Set DATABASE_URL first.'); process.exit(1) }
const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } })
await client.connect()
await client.query(readFileSync(new URL('../db/setup.sql', import.meta.url), 'utf8'))
await client.end()
console.log('Database tables are ready ✅')
