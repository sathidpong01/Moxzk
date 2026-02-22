import { useCallback, useState } from 'react'
import type Konva from 'konva'
import type { CanvasEditorHandle } from '../components/Editor/CanvasEditor'
import { useAppStore } from '../store/appStore'
import { useAuthStore } from '../store/authStore'
import { useAlbumStore } from '../store/albumStore'
import { renderStageToDataUrl, exportFromDataUrl } from '../services/exporter'
import { toast } from 'sonner'

interface UseEditorActionsOptions {
  stageRef: React.RefObject<Konva.Stage | null>
  editorRef: React.RefObject<CanvasEditorHandle | null>
  canvasScale: number
}

export function useEditorActions({ stageRef, editorRef, canvasScale }: UseEditorActionsOptions) {
  const store = useAppStore()
  const [retryCount, setRetryCount] = useState(0)

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

  const handleContinueToExport = useCallback(() => {
    const stage = stageRef.current
    if (!stage) {
      toast.error('ไม่พบ canvas สำหรับ export')
      return
    }
    // Deselect all to hide transformer handles before capture
    editorRef.current?.deselectAll()
    // Small delay to let the deselect render
    setTimeout(() => {
      const dataUrl = renderStageToDataUrl(stage, canvasScale)
      store.setTranslatedImageUrl(dataUrl)
      store.setStep('export')
    }, 50)
  }, [canvasScale, store, stageRef, editorRef])

  const handleExport = useCallback(() => {
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
    originalFileName,
    handleGoToEdit,
    handleContinueToExport,
    handleExport,
    handleStartAI,
    handleRetryAI,
    handleSaveToAlbum,
  }
}
