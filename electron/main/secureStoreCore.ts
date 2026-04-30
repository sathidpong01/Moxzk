import path from 'node:path'

interface SecureStoreFileAccess {
  mkdir(dirPath: string): Promise<void>
  readFile(filePath: string): Promise<string>
  writeFile(filePath: string, contents: string): Promise<void>
}

interface SecureStoreCrypto {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface SecureStoreEnvelope {
  version: 1
  secrets: Record<string, string>
}

interface SecureStoreManagerDeps {
  crypto: SecureStoreCrypto
  fileAccess: SecureStoreFileAccess
  filePath: string
}

const EMPTY_ENVELOPE: SecureStoreEnvelope = {
  version: 1,
  secrets: {},
}

export function createSecureStoreManager(deps: SecureStoreManagerDeps) {
  async function getSecret(key: string): Promise<string | null> {
    assertEncryptionAvailable()
    const envelope = await readEnvelope()
    const cipherText = envelope.secrets[key]
    if (!cipherText) return null
    return deps.crypto.decryptString(Buffer.from(cipherText, 'base64'))
  }

  async function setSecret(key: string, value: string): Promise<void> {
    assertEncryptionAvailable()
    const envelope = await readEnvelope()
    envelope.secrets[key] = deps.crypto.encryptString(value).toString('base64')
    await writeEnvelope(envelope)
  }

  async function deleteSecret(key: string): Promise<void> {
    assertEncryptionAvailable()
    const envelope = await readEnvelope()
    if (!(key in envelope.secrets)) return
    delete envelope.secrets[key]
    await writeEnvelope(envelope)
  }

  async function readEnvelope(): Promise<SecureStoreEnvelope> {
    try {
      const raw = await deps.fileAccess.readFile(deps.filePath)
      const parsed = JSON.parse(raw) as Partial<SecureStoreEnvelope> | null
      if (!parsed || parsed.version !== 1 || typeof parsed.secrets !== 'object' || parsed.secrets === null) {
        return { ...EMPTY_ENVELOPE, secrets: {} }
      }
      return {
        version: 1,
        secrets: Object.fromEntries(
          Object.entries(parsed.secrets).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
        ),
      }
    } catch (error) {
      if (isMissingFileError(error)) return { ...EMPTY_ENVELOPE, secrets: {} }
      throw error
    }
  }

  async function writeEnvelope(envelope: SecureStoreEnvelope): Promise<void> {
    await deps.fileAccess.mkdir(path.dirname(deps.filePath))
    await deps.fileAccess.writeFile(deps.filePath, JSON.stringify(envelope, null, 2))
  }

  function assertEncryptionAvailable(): void {
    if (!deps.crypto.isEncryptionAvailable()) {
      throw new Error('Secure secret storage is unavailable because Electron safeStorage is not available on this machine.')
    }
  }

  return {
    getSecret,
    setSecret,
    deleteSecret,
  }
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}
