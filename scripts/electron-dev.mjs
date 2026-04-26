import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const projectRoot = resolve('.')
const electronBinary = resolve(projectRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron')
const isDryRun = process.argv.includes('--dry-run')

if (process.platform === 'win32') {
  await stopProjectElectronProcesses()
}

if (isDryRun) {
  console.log('[electron-dev] dry run complete')
  process.exit(0)
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const child = spawn(command, ['electron-vite', 'dev'], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal)
  })
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 0)
})

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
