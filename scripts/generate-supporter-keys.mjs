#!/usr/bin/env node
/**
 * Generate supporter keys for manual distribution via Facebook Fanpage DM.
 *
 * Usage:
 *   node scripts/generate-supporter-keys.mjs [count]
 *
 * Then insert into D1 with:
 *   wrangler d1 execute <DB_NAME> --remote --command="INSERT INTO supporter_keys (id, created_at) VALUES ('<key>', <ts>);"
 *
 * Or pipe the SQL output directly:
 *   node scripts/generate-supporter-keys.mjs 5 --sql | wrangler d1 execute <DB_NAME> --remote --file=-
 */

import { randomUUID } from 'node:crypto'

const args = process.argv.slice(2)
const sqlOnly = args.includes('--sql')
const countArg = args.find((a) => !a.startsWith('-'))
const count = Math.max(1, Math.min(100, parseInt(countArg ?? '5', 10) || 5))
const now = Date.now()
const keys = Array.from({ length: count }, () => randomUUID())

if (sqlOnly) {
  for (const key of keys) {
    process.stdout.write(`INSERT INTO supporter_keys (id, created_at) VALUES ('${key}', ${now});\n`)
  }
} else {
  console.log(`Generated ${count} supporter key${count > 1 ? 's' : ''} — ${new Date(now).toISOString()}\n`)
  console.log('--- SQL (paste into wrangler d1 execute) ---')
  for (const key of keys) {
    console.log(`INSERT INTO supporter_keys (id, created_at) VALUES ('${key}', ${now});`)
  }
  console.log('\n--- Keys to distribute (one per DM) ---')
  keys.forEach((k, i) => console.log(`${String(i + 1).padStart(2, ' ')}. ${k}`))
}
