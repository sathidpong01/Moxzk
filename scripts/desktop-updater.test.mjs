import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('Electron updater is wired through main process and typed runtime IPC', () => {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
  const channels = fs.readFileSync('electron/shared/ipcChannels.ts', 'utf8')
  const updater = fs.readFileSync('electron/main/updater.ts', 'utf8')
  const main = fs.readFileSync('electron/main/index.ts', 'utf8')
  const ipc = fs.readFileSync('electron/main/ipc.ts', 'utf8')
  const preload = fs.readFileSync('electron/preload/index.ts', 'utf8')
  const bridge = fs.readFileSync('src/runtime/electronBridge.ts', 'utf8')
  const contract = fs.readFileSync('src/runtime/types.ts', 'utf8')
  const electronRuntime = fs.readFileSync('src/runtime/electronRuntime.ts', 'utf8')

  assert.equal(Boolean(packageJson.dependencies?.['electron-squirrel-startup']), true)
  assert.equal(Boolean(packageJson.devDependencies?.['electron-builder']), true)
  assert.equal(Boolean(packageJson.devDependencies?.['electron-builder-squirrel-windows']), true)
  assert.equal(Boolean(packageJson.dependencies?.['electron-updater']), false)
  assert.equal(packageJson.scripts?.['release:build'], 'npm run electron:package')
  assert.equal(packageJson.scripts?.['release:checksums'], 'node scripts/release-checksums.mjs')
  assert.equal(packageJson.build?.publish?.[0]?.provider, 'github')
  assert.equal(packageJson.build?.publish?.[0]?.owner, 'sathidpong01')
  assert.equal(packageJson.build?.publish?.[0]?.repo, 'Moxzk')
  assert.equal(packageJson.build?.win?.target?.[0]?.target, 'squirrel')
  assert.equal(packageJson.build?.nsis, undefined)

  for (const channel of [
    'runtime:updates.getStatus',
    'runtime:updates.checkForUpdates',
    'runtime:updates.installDownloaded',
    'runtime:updates.openReleases',
    'runtime:updates.statusChanged',
  ]) {
    assert.match(channels, new RegExp(channel.replace('.', '\\.')))
  }

  assert.match(updater, /autoUpdater/)
  assert.match(updater, /update\.electronjs\.org/)
  assert.match(updater, /setFeedURL/)
  assert.match(updater, /shutdownOwnedServices/)
  assert.match(updater, /quitAndInstall\(\)/)
  assert.doesNotMatch(updater, /electron-updater/)
  assert.match(main, /scheduleUpdateChecks/)
  assert.match(main, /isUpdateQuitInProgress/)
  assert.match(main, /electron-squirrel-startup/)
  assert.match(main, /applySquirrelFileAssociations/)
  assert.match(ipc, /updatesCheckForUpdates/)
  assert.match(ipc, /updatesInstallDownloaded/)
  assert.match(preload, /updates:/)
  assert.match(preload, /updatesStatusChanged/)
  assert.match(preload, /removeListener/)
  assert.match(bridge, /NativeUpdateStatus/)
  assert.match(contract, /RuntimeUpdateStatus/)
  assert.match(electronRuntime, /bridge\.updates\.checkForUpdates/)
  assert.match(electronRuntime, /bridge\.updates\.installDownloadedUpdate/)
})

test('Updater UI and docs use user-facing release language', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const prompt = fs.readFileSync('src/components/Layout/UpdateRestartPrompt.tsx', 'utf8')
  const settings = fs.readFileSync('src/components/Settings/SettingsPanel.tsx', 'utf8')
  const css = fs.readFileSync('src/index.css', 'utf8')
  const docs = fs.readFileSync('docs/electron/release-and-updates.md', 'utf8')
  const readme = fs.readFileSync('README.md', 'utf8')
  const checksums = fs.readFileSync('scripts/release-checksums.mjs', 'utf8')

  assert.match(app, /UpdateRestartPrompt/)
  assert.match(prompt, /มี Moxzk เวอร์ชันใหม่/)
  assert.match(prompt, /ดาวน์โหลดเสร็จแล้ว/)
  assert.match(prompt, /รีสตาร์ท/)
  assert.match(prompt, /busy/)
  assert.match(settings, /อัปเดตโปรแกรม/)
  assert.match(settings, /ตรวจอัปเดต/)
  assert.match(settings, /รีสตาร์ทเพื่อติดตั้ง/)
  assert.match(settings, /SmartScreen/)
  assert.match(settings, /GitHub Releases/)
  assert.match(css, /moxzk-update-prompt/)
  assert.match(css, /settings-update-progress/)
  assert.match(docs, /GitHub Releases/)
  assert.match(docs, /SHA256/)
  assert.match(docs, /release:checksums/)
  assert.match(docs, /SmartScreen/)
  assert.match(docs, /unsigned indie Windows app/)
  assert.match(readme, /release:publish/)
  assert.match(checksums, /createHash\('sha256'\)/)
  assert.match(checksums, /SHA256SUMS\.txt/)
  assert.match(readme, /Release And Updates/)
})
