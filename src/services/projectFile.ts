import { saveAs } from 'file-saver'
import { toast } from 'sonner'
import { getDefaultArtboardPosition, useAppStore } from '../store/appStore'
import { downloadImage } from './storageService'
import type { BrushStroke, ImageEntry, ImageEntryStatus, TextRegion } from '../types'

const PROJECT_FILE_VERSION = 1
const PROJECT_FILE_EXT = '.moxzk'

interface SerializedEntry {
  id: string
  pageNumber: number
  status: ImageEntryStatus
  artboardX: number | null
  artboardY: number | null
  originalImage: string | null
  cleanedImage: string | null
  regions: TextRegion[]
  brushStrokes: BrushStroke[]
}

interface ProjectFile {
  version: number
  savedAt: number
  title: string
  entries: SerializedEntry[]
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url
    let blobUrl = url
    if (!url.startsWith('blob:') && !/^https?:\/\//.test(url) && url) {
      blobUrl = await downloadImage(url)
    }
    const res = await fetch(blobUrl)
    const blob = await res.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    console.warn('[projectFile] urlToDataUrl failed:', err)
    return null
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'image/webp'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], name, { type: mime })
}

export async function exportProjectFile(suggestedTitle = 'moxzk-project'): Promise<void> {
  const state = useAppStore.getState()
  const entries = state.imageEntries
  if (entries.length === 0) {
    toast.warning('ไม่มีหน้าให้บันทึก')
    return
  }

  state.saveActiveEntryState()
  const freshEntries = useAppStore.getState().imageEntries

  toast.info('กำลังเตรียมไฟล์โครงการ...')
  const serialized: SerializedEntry[] = []
  for (let i = 0; i < freshEntries.length; i++) {
    const entry = freshEntries[i]
    let originalImage: string | null = null
    if (entry.file) {
      originalImage = await fileToDataUrl(entry.file)
    } else if (entry.originalR2Key) {
      originalImage = await urlToDataUrl(entry.originalR2Key)
    } else if (entry.originalUrl) {
      originalImage = await urlToDataUrl(entry.originalUrl)
    }
    let cleanedImage: string | null = null
    if (entry.cleanedR2Key) {
      cleanedImage = await urlToDataUrl(entry.cleanedR2Key)
    } else if (entry.cleanedImageUrl) {
      cleanedImage = await urlToDataUrl(entry.cleanedImageUrl)
    }
    serialized.push({
      id: entry.id,
      pageNumber: entry.pageNumber ?? i + 1,
      status: entry.status,
      artboardX: entry.artboardX ?? null,
      artboardY: entry.artboardY ?? null,
      originalImage,
      cleanedImage,
      regions: entry.regions ?? [],
      brushStrokes: entry.brushStrokes ?? [],
    })
  }

  const project: ProjectFile = {
    version: PROJECT_FILE_VERSION,
    savedAt: Date.now(),
    title: suggestedTitle,
    entries: serialized,
  }

  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' })
  const fileName = `${suggestedTitle.replace(/[^a-zA-Z0-9_\-ก-๙]/g, '_')}${PROJECT_FILE_EXT}`
  saveAs(blob, fileName)
  toast.success(`บันทึก ${serialized.length} หน้าไปยังไฟล์โครงการ`)
}

export async function importProjectFile(file: File): Promise<boolean> {
  let text: string
  try {
    text = await file.text()
  } catch (err) {
    toast.error(`อ่านไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`)
    return false
  }

  let parsed: ProjectFile
  try {
    parsed = JSON.parse(text) as ProjectFile
  } catch {
    toast.error('ไฟล์โครงการเสียหายหรือไม่ใช่ไฟล์ .moxzk')
    return false
  }

  if (!parsed || parsed.version !== PROJECT_FILE_VERSION || !Array.isArray(parsed.entries)) {
    toast.error('ไฟล์โครงการเวอร์ชันไม่รองรับ')
    return false
  }

  const entries: ImageEntry[] = parsed.entries.map((raw, index) => {
    const pageNumber = raw.pageNumber ?? index + 1
    const fallback = getDefaultArtboardPosition(pageNumber - 1)
    const restoredFile = raw.originalImage
      ? dataUrlToFile(raw.originalImage, `page-${pageNumber}.webp`)
      : null
    const originalUrl = restoredFile ? URL.createObjectURL(restoredFile) : ''
    const cleanedImageUrl = raw.cleanedImage
      ? URL.createObjectURL(dataUrlToFile(raw.cleanedImage, `page-${pageNumber}-cleaned.webp`))
      : null

    return {
      id: `project-${Date.now()}-${index}`,
      file: restoredFile,
      originalUrl,
      cleanedImageUrl,
      regions: Array.isArray(raw.regions) ? raw.regions : [],
      brushStrokes: Array.isArray(raw.brushStrokes) ? raw.brushStrokes : [],
      status: raw.status ?? 'pending',
      pageNumber,
      artboardX: raw.artboardX ?? fallback.x,
      artboardY: raw.artboardY ?? fallback.y,
      imageLoaded: true,
    }
  })

  if (entries.length === 0) {
    toast.warning('ไฟล์โครงการว่าง')
    return false
  }

  const active = entries[0]
  useAppStore.setState({
    currentStep: 'edit',
    images: [],
    imageEntries: entries,
    activeImageId: active.id,
    originalImageUrl: active.originalUrl,
    cleanedImageUrl: active.cleanedImageUrl,
    regions: active.regions,
    brushStrokes: active.brushStrokes,
    selectedRegionId: null,
    logs: [],
    processError: null,
    isProcessing: false,
  })

  toast.success(`เปิดไฟล์โครงการ "${parsed.title}" — ${entries.length} หน้า`)
  return true
}

export { PROJECT_FILE_EXT }
