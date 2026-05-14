import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import * as electron from 'electron'
import type {
  NativePanelCleanerDependencyStatus,
  NativeServiceActionResult,
} from '../../src/runtime/electronBridge'

const { app } = electron

const PANELCLEANER_PACKAGE_NAME = 'pcleaner-cli'
const PANELCLEANER_PACKAGE_VERSION = '2.11.9'
const PANELCLEANER_PACKAGE_SPEC = 'pcleaner-cli==2.11.9'
const PANELCLEANER_VENV_DIR_NAME = 'panelcleaner-venv'
const PANELCLEANER_LICENSE_NAME = 'GPLv3'
const PANELCLEANER_PROJECT_URL = 'https://pypi.org/project/pcleaner-cli/'
const PYTHON_DOWNLOAD_URL = 'https://www.python.org/downloads/windows/'
const PYTHON_WINGET_PACKAGE_ID = 'Python.Python.3.12'
const PCLEANER_VERSION_SNIPPET = "from pcleaner import __version__; print('Panel Cleaner ' + __version__)"
const RUN_TIMEOUT_MS = 10 * 60_000

let installPromise: Promise<NativeServiceActionResult> | null = null
let pythonInstallPromise: Promise<NativeServiceActionResult> | null = null
let lastInstallLogs: string[] = []

interface PythonLauncher {
  command: string
  args: string[]
  label: string
}

interface RunResult {
  stdout: string
  stderr: string
}

export function getManagedPanelCleanerVenvDir(): string {
  return path.join(app.getPath('userData'), PANELCLEANER_VENV_DIR_NAME)
}

export function getManagedPanelCleanerPythonPath(): string {
  return path.join(
    getManagedPanelCleanerVenvDir(),
    process.platform === 'win32' ? 'Scripts' : 'bin',
    process.platform === 'win32' ? 'python.exe' : 'python',
  )
}

export async function getPanelCleanerDependencyStatus(): Promise<NativePanelCleanerDependencyStatus> {
  const python = await checkPythonDependency()

  if (installPromise) {
    return baseStatus({
      state: 'installing',
      installPath: getManagedPanelCleanerVenvDir(),
      actionHint: 'Moxzk is installing PanelCleaner in the managed virtual environment.',
      logs: lastInstallLogs,
      python,
    })
  }

  const pythonPath = getManagedPanelCleanerPythonPath()
  if (!existsSync(pythonPath)) {
    return baseStatus({
      state: 'missing',
      installPath: getManagedPanelCleanerVenvDir(),
      actionHint: 'กดติดตั้ง PanelCleaner เพื่อสร้าง managed venv ในโปรไฟล์ผู้ใช้ของ Moxzk',
      logs: lastInstallLogs,
      python,
    })
  }

  try {
    const version = await runProcess(pythonPath, ['-c', PCLEANER_VERSION_SNIPPET], {
      logAs: `${pythonPath} -c pcleaner.__version__`,
    })
    return baseStatus({
      state: 'ready',
      source: 'managed',
      version: (version.stdout || version.stderr).trim(),
      command: `${pythonPath} -c ${PCLEANER_VERSION_SNIPPET}`,
      installPath: getManagedPanelCleanerVenvDir(),
      logs: lastInstallLogs,
      python,
    })
  } catch (error) {
    return baseStatus({
      state: 'broken',
      installPath: getManagedPanelCleanerVenvDir(),
      error: toMessage(error),
      actionHint: 'กดซ่อม PanelCleaner เพื่อลบ managed venv เดิมแล้วติดตั้งใหม่',
      logs: lastInstallLogs,
      python,
    })
  }
}

export async function installPanelCleaner(): Promise<NativeServiceActionResult> {
  return runInstall(false)
}

export async function repairPanelCleaner(): Promise<NativeServiceActionResult> {
  return runInstall(true)
}

export async function installPython(): Promise<NativeServiceActionResult> {
  if (pythonInstallPromise) return pythonInstallPromise
  pythonInstallPromise = installPythonWithWinget()
  try {
    return await pythonInstallPromise
  } finally {
    pythonInstallPromise = null
  }
}

async function runInstall(repair: boolean): Promise<NativeServiceActionResult> {
  if (installPromise) return installPromise
  installPromise = installManagedPanelCleaner(repair)
  try {
    return await installPromise
  } finally {
    installPromise = null
  }
}

async function installManagedPanelCleaner(repair: boolean): Promise<NativeServiceActionResult> {
  lastInstallLogs = []
  const venvDir = getManagedPanelCleanerVenvDir()
  const managedPython = getManagedPanelCleanerPythonPath()

  try {
    logInstall(repair ? 'ซ่อม PanelCleaner: ลบ managed venv เดิม' : 'ติดตั้ง PanelCleaner: เตรียม managed venv')
    if (repair) {
      await rm(venvDir, { recursive: true, force: true })
    }
    await mkdir(path.dirname(venvDir), { recursive: true })

    const python = await findPythonLauncher()
    logInstall(`พบ Python: ${python.label}`)
    await runProcess(python.command, [...python.args, '-m', 'venv', venvDir], {
      logAs: `python -m venv ${venvDir}`,
      logs: lastInstallLogs,
    })

    await runProcess(managedPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
      logAs: 'python -m pip install --upgrade pip',
      logs: lastInstallLogs,
    })
    await runProcess(managedPython, ['-m', 'pip', 'install', PANELCLEANER_PACKAGE_SPEC], {
      logAs: `python -m pip install ${PANELCLEANER_PACKAGE_SPEC}`,
      logs: lastInstallLogs,
    })
    const version = await verifyManagedPanelCleaner(managedPython)
    logInstall(`PanelCleaner พร้อมใช้งาน: ${version || PANELCLEANER_PACKAGE_SPEC}`)
    return { ok: true, logs: lastInstallLogs }
  } catch (error) {
    const message = toMessage(error)
    logInstall(`ติดตั้ง PanelCleaner ไม่สำเร็จ: ${message}`)
    return { ok: false, error: message, logs: lastInstallLogs }
  }
}

async function installPythonWithWinget(): Promise<NativeServiceActionResult> {
  const logs: string[] = []
  try {
    if (process.platform !== 'win32') {
      return {
        ok: false,
        error: 'ติดตั้ง Python อัตโนมัติรองรับเฉพาะ Windows',
        logs,
      }
    }

    logs.push('ติดตั้ง Python: ตรวจ winget')
    await runProcess('winget.exe', ['--version'], {
      logAs: 'winget --version',
      logs,
      timeoutMs: 30_000,
    })

    logs.push(`ติดตั้ง Python: ${PYTHON_WINGET_PACKAGE_ID}`)
    await runProcess('winget.exe', [
      'install',
      '-e',
      '--id',
      PYTHON_WINGET_PACKAGE_ID,
      '--scope',
      'user',
      '--accept-package-agreements',
      '--accept-source-agreements',
      '--disable-interactivity',
    ], {
      logAs: `winget install ${PYTHON_WINGET_PACKAGE_ID}`,
      logs,
      timeoutMs: RUN_TIMEOUT_MS,
    })

    const python = await checkPythonDependency()
    if (python.state === 'ready') {
      logs.push(`Python พร้อมใช้งาน: ${python.version || python.command || 'ตรวจพบแล้ว'}`)
    } else {
      logs.push('ติดตั้งเสร็จแล้ว แต่ยังตรวจไม่พบในหน้าต่างนี้ ให้ปิดเปิด Moxzk ใหม่ แล้วกดตรวจอีกครั้ง')
    }
    return { ok: true, logs }
  } catch (error) {
    const message = toMessage(error)
    logs.push(`ติดตั้ง Python ไม่สำเร็จ: ${message}`)
    return { ok: false, error: message, logs }
  }
}

async function verifyManagedPanelCleaner(managedPython: string): Promise<string> {
  if (!existsSync(managedPython)) {
    throw new Error(`Managed Python was not created: ${managedPython}`)
  }
  const result = await runProcess(managedPython, ['-c', PCLEANER_VERSION_SNIPPET], {
    logAs: `${managedPython} -c pcleaner.__version__`,
    logs: lastInstallLogs,
    timeoutMs: 30_000,
  })
  return (result.stdout || result.stderr).trim()
}

async function findPythonLauncher(): Promise<PythonLauncher> {
  const errors: string[] = []
  for (const candidate of getPythonCandidates()) {
    try {
      await runProcess(candidate.command, [...candidate.args, '--version'], {
        logAs: `${candidate.label} --version`,
        timeoutMs: 15_000,
      })
      return candidate
    } catch (error) {
      errors.push(`${candidate.label}: ${toMessage(error)}`)
    }
  }
  throw new Error(`Python executable not found. Install Python 3 and enable PATH, then try again. ${errors.join(' | ')}`)
}

async function checkPythonDependency(): Promise<NativePanelCleanerDependencyStatus['python']> {
  const errors: string[] = []
  for (const candidate of getPythonCandidates()) {
    try {
      const result = await runProcess(candidate.command, [...candidate.args, '--version'], {
        logAs: `${candidate.label} --version`,
        timeoutMs: 15_000,
      })
      return {
        state: 'ready',
        version: (result.stdout || result.stderr).trim(),
        command: [candidate.command, ...candidate.args].join(' '),
        downloadUrl: PYTHON_DOWNLOAD_URL,
      }
    } catch (error) {
      errors.push(`${candidate.label}: ${toMessage(error)}`)
    }
  }

  return {
    state: 'missing',
    downloadUrl: PYTHON_DOWNLOAD_URL,
    error: errors.join(' | '),
    actionHint: 'ติดตั้ง Python 3 และเลือก Add python.exe to PATH แล้วกดตรวจอีกครั้ง',
  }
}

function getPythonCandidates(): PythonLauncher[] {
  return [
    ...(process.env.MOXZK_PYTHON ? [{ command: process.env.MOXZK_PYTHON, args: [], label: process.env.MOXZK_PYTHON }] : []),
    ...(process.platform === 'win32' ? [{ command: 'py.exe', args: ['-3'], label: 'py -3' }] : []),
    { command: process.platform === 'win32' ? 'python.exe' : 'python3', args: [], label: process.platform === 'win32' ? 'python' : 'python3' },
    { command: 'python', args: [], label: 'python' },
  ]
}

function baseStatus(
  status: Omit<NativePanelCleanerDependencyStatus, 'packageName' | 'packageVersion' | 'licenseName' | 'projectUrl'>,
): NativePanelCleanerDependencyStatus {
  return {
    packageName: PANELCLEANER_PACKAGE_NAME,
    packageVersion: PANELCLEANER_PACKAGE_VERSION,
    licenseName: PANELCLEANER_LICENSE_NAME,
    projectUrl: PANELCLEANER_PROJECT_URL,
    ...status,
  }
}

function logInstall(message: string): void {
  lastInstallLogs = [...lastInstallLogs, message].slice(-80)
}

function runProcess(
  command: string,
  args: string[],
  options: { logAs: string; logs?: string[]; timeoutMs?: number },
): Promise<RunResult> {
  const label = options.logAs
  options.logs?.push(`> ${label}`)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`${label} timed out`))
    }, options.timeoutMs ?? RUN_TIMEOUT_MS)

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      if (options.logs) streamChunkToLogs(chunk, options.logs)
    })
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
      if (options.logs) streamChunkToLogs(chunk, options.logs)
    })
    child.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      const summary = compactOutput(stdout, stderr)
      reject(new Error(`${label} failed with code ${code}: ${summary || 'no output'}`))
    })
  })
}

function streamChunkToLogs(chunk: string, logs: string[]): void {
  const lines = chunk.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    logs.push(line)
  }
  if (logs.length > 120) logs.splice(0, logs.length - 80)
}

function compactOutput(stdout: string, stderr: string): string {
  return [stdout, stderr]
    .join('\n')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-12)
    .join('\n')
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
