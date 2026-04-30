import { app } from 'electron'
import path from 'node:path'

const DRAFT_DIR = 'current-project-draft'
const SECURE_SECRETS_FILE = 'secure-secrets.json'

export function getUserDataDir(): string {
  return app.getPath('userData')
}

export function getLogsDir(): string {
  return app.getPath('logs')
}

export function getDraftDir(): string {
  return path.join(getUserDataDir(), DRAFT_DIR)
}

export function getSecureSecretsPath(): string {
  return path.join(getUserDataDir(), SECURE_SECRETS_FILE)
}
