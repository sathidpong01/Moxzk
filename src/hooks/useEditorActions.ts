import { useCallback, useRef, useState } from 'react'
import type { ProcessingMode } from '../types'
import type { RuntimeExportDestination } from '../runtime'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { useAlbumStore } from '../store/albumStore'
import { exportImageEntries, renderImageEntryToBlob } from '../services/exporter'
import { getAppRuntime } from '../runtime'
import { runBatchAiQueue, type BatchProgressState } from '../services/batch-processing'
import { downloadImage } from '../services/storageService'
import { saveEditorImagesToAlbum } from '../services/albumEditorSave'
import { toast } from 'sonner'
import { autoStartRequiredLocalServices } from '../services/localServiceAutoStart'

interface UseEditorActionsOptions {
  onOpenExportDrawer: () => void
}

export function useEditorActions({ onOpenExportDrawer }: UseEditorActionsOptions) {
  const store = useAppStore()
  const [retryCount, setRetryCount] = useState(0)
  const [isBatchProcessing, setIsBatchProcessing] = useState(false)
  const [batchStatus, setBatchStatus] = useState<BatchProgressState | null>(null)
  const stopBatchRef = useRef(false)

  const activeEntry = store.imageEntries.find((e) => e.id === store.activeImageId)
  const activeFile = activeEntry?.file

  const handleGoToEdit = useCallback(() => {
    if (store.images.length === 0) return
    if (store.imageEntries.length === 0) {
      store.addImageEntries(store.images)
    }
    store.goToEdit()
  }, [store])

  const handleOpenExportDrawer = useCallback(() => {
    store.saveActiveEntryState()
    onOpenExportDrawer()
  }, [onOpenExportDrawer, store])

  const handleExport = useCallback(async (selectedIds?: string[], destination: RuntimeExportDestination = 'zip', filename?: string) => {
    store.saveActiveEntryState()
    const currentState = useAppStore.getState()
    const entries = currentState.imageEntries
    if (entries.length > 1) {
      const currentActiveFile = currentState.imageEntries.find((entry) => entry.id === currentState.activeImageId)?.file
      const originalFileName = currentActiveFile?.name?.replace(/\.[^.]+$/, '') || 'manga-translated'
      const album = useAlbumStore.getState().currentAlbum
      const ids = selectedIds && selectedIds.length > 0 ? selectedIds : entries.map((entry) => entry.id)
      const resolvedTitle = filename || album?.title || originalFileName
      try {
        const mode = await exportImageEntries(entries, {
          format: store.exportFormat,
          quality: store.exportQuality / 100,
          albumTitle: resolvedTitle,
          selectedIds: ids,
          destination,
        })
        toast.success(mode === 'folder' ? 'export ลงโฟลเดอร์สำเร็จ' : 'export เป็น ZIP สำเร็จ')
        return true
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        toast.error(error instanceof Error ? error.message : 'export ล้มเหลว')
        return false
      }
    }

    const entry = currentState.imageEntries.find((item) => item.id === currentState.activeImageId) ?? currentState.imageEntries[0]
    if (!entry) {
      toast.error('ไม่พบหน้าสำหรับ export')
      return false
    }
    const originalFileName = entry.file?.name?.replace(/\.[^.]+$/, '') || 'manga-translated'
    const album = useAlbumStore.getState().currentAlbum
    const resolvedName = filename || album?.title || originalFileName
    try {
      const blob = await renderImageEntryToBlob(entry, store.exportFormat, store.exportQuality / 100)
      const ext = store.exportFormat === 'jpg' ? 'jpg' : store.exportFormat
      const mode = await getAppRuntime().files.saveExportFiles(
        [{ name: `${resolvedName}.${ext}`, blob }],
        resolvedName,
        { destination },
      )
      toast.success(mode === 'folder' ? 'export ลงโฟลเดอร์สำเร็จ' : 'export เป็น ZIP สำเร็จ')
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'export ล้มเหลว')
      return false
    }
  }, [store])

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
      toast.warning('บางหน้ายังไม่ได้โหลดรูปเต็ม ให้คลิกโหลดหน้านั้นก่อนถ้าต้องการแปลหลายหน้า')
    }
    stopBatchRef.current = false
    setIsBatchProcessing(true)
    setBatchStatus(null)
    state.clearLogs()
    state.addLog(`AI แปลหลายหน้า: เริ่ม${retryFailedOnly ? 'เฉพาะหน้าที่พลาด' : 'ทุกหน้า'}`)

    const needsClean = entries.some((entry) =>
      (retryFailedOnly ? entry.status === 'error' : entry.status !== 'done') &&
      !entry.cleanedImageUrl &&
      entry.file,
    )
    const startupResult = await autoStartRequiredLocalServices({
      runtime: getAppRuntime(),
      settings: state.settings,
      mode,
      needsCleanup: needsClean || mode === 'clean_only',
      reporter: {
        onLoading: (service, message) => toast.loading(message, { id: `${service}-start` }),
        onSuccess: (service, message) => toast.success(message, { id: `${service}-start` }),
        onError: (service, message) => toast.error(message, { id: `${service}-start` }),
        onLog: state.addLog,
      },
    })
    if (!startupResult.ok) {
      setIsBatchProcessing(false)
      setBatchStatus(null)
      return
    }

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
      toast.success('แปลหลายหน้าเสร็จแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'แปลหลายหน้าไม่สำเร็จ')
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

  const handleSaveToAlbum = useCallback(async () => {
    const user = useAuthStore.getState().user
    if (!user) {
      useAuthStore.getState().setShowAuthModal(true)
      toast.info('กรุณาเข้าสู่ระบบก่อนบันทึก')
      return
    }
    store.saveActiveEntryState()
    const currentAlbum = useAlbumStore.getState().currentAlbum
    if (!currentAlbum) {
      useAlbumStore.getState().openForSave()
      toast.info('เลือกอัลบั้มปลายทางก่อนบันทึก')
      return
    }
    await saveEditorImagesToAlbum(currentAlbum)
  }, [store])

  const handleSaveAsAlbum = useCallback(() => {
    const user = useAuthStore.getState().user
    if (!user) {
      useAuthStore.getState().setShowAuthModal(true)
      toast.info('กรุณาเข้าสู่ระบบก่อนบันทึก')
      return
    }
    store.saveActiveEntryState()
    useAlbumStore.getState().openForSave()
  }, [store])

  return {
    retryCount,
    isBatchProcessing,
    batchStatus,
    handleGoToEdit,
    handleOpenExportDrawer,
    handleExport,
    handleStartAI,
    handleStartBatchAI,
    handleRetryFailedBatchAI,
    handleStopBatchAI,
    handleCancelAI,
    handleRetryAI,
    handleSaveToAlbum,
    handleSaveAsAlbum,
  }
}
