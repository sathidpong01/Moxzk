// Publishes the already-built Squirrel.Windows artifacts to a GitHub release.
//
// Runs after `electron:package`, which builds the Squirrel installer plus the
// `RELEASES` manifest and `.nupkg` package(s). This script does NOT use
// electron-builder's publisher: it shells out to the `gh` CLI so it relies on
// gh's stored credentials instead of a GH_TOKEN env var (a misscoped GH_TOKEN
// is what broke a previous release).
//
// The hosted update server at update.electronjs.org reads `RELEASES` and the
// `.nupkg` files from the latest GitHub release, so every release MUST carry
// those assets or auto-update clients break. The Setup .exe is the manual
// download for new users.

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
// electron-builder writes Squirrel.Windows artifacts into a `squirrel-windows`
// subfolder of the configured output directory.
const outDir = path.join(repoRoot, pkg.build?.directories?.output ?? 'output/electron', 'squirrel-windows')

if (!fs.existsSync(outDir)) {
  fail(`Output directory ${outDir} does not exist. Run "npm run electron:package" first.`)
}

const dirEntries = fs.readdirSync(outDir)

// Only publish artifacts for the current version. Stale .nupkg/.exe files from
// earlier builds may linger in the output folder; uploading them would point
// auto-update clients at the wrong version.
const releasesManifest = dirEntries.find((name) => name === 'RELEASES')
const nupkgs = dirEntries.filter((name) => (
  name.toLowerCase().endsWith('.nupkg') && name.includes(version)
))
const setupExe = dirEntries.find((name) => (
  name.toLowerCase().endsWith('.exe') && name.includes(version)
))

if (!releasesManifest) fail('Missing RELEASES manifest. Run "npm run electron:package" first.')
if (nupkgs.length === 0) fail(`Missing .nupkg package for ${version}. Run "npm run electron:package" first.`)
if (!setupExe) fail(`Missing Setup .exe installer for ${version}. Run "npm run electron:package" first.`)

const fullNupkg = nupkgs.find((name) => name.toLowerCase().includes('-full.nupkg'))
if (!fullNupkg) fail(`Missing -full.nupkg package for ${version}. Run "npm run electron:package" first.`)

const artifacts = [releasesManifest, ...nupkgs, setupExe]
const files = artifacts.map((name) => path.join(outDir, name))

const gh = (args) => execFileSync('gh', args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()

let releaseExists = false
try {
  gh(['release', 'view', tag])
  releaseExists = true
} catch {
  releaseExists = false
}

if (releaseExists) {
  console.log(`[release] ${tag} already exists — replacing assets`)
  execFileSync('gh', ['release', 'upload', tag, ...files, '--clobber'], { cwd: repoRoot, stdio: 'inherit' })
} else {
  console.log(`[release] creating ${tag}`)
  execFileSync('gh', [
    'release', 'create', tag, ...files,
    '--title', `Moxzk ${tag}`,
    '--notes', `Moxzk ${tag} — Windows x64 Squirrel installer. Unsigned indie build; SmartScreen may warn on first run.`,
  ], { cwd: repoRoot, stdio: 'inherit' })
}

console.log(`[release] published assets: ${artifacts.join(', ')}`)
console.log(`[release] done: ${tag}`)
console.log('[release] edit the release notes on GitHub if needed.')
