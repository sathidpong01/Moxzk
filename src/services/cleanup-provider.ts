import type { AppSettings, ProcessingMode } from '../types'
import { processImage as processLegacyImage } from './translator-api'
import type { StreamProgress, TranslatorResponse } from './translator-api'
import { processImageWithPanelCleaner } from './panelcleaner-api'

export interface CleanupProviderRequest {
  file: File
  mode: ProcessingMode
  settings: AppSettings
  runOcr: boolean
  signal?: AbortSignal
  onProgress?: (progress: StreamProgress) => void
}

export async function processImageWithCleanupProvider({
  file,
  settings,
  runOcr,
  signal,
  onProgress,
}: CleanupProviderRequest): Promise<TranslatorResponse> {
  if (settings.cleanupBackend === 'legacy-manga-translator') {
    onProgress?.({ status: 'progress', message: 'Legacy manga-image-translator: starting cleanup' })
    return processLegacyImage(file, undefined, onProgress, settings.translatorApiUrl, signal)
  }

  onProgress?.({ status: 'progress', message: 'PanelCleaner: starting cleanup' })
  return processImageWithPanelCleaner(
    file,
    {
      bridgeUrl: settings.panelCleanerBridgeUrl,
      executablePath: settings.panelCleanerExecutablePath,
      runOcr,
      signal,
    },
    onProgress,
  )
}
