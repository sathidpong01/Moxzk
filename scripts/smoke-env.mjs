import fs from 'node:fs'
import path from 'node:path'

export function loadSmokeEnv(env = process.env, filePath = path.resolve('.env.local')) {
  const fileEnv = fs.existsSync(filePath) ? parseEnvFile(fs.readFileSync(filePath, 'utf8')) : {}
  return {
    ...fileEnv,
    ...env,
  }
}

export function parseEnvFile(content) {
  const result = {}
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    result[match[1]] = unquote(match[2].trim())
  }
  return result
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}
