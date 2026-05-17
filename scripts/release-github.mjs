// Publishes the already-built Windows installer to a GitHub release.
//
// Runs after `electron:package`, which builds the installer and regenerates
// `latest.yml` for the current package.json version. This script does NOT use
// electron-builder's publisher: it shells out to the `gh` CLI so it relies on
// gh's stored credentials instead of a GH_TOKEN env var (a misscoped GH_TOKEN
// is what broke a previous release). It also refuses to publish when the build
// artifacts do not match the current version, so a stale `latest.yml` can
// never be uploaded again.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Force gh to fall back to its stored (keyring) credentials. An inherited
// GH_TOKEN/GITHUB_TOKEN may be a fine-grained token without release scope.
delete process.env.GH_TOKEN
delete process.env.GITHUB_TOKEN

function fail(message) {
  console.error(`[release] ${message}`)
  process.exit(1)
}

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
const version = pkg.version
const tag = `v${version}`
const outDir = path.join(repoRoot, pkg.build?.directories?.output ?? 'output/electron')

const installer = `Moxzk-${version}-Windows-x64.exe`
const artifacts = [installer, `${installer}.blockmap`, 'latest.yml']
for (const name of artifacts) {
  if (!fs.existsSync(path.join(outDir, name))) {
    fail(`Missing build artifact: ${name}. Run "npm run electron:package" first.`)
  }
}

// Guard: latest.yml must describe this exact version, otherwise auto-update
// clients would be told the wrong version is current.
const latestYml = fs.readFileSync(path.join(outDir, 'latest.yml'), 'utf8')
const ymlVersion = latestYml.match(/^version:\s*(.+)$/m)?.[1]?.trim()
if (ymlVersion !== version) {
  fail(`latest.yml version "${ymlVersion}" does not match package.json "${version}". Rebuild with "npm run electron:package".`)
}

const gh = (args) => execFileSync('gh', args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()

let releaseExists = false
try {
  gh(['release', 'view', tag])
  releaseExists = true
} catch {
  releaseExists = false
}

const files = artifacts.map((name) => path.join(outDir, name))

if (releaseExists) {
  console.log(`[release] ${tag} already exists — replacing assets`)
  execFileSync('gh', ['release', 'upload', tag, ...files, '--clobber'], { cwd: repoRoot, stdio: 'inherit' })
} else {
  console.log(`[release] creating ${tag}`)
  execFileSync('gh', [
    'release', 'create', tag, ...files,
    '--title', `Moxzk ${tag}`,
    '--notes', `Moxzk ${tag} — Windows x64 NSIS installer. Unsigned indie build; SmartScreen may warn on first run.`,
  ], { cwd: repoRoot, stdio: 'inherit' })
}

console.log(`[release] done: ${tag}`)
console.log('[release] edit the release notes on GitHub if needed.')
