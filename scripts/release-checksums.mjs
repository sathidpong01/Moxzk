import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

// electron-builder writes Squirrel.Windows artifacts into a `squirrel-windows`
// subfolder of the configured output directory.
const outputDir = path.resolve('output/electron/squirrel-windows')
const checksumFile = path.join(outputDir, 'SHA256SUMS.txt')
// Squirrel.Windows artifacts: the Setup .exe, the .nupkg packages, and the
// extension-less RELEASES manifest.
const extensions = new Set(['.exe', '.nupkg'])

async function main() {
  const entries = await fs.readdir(outputDir, { withFileTypes: true })
  const files = entries
    .filter((entry) => (
      entry.isFile()
      && entry.name !== 'builder-debug.yml'
      && (entry.name === 'RELEASES' || extensions.has(path.extname(entry.name).toLowerCase()))
    ))
    .map((entry) => path.join(outputDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))

  if (files.length === 0) {
    throw new Error(`No release artifacts found in ${outputDir}. Run npm run release:build first.`)
  }

  const lines = []
  for (const file of files) {
    const hash = createHash('sha256')
    hash.update(await fs.readFile(file))
    lines.push(`${hash.digest('hex')}  ${path.basename(file)}`)
  }

  await fs.writeFile(checksumFile, `${lines.join('\n')}\n`, 'utf8')
  console.log(`Wrote ${path.relative(process.cwd(), checksumFile)} (${lines.length} artifacts)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
