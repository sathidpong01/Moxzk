import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const projectRoot = resolve('.')
const electronBinary = resolve(projectRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
const electronViteCli = resolve(projectRoot, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
const isDryRun = process.argv.includes('--dry-run')
const electronViteArgs = process.argv.slice(2).filter((arg) => arg !== '--dry-run')

if (process.platform === 'win32') {
  await stopProjectElectronProcesses()
}

if (isDryRun) {
  assertElectronViteCliExists()
  console.log(`[electron-dev] using ${electronViteCli}`)
  console.log('[electron-dev] dry run complete')
  process.exit(0)
}

assertElectronViteCliExists()

const child = spawn(process.execPath, [electronViteCli, ...(electronViteArgs.length > 0 ? electronViteArgs : ['dev'])], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
})

let stopping = false

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stopChild(signal))
}

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

child.on('error', (error) => {
  console.error(`[electron-dev] failed to start electron-vite: ${error.message}`)
  process.exit(1)
})

function stopChild(signal) {
  if (stopping) return
  stopping = true
  if (!child.killed) child.kill()
  const exitCode = signal === 'SIGINT' ? 130 : 143
  setTimeout(() => process.exit(exitCode), 500).unref()
}

function assertElectronViteCliExists() {
  if (!existsSync(electronViteCli)) {
    throw new Error(`electron-vite CLI not found at ${electronViteCli}. Run npm install first.`)
  }
}

async function stopProjectElectronProcesses() {
  const script = `
$electronPath = ${toPowerShellString(electronBinary)}
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'electron.exe' -and $_.ExecutablePath -eq $electronPath } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
`
  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script])
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const childProcess = spawn(command, args, { stdio: 'ignore' })
    childProcess.on('error', rejectRun)
    childProcess.on('exit', (code) => {
      if (code === 0) resolveRun()
      else rejectRun(new Error(`${command} exited with code ${code}`))
    })
  })
}

function toPowerShellString(value) {
  return `'${value.replace(/'/g, "''")}'`
}
