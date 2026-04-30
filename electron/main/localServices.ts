import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { getManagedPanelCleanerVenvDir } from './panelCleanerDependency'

export type LocalServiceName = 'panelcleaner' | 'ollama'

export interface NativeServiceActionResult {
  ok: boolean
  error?: string
}

export interface ManagedServiceStatus {
  running: boolean
  ownedByApp: boolean
  inFlightCount: number
  idleTimeoutMs: number | null
  idleDeadlineAt: number | null
  command: string | null
  lastError: string | null
}

export interface ManagedLocalServicesStatus {
  panelcleaner: ManagedServiceStatus
  ollama: ManagedServiceStatus
}

interface ManagedServiceState extends ManagedServiceStatus {
  pid: number | null
  lastActivityAt: number | null
  startError: string | null
  child: ChildProcess | null
  idleTimer: ReturnType<typeof setTimeout> | null
  startPromise: Promise<NativeServiceActionResult> | null
  stopping: boolean
}

interface ChildProcessLike {
  pid?: number
  exitCode: number | null
  once(event: 'error', listener: (error: unknown) => void): this
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this
  unref(): void
}

interface LocalServiceManagerDeps {
  now(): number
  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout>
  clearTimeout(timer: ReturnType<typeof setTimeout>): void
  sleep(ms: number): Promise<void>
  isServiceReady(url: string): Promise<boolean>
  spawnService(name: LocalServiceName): ChildProcessLike
  killService(name: LocalServiceName, pid: number): Promise<void>
}

interface LocalServiceConfig {
  healthUrl: string
  idleTimeoutMs: number
}

interface StopOptions {
  allowBusy?: boolean
}

const PANELCLEANER_HEALTH_URL = 'http://127.0.0.1:5055/health'
const OLLAMA_VERSION_URL = 'http://127.0.0.1:11434/api/version'
const PANELCLEANER_IDLE_TIMEOUT_MS = 5 * 60_000
const OLLAMA_IDLE_TIMEOUT_MS = 15 * 60_000
const SERVICE_READY_TIMEOUT_MS = 10_000
const SERVICE_POLL_INTERVAL_MS = 300

const SERVICE_CONFIGS: Record<LocalServiceName, LocalServiceConfig> = {
  panelcleaner: {
    healthUrl: PANELCLEANER_HEALTH_URL,
    idleTimeoutMs: PANELCLEANER_IDLE_TIMEOUT_MS,
  },
  ollama: {
    healthUrl: OLLAMA_VERSION_URL,
    idleTimeoutMs: OLLAMA_IDLE_TIMEOUT_MS,
  },
}

function createInitialState(name: LocalServiceName): ManagedServiceState {
  return {
    running: false,
    ownedByApp: false,
    inFlightCount: 0,
    idleTimeoutMs: SERVICE_CONFIGS[name].idleTimeoutMs,
    idleDeadlineAt: null,
    command: resolveServiceCommand(name),
    lastError: null,
    pid: null,
    lastActivityAt: null,
    startError: null,
    child: null,
    idleTimer: null,
    startPromise: null,
    stopping: false,
  }
}

export function createLocalServiceManager(deps: LocalServiceManagerDeps) {
  const states: Record<LocalServiceName, ManagedServiceState> = {
    panelcleaner: createInitialState('panelcleaner'),
    ollama: createInitialState('ollama'),
  }

  function clearIdleTimer(name: LocalServiceName): void {
    const state = states[name]
    if (state.idleTimer) {
      deps.clearTimeout(state.idleTimer)
      state.idleTimer = null
    }
    state.idleDeadlineAt = null
  }

  function resetState(name: LocalServiceName): void {
    const state = states[name]
    clearIdleTimer(name)
    state.running = false
    state.ownedByApp = false
    state.inFlightCount = 0
    state.pid = null
    state.lastActivityAt = null
    state.child = null
    state.startPromise = null
    state.stopping = false
  }

  function markExternal(name: LocalServiceName): void {
    const state = states[name]
    clearIdleTimer(name)
    state.running = true
    state.ownedByApp = false
    state.lastError = null
    state.startError = null
    state.pid = null
    state.child = null
    state.stopping = false
  }

  function armIdleTimer(name: LocalServiceName): void {
    const state = states[name]
    clearIdleTimer(name)
    if (!state.running || !state.ownedByApp || state.inFlightCount > 0) return

    const timeoutMs = SERVICE_CONFIGS[name].idleTimeoutMs
    state.idleDeadlineAt = deps.now() + timeoutMs
    state.idleTimer = deps.setTimeout(() => {
      void stopOwnedService(name, { allowBusy: false })
    }, timeoutMs)
  }

  function watchChildProcess(name: LocalServiceName, child: ChildProcessLike): void {
    child.once('error', (error) => {
      const state = states[name]
      if (state.child !== child) return
      state.startError = error instanceof Error ? error.message : String(error)
      state.lastError = state.startError
      resetState(name)
    })
    child.once('exit', (code, signal) => {
      const state = states[name]
      if (state.child !== child) return
      if (!state.stopping && (code !== 0 || signal)) {
        state.startError = `exited with code ${code}${signal ? ` (${signal})` : ''}`
        state.lastError = state.startError
      }
      resetState(name)
    })
    child.unref()
  }

  async function waitForServiceReady(name: LocalServiceName, timeoutMs: number): Promise<boolean> {
    const startedAt = deps.now()
    while (deps.now() - startedAt < timeoutMs) {
      if (await deps.isServiceReady(SERVICE_CONFIGS[name].healthUrl)) return true
      await deps.sleep(SERVICE_POLL_INTERVAL_MS)
    }
    return false
  }

  function canReuseOwnedChild(name: LocalServiceName): boolean {
    const state = states[name]
    return Boolean(state.ownedByApp && state.child && state.child.exitCode == null)
  }

  async function startOwnedService(name: LocalServiceName): Promise<NativeServiceActionResult> {
    const state = states[name]
    if (state.startPromise) return state.startPromise

    state.startPromise = (async () => {
      if (await deps.isServiceReady(SERVICE_CONFIGS[name].healthUrl)) {
        markExternal(name)
        return { ok: true }
      }

      if (!canReuseOwnedChild(name)) {
        state.startError = null
        const child = deps.spawnService(name)
        state.child = child as ChildProcess
        state.pid = typeof child.pid === 'number' ? child.pid : null
        state.running = true
        state.ownedByApp = true
        state.stopping = false
        clearIdleTimer(name)
        watchChildProcess(name, child)
      }

      if (await waitForServiceReady(name, SERVICE_READY_TIMEOUT_MS)) {
        state.running = true
        state.ownedByApp = true
        state.lastError = null
        state.startError = null
        armIdleTimer(name)
        return { ok: true }
      }

      return {
        ok: false,
        error: state.startError
          ? `${name === 'ollama' ? 'Ollama' : 'PanelCleaner bridge'} failed to start: ${state.startError}`
          : name === 'ollama'
            ? 'Ollama did not become ready on http://127.0.0.1:11434. Open Ollama manually or run `ollama serve` in PowerShell.'
            : 'PanelCleaner bridge did not become ready on http://127.0.0.1:5055. Check that Node can run scripts/panelcleaner-bridge.mjs and port 5055 is available.',
      }
    })()

    try {
      return await state.startPromise
    } finally {
      state.startPromise = null
    }
  }

  async function refreshState(name: LocalServiceName): Promise<ManagedServiceStatus> {
    const state = states[name]
    if (state.ownedByApp && state.child && state.child.exitCode == null) {
      state.running = true
      return publicStatus(name)
    }

    if (await deps.isServiceReady(SERVICE_CONFIGS[name].healthUrl)) {
      markExternal(name)
      return publicStatus(name)
    }

    resetState(name)
    return publicStatus(name)
  }

  function publicStatus(name: LocalServiceName): ManagedServiceStatus {
    const state = states[name]
    return {
      running: state.running,
      ownedByApp: state.ownedByApp,
      inFlightCount: state.inFlightCount,
      idleTimeoutMs: state.idleTimeoutMs,
      idleDeadlineAt: state.idleDeadlineAt,
      command: state.command,
      lastError: state.startError ?? state.lastError,
    }
  }

  async function stopOwnedService(name: LocalServiceName, options: StopOptions = {}): Promise<NativeServiceActionResult> {
    const state = states[name]
    if (!state.ownedByApp) return { ok: true }
    if (state.inFlightCount > 0 && !options.allowBusy) {
      return {
        ok: false,
        error: `${name === 'ollama' ? 'Ollama' : 'PanelCleaner'} ยังมีงานกำลังทำอยู่`,
      }
    }

    clearIdleTimer(name)
    state.stopping = true

    if (state.pid != null) {
      try {
        await deps.killService(name, state.pid)
      } catch (error) {
        state.stopping = false
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }

    resetState(name)
    return { ok: true }
  }

  return {
    async start(name: LocalServiceName): Promise<NativeServiceActionResult> {
      const state = states[name]
      state.lastActivityAt = deps.now()

      if (canReuseOwnedChild(name)) {
        state.running = true
        armIdleTimer(name)
        return { ok: true }
      }

      if (await deps.isServiceReady(SERVICE_CONFIGS[name].healthUrl)) {
        markExternal(name)
        return { ok: true }
      }

      return startOwnedService(name)
    },

    beginUsage(name: LocalServiceName): void {
      const state = states[name]
      state.lastActivityAt = deps.now()
      state.inFlightCount += 1
      clearIdleTimer(name)
    },

    endUsage(name: LocalServiceName): void {
      const state = states[name]
      state.lastActivityAt = deps.now()
      state.inFlightCount = Math.max(0, state.inFlightCount - 1)
      if (state.inFlightCount === 0) armIdleTimer(name)
    },

    async getManagedStatus(): Promise<ManagedLocalServicesStatus> {
      return {
        panelcleaner: await refreshState('panelcleaner'),
        ollama: await refreshState('ollama'),
      }
    },

    async stopOwnedServices(options: StopOptions = {}): Promise<NativeServiceActionResult> {
      const ownedBusy = (Object.keys(states) as LocalServiceName[]).find((name) =>
        states[name].ownedByApp && states[name].inFlightCount > 0,
      )
      if (ownedBusy && !options.allowBusy) {
        return {
          ok: false,
          error: `${ownedBusy === 'ollama' ? 'Ollama' : 'PanelCleaner'} ยังมีงานกำลังทำอยู่`,
        }
      }

      for (const name of Object.keys(states) as LocalServiceName[]) {
        const result = await stopOwnedService(name, options)
        if (!result.ok) return result
      }
      return { ok: true }
    },
  }
}

const localServiceManager = createLocalServiceManager({
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (timer) => clearTimeout(timer),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  isServiceReady,
  spawnService: (name) => name === 'ollama' ? spawnOllamaProcess() : spawnPanelCleanerBridgeProcess(),
  killService: stopServiceProcess,
})

export function startPanelCleanerBridge(): Promise<NativeServiceActionResult> {
  return localServiceManager.start('panelcleaner')
}

export function startOllama(): Promise<NativeServiceActionResult> {
  return localServiceManager.start('ollama')
}

export function beginUsage(name: LocalServiceName): void {
  localServiceManager.beginUsage(name)
}

export function endUsage(name: LocalServiceName): void {
  localServiceManager.endUsage(name)
}

export function getManagedStatus(): Promise<ManagedLocalServicesStatus> {
  return localServiceManager.getManagedStatus()
}

export function stopOwnedServices(): Promise<NativeServiceActionResult> {
  return localServiceManager.stopOwnedServices()
}

export function shutdownOwnedServices(): Promise<NativeServiceActionResult> {
  return localServiceManager.stopOwnedServices({ allowBusy: true })
}

function spawnPanelCleanerBridgeProcess(): ChildProcess {
  const projectRoot = resolveProjectRoot()
  const scriptPath = path.join(projectRoot, 'scripts', 'panelcleaner-bridge.mjs')
  if (!existsSync(scriptPath)) {
    throw new Error(`PanelCleaner bridge script not found: ${scriptPath}`)
  }

  return spawn(process.platform === 'win32' ? 'node.exe' : 'node', [scriptPath], {
    cwd: projectRoot,
    detached: true,
    env: {
      ...process.env,
      PANELCLEANER_ALLOWED_ORIGIN: process.env.PANELCLEANER_ALLOWED_ORIGIN || 'http://localhost:5173',
      PANELCLEANER_MANAGED_VENV_DIR: getManagedPanelCleanerVenvDir(),
    },
    stdio: 'ignore',
    windowsHide: true,
  })
}

function spawnOllamaProcess(): ChildProcess {
  const ollamaCommand = resolveOllamaCommand()
  if (!ollamaCommand) {
    throw new Error('Ollama executable not found in PATH or the default Windows install paths. Install Ollama or add ollama.exe to PATH.')
  }

  return spawn(ollamaCommand, ['serve'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
}

async function stopServiceProcess(name: LocalServiceName, pid: number): Promise<void> {
  if (process.platform === 'win32') {
    await runProcess(process.env.COMSPEC || 'cmd.exe', ['/d', '/s', '/c', 'taskkill', '/pid', String(pid), '/t', '/f'])
    return
  }

  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    process.kill(pid, 'SIGTERM')
  }

  await new Promise((resolve) => setTimeout(resolve, 250))

  try {
    process.kill(-pid, 0)
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 0)
      process.kill(pid, 'SIGKILL')
    } catch {
      return
    }
  }

  if (name === 'panelcleaner' || name === 'ollama') return
}

function runProcess(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0 || code === 128 || code === 255) {
        resolve()
        return
      }
      reject(new Error(`Command failed with code ${code}: ${command} ${args.join(' ')}`))
    })
  })
}

function resolveProjectRoot(): string {
  return process.cwd()
}

function resolveOllamaCommand(): string | null {
  const candidates = [
    process.platform === 'win32' ? 'ollama.exe' : 'ollama',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe') : null,
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
  ].filter(Boolean) as string[]

  const installedPath = candidates.find((candidate) => path.isAbsolute(candidate) && existsSync(candidate))
  return installedPath ?? candidates[0] ?? null
}

function resolveServiceCommand(name: LocalServiceName): string | null {
  if (name === 'ollama') {
    return resolveOllamaCommand()
  }
  return null
}

async function isServiceReady(url: string): Promise<boolean> {
  try {
    const statusCode = await requestStatus(url, 1000)
    return statusCode >= 200 && statusCode < 500
  } catch {
    return false
  }
}

function requestStatus(url: string, timeoutMs: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume()
      response.on('end', () => resolve(response.statusCode ?? 0))
    })
    request.on('timeout', () => {
      request.destroy(new Error('Request timed out'))
    })
    request.on('error', reject)
  })
}
