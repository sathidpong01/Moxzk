import { safeStorage } from 'electron'
import fs from 'node:fs/promises'
import { getSecureSecretsPath } from './appPaths'
import { createSecureStoreManager } from './secureStoreCore'

const secureStoreManager = createSecureStoreManager({
  crypto: {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    encryptString: (value: string) => safeStorage.encryptString(value),
    decryptString: (value: Buffer) => safeStorage.decryptString(value),
  },
  fileAccess: {
    mkdir: async (dirPath: string) => {
      await fs.mkdir(dirPath, { recursive: true })
    },
    readFile: (filePath: string) => fs.readFile(filePath, 'utf8'),
    writeFile: (filePath: string, contents: string) => fs.writeFile(filePath, contents, 'utf8'),
  },
  filePath: getSecureSecretsPath(),
})

export function getSecret(key: string): Promise<string | null> {
  return secureStoreManager.getSecret(key)
}

export async function setSecret(key: string, value: string): Promise<{ ok: true }> {
  await secureStoreManager.setSecret(key, value)
  return { ok: true }
}

export async function deleteSecret(key: string): Promise<{ ok: true }> {
  await secureStoreManager.deleteSecret(key)
  return { ok: true }
}
