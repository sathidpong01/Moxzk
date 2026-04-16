import type { AppSettings, BoundingBox, ImageEntry, ProcessingMode, TextRegion } from '../types'
import { processImageWithCleanupProvider } from './cleanup-provider'
import { processImagesWithPanelCleanerBatch } from './panelcleaner-api'
import {
  detectOcrWithOllamaVision,
  translateWithOllamaBoxedVision,
  translateWithOllamaVision,
  type OllamaOptions,
} from './ollama'
import { deriveTextBoxesFromCleanupDiff } from './cleanup-diff-bboxes'
import {
  appendTranslatedLines,
  collectPreviousTranslationLines,
  type TranslationStoryContext,
} from './story-context'

export interface BatchProcessOptions {
  entries: ImageEntry[]
  mode: ProcessingMode
  settings: AppSettings
  sourceLang: string
  ollamaOptions: OllamaOptions
  retryFailedOnly?: boolean
  shouldStop: () => boolean
  onEntryUpdate: (id: string, updates: Partial<ImageEntry>) => void
  onBatchProgress?: (state: BatchProgressState) => void
  onLog: (message: string) => void
}

export interface BatchProgressState {
  phase: 'queued' | 'cleaning' | 'clean_done' | 'translating' | 'stopping' | 'done' | 'error'
  currentIndex: number
  total: number
  currentPageNumber?: number
  progress: number
  message: string
}

interface CleanResult {
  entry: ImageEntry
  cleanedBlob: Blob
  cleanedUrl: string
}

const UI_STEP_DELAY_MS = 90

export async function runBatchAiQueue(options: BatchProcessOptions): Promise<void> {
  const candidates = options.entries.filter((entry) => {
    if (!entry.file) return false
    if (options.retryFailedOnly) return entry.status === 'error'
    return entry.status !== 'done'
  })

  if (candidates.length === 0) {
    options.onLog('Batch AI: ไม่มีหน้าที่ต้องประมวลผล')
    return
  }

  candidates.forEach((entry) => {
    options.onEntryUpdate(entry.id, {
      status: 'clean_queued',
      progress: 0,
      error: undefined,
    })
  })
  options.onBatchProgress?.({
    phase: 'queued',
    currentIndex: 0,
    total: candidates.length,
    progress: 0,
    message: `เตรียม ${candidates.length} หน้า`,
  })

  const cleaned = await cleanPages(candidates, options)

  if (options.mode === 'clean_only') {
    cleaned.forEach(({ entry, cleanedUrl }) => {
      options.onEntryUpdate(entry.id, {
        cleanedImageUrl: cleanedUrl,
        status: 'clean_done',
        progress: 100,
      })
    })
    options.onBatchProgress?.({
      phase: 'done',
      currentIndex: cleaned.length,
      total: candidates.length,
      progress: 100,
      message: 'คลีนเสร็จ',
    })
    return
  }

  const liveStoryLines: NonNullable<TranslationStoryContext['previousLines']> = []

  for (const [index, item] of cleaned.entries()) {
    if (options.shouldStop()) {
      options.onBatchProgress?.({
        phase: 'stopping',
        currentIndex: index,
        total: candidates.length,
        progress: Math.round((index / candidates.length) * 100),
        message: 'หยุดตามคำสั่ง',
      })
      options.onLog('Batch AI: หยุดหลังงานปัจจุบันตามคำสั่ง')
      break
    }

    const pageNumber = item.entry.pageNumber ?? index + 1
    options.onBatchProgress?.({
      phase: 'translating',
      currentIndex: index + 1,
      total: candidates.length,
      currentPageNumber: pageNumber,
      progress: Math.round(((index + 0.55) / candidates.length) * 100),
      message: `กำลังแปลหน้า ${pageNumber}`,
    })

    options.onEntryUpdate(item.entry.id, {
      status: 'translating',
      progress: 70,
      cleanedImageUrl: item.cleanedUrl,
    })

    try {
      const storyContext = buildBatchTranslationContext(options, item.entry, candidates, liveStoryLines)
      const regions = await translatePage(item.entry.file!, item.cleanedBlob, options, storyContext)
      appendTranslatedLines(liveStoryLines, pageNumber, regions)
      options.onEntryUpdate(item.entry.id, {
        cleanedImageUrl: item.cleanedUrl,
        regions,
        brushStrokes: [],
        status: 'done',
        progress: 100,
        error: undefined,
      })
      options.onLog(`Batch AI: หน้า ${item.entry.pageNumber ?? item.entry.id} แปลเสร็จ ${regions.length} regions`)
      options.onBatchProgress?.({
        phase: index === cleaned.length - 1 ? 'done' : 'translating',
        currentIndex: index + 1,
        total: candidates.length,
        currentPageNumber: pageNumber,
        progress: Math.round(((index + 1) / candidates.length) * 100),
        message: `เสร็จหน้า ${pageNumber}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      options.onEntryUpdate(item.entry.id, {
        status: 'error',
        error: message,
        progress: 100,
      })
      options.onLog(`Batch AI ERROR: หน้า ${item.entry.pageNumber ?? item.entry.id}: ${message}`)
      options.onBatchProgress?.({
        phase: 'error',
        currentIndex: index + 1,
        total: candidates.length,
        currentPageNumber: pageNumber,
        progress: Math.round(((index + 1) / candidates.length) * 100),
        message: `หน้า ${pageNumber} ผิดพลาด`,
      })
    }
  }
}

async function cleanPages(entries: ImageEntry[], options: BatchProcessOptions): Promise<CleanResult[]> {
  options.onBatchProgress?.({
    phase: 'cleaning',
    currentIndex: 0,
    total: entries.length,
    progress: 5,
    message: `กำลังคลีน ${entries.length} หน้า`,
  })
  entries.forEach((entry) => {
    options.onEntryUpdate(entry.id, { status: 'cleaning', progress: 15 })
  })

  if (options.settings.cleanupBackend === 'panelcleaner') {
    const results = await processImagesWithPanelCleanerBatch(
      entries.map((entry) => ({ id: entry.id, file: entry.file! })),
      {
        bridgeUrl: options.settings.panelCleanerBridgeUrl,
        executablePath: options.settings.panelCleanerExecutablePath,
      },
      (progress) => options.onLog(`[${progress.status}] ${progress.message}`),
    )

    const byId = new Map(results.map((result) => [result.id, result]))
    const cleaned: CleanResult[] = []
    for (const [index, entry] of entries.entries()) {
      options.onBatchProgress?.({
        phase: 'cleaning',
        currentIndex: index + 1,
        total: entries.length,
        currentPageNumber: entry.pageNumber ?? index + 1,
        progress: Math.round((index / entries.length) * 55),
        message: `กำลังอัปเดตผลคลีนหน้า ${entry.pageNumber ?? index + 1}`,
      })
      await delay(UI_STEP_DELAY_MS)

      const result = byId.get(entry.id)
      if (!result?.cleanedImageBlob) {
        const message = result?.error || 'PanelCleaner batch did not return a cleaned image'
        options.onEntryUpdate(entry.id, { status: 'error', error: message, progress: 100 })
        continue
      }
      result.logs?.forEach((line) => options.onLog(`PanelCleaner batch: ${line}`))
      const cleanedUrl = URL.createObjectURL(result.cleanedImageBlob)
      options.onEntryUpdate(entry.id, {
        cleanedImageUrl: cleanedUrl,
        status: 'clean_done',
        progress: 55,
      })
      options.onBatchProgress?.({
        phase: 'clean_done',
        currentIndex: index + 1,
        total: entries.length,
        currentPageNumber: entry.pageNumber ?? index + 1,
        progress: Math.round(((index + 1) / entries.length) * 55),
        message: `คลีนหน้า ${entry.pageNumber ?? index + 1} เสร็จ`,
      })
      cleaned.push({ entry, cleanedBlob: result.cleanedImageBlob, cleanedUrl })
    }
    return cleaned
  }

  const cleaned: CleanResult[] = []
  for (const [index, entry] of entries.entries()) {
    options.onBatchProgress?.({
      phase: 'cleaning',
      currentIndex: index + 1,
      total: entries.length,
      currentPageNumber: entry.pageNumber ?? index + 1,
      progress: Math.round((index / entries.length) * 55),
      message: `กำลังคลีนหน้า ${entry.pageNumber ?? index + 1}`,
    })
    try {
      const result = await processImageWithCleanupProvider({
        file: entry.file!,
        mode: options.mode,
        settings: options.settings,
        runOcr: false,
        onProgress: (progress) => options.onLog(`[${progress.status}] ${progress.message}`),
      })
      if (!result.cleanedImageBlob) throw new Error('Cleanup backend did not return a cleaned image')
      const cleanedUrl = URL.createObjectURL(result.cleanedImageBlob)
      cleaned.push({ entry, cleanedBlob: result.cleanedImageBlob, cleanedUrl })
      options.onEntryUpdate(entry.id, { cleanedImageUrl: cleanedUrl, status: 'clean_done', progress: 55 })
      options.onBatchProgress?.({
        phase: 'clean_done',
        currentIndex: index + 1,
        total: entries.length,
        currentPageNumber: entry.pageNumber ?? index + 1,
        progress: Math.round(((index + 1) / entries.length) * 55),
        message: `คลีนหน้า ${entry.pageNumber ?? index + 1} เสร็จ`,
      })
    } catch (error) {
      options.onEntryUpdate(entry.id, {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        progress: 100,
      })
    }
  }
  return cleaned
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function translatePage(
  file: File,
  cleanedBlob: Blob,
  options: BatchProcessOptions,
  storyContext?: TranslationStoryContext,
): Promise<TextRegion[]> {
  if (options.mode === 'ocr_only') {
    return detectOcrWithOllamaVision(file, options.sourceLang, options.ollamaOptions)
  }

  let boxes: BoundingBox[] = []
  try {
    boxes = await deriveTextBoxesFromCleanupDiff(file, cleanedBlob)
  } catch (error) {
    options.onLog(`Batch AI: cleanup diff ใช้ไม่ได้ (${error instanceof Error ? error.message : String(error)})`)
  }

  if (boxes.length > 0) {
    return translateWithOllamaBoxedVision(file, boxes, options.sourceLang, {
      ...options.ollamaOptions,
      storyContext,
    })
  }

  return translateWithOllamaVision(file, options.sourceLang, {
    ...options.ollamaOptions,
    storyContext,
  })
}

function buildBatchTranslationContext(
  options: BatchProcessOptions,
  entry: ImageEntry,
  entries: ImageEntry[],
  liveStoryLines: NonNullable<TranslationStoryContext['previousLines']>,
): TranslationStoryContext {
  return {
    enabled: options.settings.translationContextEnabled,
    pageNumber: entry.pageNumber,
    totalPages: entries.length,
    styleGuide: options.settings.translationStyleGuide,
    previousLines: collectPreviousTranslationLines(entries, entry.id, liveStoryLines),
  }
}
