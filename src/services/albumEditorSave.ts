import { toast } from 'sonner'
import { useAppStore } from '../store/appStore'
import { useAlbumStore } from '../store/albumStore'
import { useAuthStore } from '../store/authStore'
import type { Album, AlbumPage } from '../types/database'
import { getNextAlbumPageNumber, getPersistedPageStatus, resolveAlbumSaveTarget } from './albumSavePlan'
import {
  buildStorageKey,
  fileToBlob,
  generateThumbnail,
  imageUrlToBlob,
  prepareImageUpload,
  uploadPreparedImage,
} from './storageService'

export interface SaveEditorImagesResult {
  savedCount: number
  album: Album
}

export async function saveEditorImagesToAlbum(album: Album): Promise<SaveEditorImagesResult> {
  const appState = useAppStore.getState()
  const userId = useAuthStore.getState().user?.id
  if (!userId) {
    toast.error('ต้องเข้าสู่ระบบก่อนบันทึก')
    return { savedCount: 0, album }
  }

  const images = appState.imageEntries
  if (!images || images.length === 0) {
    toast.warning('ไม่มีรูปภาพให้บันทึก')
    return { savedCount: 0, album }
  }

  const { fetchPages, saveCurrentToPage, setCurrentAlbum, updatePage } = useAlbumStore.getState()
  const existingPages = await fetchPages(album.id, 'summary')
  let nextPageNum = getNextAlbumPageNumber(existingPages)
  let savedCount = 0

  for (const entry of images) {
    try {
      const target = resolveAlbumSaveTarget(entry, existingPages, nextPageNum)
      const pageNumber = target.pageNumber
      let originalKey = entry.originalR2Key ?? (target.existingPage?.original_key as string | null) ?? undefined
      let cleanedKey = entry.cleanedR2Key ?? (target.existingPage?.cleaned_key as string | null) ?? undefined
      let thumbnailKey = (target.existingPage?.thumbnail_key as string | null) ?? undefined
      let originalHash = entry.originalHash
      let cleanedHash = entry.cleanedHash
      let thumbnailHash = entry.thumbnailHash
      let cleanedBlobForThumbnail: Blob | null = null

      let thumbnailSource: Blob | null = null
      let thumbnailBlob: Blob | null = null
      if (entry.cleanedImageUrl) {
        cleanedBlobForThumbnail = await imageUrlToBlob(entry.cleanedImageUrl)
        thumbnailSource = cleanedBlobForThumbnail
      } else if (entry.file) {
        thumbnailSource = fileToBlob(entry.file)
      } else if (entry.originalUrl) {
        try {
          thumbnailSource = await imageUrlToBlob(entry.originalUrl)
        } catch {
          thumbnailSource = null
        }
      }

      if (thumbnailSource && (!thumbnailKey || !thumbnailHash)) {
        thumbnailBlob = await generateThumbnail(thumbnailSource)
      }

      if (entry.file && (!originalKey || !originalHash)) {
        const origKey = buildStorageKey(userId, album.id, pageNumber, 'original')
        const prepared = await prepareImageUpload(fileToBlob(entry.file))
        const origResult = await uploadPreparedImage(prepared, origKey)
        originalKey = origResult.key
        originalHash = prepared.sha256
      }
      if (entry.cleanedImageUrl && (!cleanedKey || !cleanedHash)) {
        const cleanKey = buildStorageKey(userId, album.id, pageNumber, 'cleaned')
        const cleanedBlob = cleanedBlobForThumbnail ?? await imageUrlToBlob(entry.cleanedImageUrl)
        const prepared = await prepareImageUpload(cleanedBlob)
        const cleanResult = await uploadPreparedImage(prepared, cleanKey)
        cleanedKey = cleanResult.key
        cleanedHash = prepared.sha256
      }
      if (thumbnailSource && (!thumbnailKey || !thumbnailHash)) {
        const thumbKey = buildStorageKey(userId, album.id, pageNumber, 'thumbnail')
        const prepared = await prepareImageUpload(thumbnailBlob ?? await generateThumbnail(thumbnailSource))
        const thumbResult = await uploadPreparedImage(prepared, thumbKey)
        thumbnailKey = thumbResult.key
        thumbnailHash = prepared.sha256
      }

      const status: AlbumPage['status'] = getPersistedPageStatus(entry)
      const pagePayload = {
        regions: entry.regions ?? appState.regions,
        brushStrokes: entry.brushStrokes ?? appState.brushStrokes,
        status,
        artboardX: entry.artboardX ?? null,
        artboardY: entry.artboardY ?? null,
      }

      let result = target.existingPage
      if (target.existingPage) {
        await updatePage(target.existingPage.id, {
          page_number: pageNumber,
          original_key: originalKey ?? null,
          cleaned_key: cleanedKey ?? null,
          thumbnail_key: thumbnailKey ?? null,
          regions: pagePayload.regions,
          brush_strokes: pagePayload.brushStrokes,
          status,
          processing_mode: 'full',
          artboard_x: pagePayload.artboardX,
          artboard_y: pagePayload.artboardY,
        })
      } else {
        result = await saveCurrentToPage(album.id, pageNumber, {
          ...pagePayload,
          originalKey: originalKey ?? null,
          cleanedKey: cleanedKey ?? null,
          thumbnailKey: thumbnailKey ?? null,
        })
      }

      if (result) {
        const { updateAlbum } = useAlbumStore.getState()
        useAppStore.getState().updateImageEntry(entry.id, {
          albumPageId: result.id,
          originalR2Key: originalKey,
          cleanedR2Key: cleanedKey,
          originalHash,
          cleanedHash,
          thumbnailHash,
          pageNumber,
        })
        if (savedCount === 0 && !album.cover_key && thumbnailKey) {
          await updateAlbum(album.id, { cover_key: thumbnailKey })
        }
        savedCount++
        if (!target.existingPage) nextPageNum++
      }
    } catch (err) {
      console.error('[save] Error saving page:', err)
      const reason = err instanceof Error ? err.message : String(err)
      toast.error(`บันทึกหน้า ${entry.pageNumber ?? nextPageNum} ล้มเหลว: ${reason}`)
    }
  }

  if (savedCount > 0) {
    await fetchPages(album.id, 'summary')
    const updatedAlbum = useAlbumStore.getState().albums.find((item) => item.id === album.id) ?? album
    setCurrentAlbum(updatedAlbum)
    toast.success(`บันทึก ${savedCount} หน้าลง "${album.title}" แล้ว`)
    return { savedCount, album: updatedAlbum }
  }

  return { savedCount, album }
}
