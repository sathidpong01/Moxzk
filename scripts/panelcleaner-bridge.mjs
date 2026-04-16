import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'

const PORT = Number(process.env.PANELCLEANER_BRIDGE_PORT || 5055)
const MAX_BODY_BYTES = Number(process.env.PANELCLEANER_MAX_BODY_BYTES || 80 * 1024 * 1024)
const KEEP_TEMP = process.env.PANELCLEANER_KEEP_TEMP === '1'
const LOCAL_VENV_PCLEANER = resolve(process.cwd(), '.venv-panelcleaner', 'Scripts', 'pcleaner-cli.exe')
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.PANELCLEANER_ALLOWED_ORIGIN,
].filter(Boolean))

const IMAGE_EXT_BY_MIME = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
  ['image/tiff', '.tiff'],
])

const server = createServer(async (req, res) => {
  try {
    if (!isAllowedOrigin(req)) {
      sendJson(res, 403, { error: 'Origin is not allowed' }, req)
      return
    }

    if (req.method === 'OPTIONS') {
      writeCorsHeaders(res, req)
      res.writeHead(204).end()
      return
    }

    if (req.method === 'GET' && req.url === '/health') {
      const status = await getPanelCleanerStatus()
      sendJson(res, status.ok ? 200 : 503, status, req)
      return
    }

    if (req.method === 'POST' && req.url === '/panelcleaner/status') {
      const payload = await readJsonBody(req)
      const status = await getPanelCleanerStatus(payload?.executablePath)
      sendJson(res, status.ok ? 200 : 503, status, req)
      return
    }

    if (req.method === 'POST' && req.url === '/panelcleaner/process') {
      const payload = await readJsonBody(req)
      const result = await processImage(payload)
      sendJson(res, 200, result, req)
      return
    }

    if (req.method === 'POST' && req.url === '/panelcleaner/batch') {
      const payload = await readJsonBody(req)
      const result = await processImageBatch(payload)
      sendJson(res, 200, result, req)
      return
    }

    sendJson(res, 404, { error: 'Not found' }, req)
  } catch (err) {
    sendJson(res, 500, { error: toSafeErrorMessage(err) }, req)
  }
})

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.log(`[panelcleaner-bridge] http://127.0.0.1:${PORT} is already in use. Reuse the existing bridge or stop that process before starting another one.`)
    process.exit(0)
  }
  throw err
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[panelcleaner-bridge] listening on http://127.0.0.1:${PORT}`)
})

async function processImage(payload) {
  validatePayload(payload)

  const tempRoot = await mkdtemp(join(tmpdir(), 'mg-panelcleaner-'))
  const inputDir = join(tempRoot, 'input')
  const outputDir = join(tempRoot, 'output')
  await mkdir(inputDir)
  await mkdir(outputDir)

  try {
    const ext = getImageExtension(payload.image)
    const inputPath = join(inputDir, `input${ext}`)
    const imageBuffer = Buffer.from(payload.image.base64, 'base64')
    await writeFile(inputPath, imageBuffer)

    const executable = sanitizeExecutablePath(payload.executablePath)
    const cleanRun = await runPanelCleaner(executable, [
      'clean',
      inputPath,
      `--output_dir=${outputDir}`,
      '--save-only-cleaned',
      '--hide-analytics',
    ])

    const cleanedImagePath = await findFirstImage(outputDir)
    if (!cleanedImagePath) {
      throw new Error('PanelCleaner finished but no cleaned image was produced')
    }

    const cleanedImageBuffer = await readFile(cleanedImagePath)
    let ocrCsv = ''
    let ocrRun = { stdout: '', stderr: '', command: cleanRun.command }

    if (payload.runOcr) {
      const ocrPath = join(tempRoot, 'ocr.csv')
      ocrRun = await runPanelCleaner(executable, [
        'ocr',
        inputPath,
        `--output-path=${ocrPath}`,
        '--csv',
      ])
      ocrCsv = await readFile(ocrPath, 'utf8').catch(() => '')
    }

    return {
      cleanedImageBase64: cleanedImageBuffer.toString('base64'),
      cleanedImageMimeType: mimeFromExtension(extname(cleanedImagePath)),
      ocrCsv,
      logs: compactLogs(cleanRun, ocrRun),
    }
  } finally {
    if (!KEEP_TEMP) {
      await rm(tempRoot, { recursive: true, force: true })
    }
  }
}

async function processImageBatch(payload) {
  validateBatchPayload(payload)

  const tempRoot = await mkdtemp(join(tmpdir(), 'mg-panelcleaner-batch-'))
  const inputDir = join(tempRoot, 'input')
  const outputDir = join(tempRoot, 'output')
  await mkdir(inputDir)
  await mkdir(outputDir)

  try {
    const inputFiles = []
    for (let i = 0; i < payload.images.length; i += 1) {
      const item = payload.images[i]
      const ext = getImageExtension(item.image)
      const stableName = sanitizeStableName(item.id || `page-${String(i + 1).padStart(3, '0')}`)
      const inputPath = join(inputDir, `${stableName}${ext}`)
      await writeFile(inputPath, Buffer.from(item.image.base64, 'base64'))
      inputFiles.push({ id: item.id, stableName, inputPath })
    }

    const executable = sanitizeExecutablePath(payload.executablePath)
    const cleanRun = await runPanelCleaner(executable, [
      'clean',
      ...inputFiles.map((file) => file.inputPath),
      `--output_dir=${outputDir}`,
      '--save-only-cleaned',
      '--hide-analytics',
    ])

    const outputImages = await findImages(outputDir)
    const unusedOutputs = [...outputImages]
    const results = []

    for (const file of inputFiles) {
      const outputPath = findOutputForStableName(outputImages, unusedOutputs, file.stableName)
      if (!outputPath) {
        results.push({
          id: file.id,
          error: 'PanelCleaner finished but no cleaned image was produced for this page',
          logs: compactLogs(cleanRun),
        })
        continue
      }

      const cleanedImageBuffer = await readFile(outputPath)
      results.push({
        id: file.id,
        cleanedImageBase64: cleanedImageBuffer.toString('base64'),
        cleanedImageMimeType: mimeFromExtension(extname(outputPath)),
        logs: compactLogs(cleanRun),
      })
    }

    return { results }
  } finally {
    if (!KEEP_TEMP) {
      await rm(tempRoot, { recursive: true, force: true })
    }
  }
}

async function getPanelCleanerStatus(executablePath) {
  try {
    if (executablePath != null && typeof executablePath !== 'string') throw new Error('Invalid executable path')
    const run = await runPanelCleaner(sanitizeExecutablePath(executablePath), ['--version'])
    return { ok: true, version: (run.stdout || run.stderr).trim(), command: run.command }
  } catch (err) {
    return { ok: false, error: toSafeErrorMessage(err), installHint: 'pip install pcleaner-cli' }
  }
}

async function runPanelCleaner(executablePath, args) {
  const candidates = executablePath
    ? [{ command: executablePath, argsPrefix: [] }]
    : [
        { command: LOCAL_VENV_PCLEANER, argsPrefix: [] },
        { command: 'pcleaner', argsPrefix: [] },
        { command: 'pcleaner-cli', argsPrefix: [] },
        { command: 'python', argsPrefix: ['-m', 'pcleaner'] },
        { command: 'py', argsPrefix: ['-m', 'pcleaner'] },
      ]

  const errors = []
  for (const candidate of candidates) {
    try {
      const result = await spawnCommand(candidate.command, [...candidate.argsPrefix, ...args])
      return { ...result, command: [candidate.command, ...candidate.argsPrefix].join(' ') }
    } catch (err) {
      errors.push(toSafeErrorMessage(err))
      if (executablePath) {
        throw err
      }
    }
  }

  throw new Error(`PanelCleaner executable not found. Install with "pip install pcleaner-cli" or set an executable path. ${errors.join(' | ')}`)
}

function spawnCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr })
      } else {
        reject(new Error(`PanelCleaner exited with code ${code}: ${(stderr || stdout).slice(0, 800)}`))
      }
    })
  })
}

async function readJsonBody(req) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > MAX_BODY_BYTES) throw new Error('Request body is too large')
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Request body must be valid JSON')
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid request payload')
  if (!payload.image || typeof payload.image !== 'object') throw new Error('Missing image payload')
  if (!IMAGE_EXT_BY_MIME.has(payload.image.mimeType)) throw new Error('Unsupported image type')
  if (typeof payload.image.base64 !== 'string' || payload.image.base64.length === 0) throw new Error('Missing image base64')
  if (!/^[a-z0-9+/=\s]+$/i.test(payload.image.base64)) throw new Error('Image base64 is invalid')
  if (payload.executablePath != null && typeof payload.executablePath !== 'string') throw new Error('Invalid executable path')
  if (payload.runOcr != null && typeof payload.runOcr !== 'boolean') throw new Error('Invalid runOcr flag')
}

function validateBatchPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid request payload')
  if (!Array.isArray(payload.images) || payload.images.length === 0) throw new Error('Missing images payload')
  if (payload.images.length > 100) throw new Error('Too many images in one batch')
  if (payload.executablePath != null && typeof payload.executablePath !== 'string') throw new Error('Invalid executable path')
  for (const item of payload.images) {
    if (!item || typeof item !== 'object') throw new Error('Invalid image item')
    if (typeof item.id !== 'string' || item.id.length === 0) throw new Error('Batch image id is required')
    validatePayload({ image: item.image, executablePath: payload.executablePath, runOcr: false })
  }
}

function sanitizeExecutablePath(value) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (/[\r\n\0]/.test(trimmed)) throw new Error('Invalid executable path')
  if (!/[\\/]/.test(trimmed)) return trimmed
  return resolve(trimmed)
}

function getImageExtension(image) {
  return IMAGE_EXT_BY_MIME.get(image.mimeType) ?? '.png'
}

async function findFirstImage(directory) {
  return (await findImages(directory))[0] ?? null
}

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      results.push(...await findImages(path))
    } else if (/\.(png|jpe?g|webp|bmp|tiff?)$/i.test(entry.name)) {
      results.push(path)
    }
  }
  return results.sort((a, b) => a.localeCompare(b))
}

function sanitizeStableName(value) {
  return value.replace(/[^a-z0-9_-]/gi, '-').slice(0, 80) || 'page'
}

function basenameWithoutExt(path) {
  const name = path.split(/[\\/]/).pop() ?? path
  return name.replace(/\.[^.]+$/, '')
}

function findOutputForStableName(outputImages, unusedOutputs, stableName) {
  const lower = stableName.toLowerCase()
  const exact = outputImages.find((path) => basenameWithoutExt(path).toLowerCase() === lower)
  const fuzzy = exact ?? outputImages.find((path) => basenameWithoutExt(path).toLowerCase().includes(lower))
  const outputPath = fuzzy ?? unusedOutputs[0]
  if (!outputPath) return null
  const usedIndex = unusedOutputs.indexOf(outputPath)
  if (usedIndex >= 0) unusedOutputs.splice(usedIndex, 1)
  return outputPath
}

function mimeFromExtension(extension) {
  switch (extension.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.bmp':
      return 'image/bmp'
    case '.tif':
    case '.tiff':
      return 'image/tiff'
    default:
      return 'image/png'
  }
}

function compactLogs(...runs) {
  return runs
    .flatMap((run) => [run.stdout, run.stderr])
    .filter(Boolean)
    .flatMap((text) => text.split(/\r?\n/))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-50)
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin
  return !origin || ALLOWED_ORIGINS.has(origin)
}

function writeCorsHeaders(res, req) {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')
}

function sendJson(res, statusCode, data, req) {
  writeCorsHeaders(res, req)
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function toSafeErrorMessage(err) {
  if (err instanceof Error) return err.message
  return String(err)
}
