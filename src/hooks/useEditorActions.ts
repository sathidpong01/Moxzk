import { useCallback, useRef, useState } from 'react'
import type { ProcessingMode } from '../types'
import type { CanvasEditorHandle } from '../components/Editor/CanvasEditor'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { useAlbumStore } from '../store/albumStore'
import { renderImageEntryToDataUrl, exportFromDataUrl, exportImageEntries } from '../services/exporter'
import { runBatchAiQueue, type BatchProgressState } from '../services/batch-processing'
import { downloadImage } from '../services/storageService'
import { toast } from 'sonner'

interface UseEditorActionsOptions {
  editorRef: React.RefObject<CanvasEditorHandle | null>
}

export function useEditorActions({ editorRef }: UseEditorActionsOptions) {
  const store = useAppStore()
  const [retryCount, setRetryCount] = useState(0)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [batchStatus, setBatchStatus] = useState<BatchProgressState | null>(null)
  const stopBatchRef = useRef(false)

  const activeEntry = store.imageEntries.find((e) => e.id === store.activeImageId)
  const activeFile = activeEntry?.file

  const originalFileName = activeFile?.name?.replace(/\.[^.]+$/, '') || 'manga-translated'

  const handleGoToEdit = useCallback(() => {
    if (store.images.length === 0) return
    if (store.imageEntries.length === 0) {
      store.addImageEntries(store.images)
    }
    store.goToEdit()
  }, [store])

  const handleContinueToExport = useCallback(async () => {
    store.saveActiveEntryState()
    if (store.imageEntries.length > 1) {
      store.setTranslatedImageUrl(null)
      store.setStep('export')
      return
    }
    editorRef.current?.deselectAll()
    const current = useAppStore.getState()
    const entry = current.imageEntries.find((item) => item.id === current.activeImageId)
    if (!entry) {
      toast.error('ไม่พบหน้าสำหรับ export')
      return
    }
    try {
      const dataUrl = await renderImageEntryToDataUrl(entry)
      store.setTranslatedImageUrl(dataUrl)
      store.setStep('export')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เตรียมภาพส่งออกไม่สำเร็จ')
    }
  }, [editorRef, store])

  const handleExport = useCallback(async (selectedIds?: string[]) => {
    store.saveActiveEntryState()
    const entries = useAppStore.getState().imageEntries
    if (entries.length > 1) {
      const album = useAlbumStore.getState().currentAlbum
      const ids = selectedIds && selectedIds.length > 0 ? selectedIds : entries.map((entry) => entry.id)
      try {
        const mode = await exportImageEntries(entries, {
          format: store.exportFormat,
          quality: store.exportQuality / 100,
          albumTitle: album?.title || originalFileName,
          selectedIds: ids,
        })
        toast.success(mode === 'folder' ? 'ส่งออกลงโฟลเดอร์สำเร็จ' : 'ส่งออกเป็น ZIP สำเร็จ')
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : 'ส่งออกล้มเหลว')
      }
      return
    }

    const url = store.translatedImageUrl
    if (!url) {
      toast.error('ไม่มีรูปที่แปลแล้ว')
      return
    }
    exportFromDataUrl(url, originalFileName, {
      format: store.exportFormat,
      quality: store.exportQuality / 100,
    })
    toast.success('ดาวน์โหลดสำเร็จ!')
  }, [store, originalFileName])

  const handleStartAI = useCallback(() => {
    if (!activeFile) return
    setRetryCount(0)
    store.startProcess()
  }, [store, activeFile])

  const handleRetryAI = useCallback(() => {
    store.setProcessError(null)
    setRetryCount((c) => c + 1)
    store.startProcess()
  }, [store])

  const handleCancelAI = useCallback(() => {
    store.cancelProcess()
  }, [store])

  const runBatch = useCallback(async (mode: ProcessingMode, retryFailedOnly = false) => {
    const state = useAppStore.getState()
    state.saveActiveEntryState()
    let entries = useAppStore.getState().imageEntries
    const needsFullImage = entries.filter((entry) => (
      (retryFailedOnly ? entry.status === 'error' : entry.status !== 'done') && !entry.file && entry.originalR2Key
    ))
    for (const entry of needsFullImage) {
      try {
        const originalUrl = await downloadImage(entry.originalR2Key!)
        const res = await fetch(originalUrl)
        const blob = await res.blob()
        const file = new File([blob], `page-${entry.pageNumber ?? entry.id}.webp`, { type: blob.type || 'image/webp' })
        useAppStore.getState().updateImageEntry(entry.id, {
          originalUrl,
          file,
          imageLoaded: true,
        })
      } catch (error) {
        useAppStore.getState().updateImageEntry(entry.id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'โหลดรูปเต็มจาก cloud ล้มเหลว',
        })
      }
    }
    entries = useAppStore.getState().imageEntries
    const missingFiles = entries.filter((entry) => (
      (retryFailedOnly ? entry.status === 'error' : entry.status !== 'done') && !entry.file
    ))
    if (missingFiles.length > 0) {
      toast.warning('บางหน้ามีแค่ข้อมูลจาก cloud และยังไม่ได้โหลดรูปเต็ม ให้คลิกโหลดหน้านั้นก่อนถ้าต้องการ batch')
    }
    stopBatchRef.current = false
    setIsBatchProcessing(true)
    setBatchStatus(null)
    state.clearLogs()
    state.addLog(`Batch AI: เริ่ม ${retryFailedOnly ? 'หน้าที่พลาด' : 'ทุกหน้า'}`)
    try {
      await runBatchAiQueue({
        entries,
        mode,
        settings: state.settings,
        sourceLang: state.settings.sourceLang,
        ollamaOptions: {
          ollamaUrl: state.settings.ollamaUrl,
          ollamaModel: state.settings.ollamaModel,
          ollamaApiKey: state.settings.ollamaApiKey,
        },
        retryFailedOnly,
        shouldStop: () => stopBatchRef.current,
        onEntryUpdate: (id, updates) => useAppStore.getState().updateImageEntry(id, updates),
        onBatchProgress: setBatchStatus,
        onLog: (message) => useAppStore.getState().addLog(`[${new Date().toLocaleTimeString()}] ${message}`),
      })
      toast.success('Batch AI เสร็จแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Batch AI ล้มเหลว')
    } finally {
      setIsBatchProcessing(false)
      setBatchStatus((current) => current ? { ...current, progress: current.phase === 'done' ? 100 : current.progress } : null)
    }
  }, [])

  const handleStartBatchAI = useCallback((mode: ProcessingMode) => {
    void runBatch(mode, false)
  }, [runBatch])

  const handleRetryFailedBatchAI = useCallback((mode: ProcessingMode) => {
    void runBatch(mode, true)
  }, [runBatch])

  const handleStopBatchAI = useCallback(() => {
    stopBatchRef.current = true
    setBatchStatus((current) => current
      ? { ...current, phase: 'stopping', message: 'จะหยุดหลังหน้าปัจจุบันเสร็จ' }
      : current)
    toast.info('จะหยุดหลังงานปัจจุบันเสร็จ')
  }, [])

  const handleSaveToAlbum = useCallback(() => {
    const user = useAuthStore.getState().user
    if (!user) {
      useAuthStore.getState().setShowAuthModal(true)
      toast.info('กรุณาเข้าสู่ระบบก่อนบันทึก')
      return
    }
    useAlbumStore.getState().openForSave()
  }, [])

  return {
    retryCount,
    isBatchProcessing,
    batchStatus,
    originalFileName,
    handleGoToEdit,
    handleContinueToExport,
    handleExport,
    handleStartAI,
    handleStartBatchAI,
    handleRetryFailedBatchAI,
    handleStopBatchAI,
    handleCancelAI,
    handleRetryAI,
    handleSaveToAlbum,
  }
}
