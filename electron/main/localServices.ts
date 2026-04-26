import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

export interface NativeServiceActionResult {
  ok: boolean
  error?: string
}

const PANELCLEANER_HEALTH_URL = 'http://127.0.0.1:5055/health'
const OLLAMA_VERSION_URL = 'http://127.0.0.1:11434/api/version'
const SERVICE_READY_TIMEOUT_MS = 10_000
const SERVICE_POLL_INTERVAL_MS = 300

let panelCleanerBridgeProcess: ChildProcess | null = null
let ollamaProcess: ChildProcess | null = null
let panelCleanerBridgeStartError: string | null = null
let ollamaStartError: string | null = null

export async function startPanelCleanerBridge(): Promise<NativeServiceActionResult> {
  if (await isServiceReady(PANELCLEANER_HEALTH_URL)) return { ok: true }

  const projectRoot = resolveProjectRoot()
  const scriptPath = path.join(projectRoot, 'scripts', 'panelcleaner-bridge.mjs')
  if (!existsSync(scriptPath)) {
    return { ok: false, error: `PanelCleaner bridge script not found: ${scriptPath}` }
  }

  if (!panelCleanerBridgeProcess || panelCleanerBridgeProcess.exitCode != null) {
    panelCleanerBridgeStartError = null
    panelCleanerBridgeProcess = spawn(
      process.platform === 'win32' ? 'node.exe' : 'node',
      [scriptPath],
      {
        cwd: projectRoot,
        detached: true,
        env: {
          ...process.env,
          PANELCLEANER_ALLOWED_ORIGIN: process.env.PANELCLEANER_ALLOWED_ORIGIN || 'http://localhost:5173',
        },
        stdio: 'ignore',
        windowsHide: true,
      },
    )
    watchDetachedProcess(panelCleanerBridgeProcess, (error) => {
      panelCleanerBridgeStartError = error
      panelCleanerBridgeProcess = null
    })
  }

  if (await waitForService(PANELCLEANER_HEALTH_URL, SERVICE_READY_TIMEOUT_MS)) return { ok: true }
  return {
    ok: false,
    error: panelCleanerBridgeStartError
      ? `PanelCleaner bridge failed to start: ${panelCleanerBridgeStartError}`
      : 'PanelCleaner bridge did not become ready on http://127.0.0.1:5055. Check that Node can run scripts/panelcleaner-bridge.mjs and port 5055 is available.',
  }
}

export async function startOllama(): Promise<NativeServiceActionResult> {
  if (await isServiceReady(OLLAMA_VERSION_URL)) return { ok: true }

  const ollamaCommand = resolveOllamaCommand()
  if (!ollamaCommand) {
    return {
      ok: false,
      error: 'Ollama executable not found in PATH or the default Windows install paths. Install Ollama or add ollama.exe to PATH.',
    }
  }

  if (!ollamaProcess || ollamaProcess.exitCode != null) {
    ollamaStartError = null
    ollamaProcess = spawn(ollamaCommand, ['serve'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    watchDetachedProcess(ollamaProcess, (error) => {
      ollamaStartError = error
      ollamaProcess = null
    })
  }

  if (await waitForService(OLLAMA_VERSION_URL, SERVICE_READY_TIMEOUT_MS)) return { ok: true }
  return {
    ok: false,
    error: ollamaStartError
      ? `Ollama failed to start: ${ollamaStartError}`
      : 'Ollama did not become ready on http://127.0.0.1:11434. Open Ollama manually or run `ollama serve` in PowerShell.',
  }
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

async function waitForService(url: string, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServiceReady(url)) return true
    await sleep(SERVICE_POLL_INTERVAL_MS)
  }
  return false
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

function watchDetachedProcess(child: ChildProcess, onError: (error: string) => void): void {
  child.once('error', (error) => {
    onError(error instanceof Error ? error.message : String(error))
  })
  child.once('exit', (code, signal) => {
    if ((code === 0 || code === null) && !signal) return
    onError(`exited with code ${code}${signal ? ` (${signal})` : ''}`)
  })
  child.unref()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
