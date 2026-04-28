import type { ImageEntry } from '../types'
import type { RuntimeProjectDraft } from './types'
import type { NativeDraftAsset, NativeProjectDraftPayload } from './electronBridge'

const ASSET_URL_PREFIX = 'moxzk-asset://'
const LEGACY_ASSET_URL_PREFIX = 'mg-asset://'

interface DraftAssetRef {
  id: string
  name: string
  type: string
}

type DesktopImageEntry = Omit<ImageEntry, 'file'> & {
  file: DraftAssetRef | null
}

interface DesktopProjectDraftManifest extends Omit<RuntimeProjectDraft, 'imageEntries'> {
  imageEntries: DesktopImageEntry[]
}

interface EncodeContext {
  assets: NativeDraftAsset[]
  urlAssetIds: Map<string, string>
}

export async function encodeDesktopProjectDraft(draft: RuntimeProjectDraft): Promise<NativeProjectDraftPayload> {
  const context: EncodeContext = {
    assets: [],
    urlAssetIds: new Map(),
  }

  const imageEntries: DesktopImageEntry[] = []
  for (const entry of draft.imageEntries) {
    imageEntries.push(await encodeImageEntry(entry, context))
  }

  const manifest: DesktopProjectDraftManifest = {
    ...draft,
    imageEntries,
    originalImageUrl: await encodeAssetUrl(draft.originalImageUrl, `active-original-${draft.activeImageId ?? 'none'}`, context),
    cleanedImageUrl: await encodeAssetUrl(draft.cleanedImageUrl, `active-cleaned-${draft.activeImageId ?? 'none'}`, context),
  }

  return {
    manifest,
    assets: context.assets,
  }
}

export function decodeDesktopProjectDraft(payload: NativeProjectDraftPayload): RuntimeProjectDraft | null {
  if (!payload.manifest || typeof payload.manifest !== 'object') return null

  const manifest = payload.manifest as Partial<DesktopProjectDraftManifest>
  if (manifest.version !== 1 || !Array.isArray(manifest.imageEntries)) return null

  const assetMap = new Map(payload.assets.map((asset) => [asset.id, asset]))
  const imageEntries = manifest.imageEntries.map((entry) => decodeImageEntry(entry, assetMap))

  return {
    ...manifest,
    imageEntries,
    originalImageUrl: decodeAssetUrl(manifest.originalImageUrl ?? null, assetMap),
    cleanedImageUrl: decodeAssetUrl(manifest.cleanedImageUrl ?? null, assetMap),
  } as RuntimeProjectDraft
}

async function encodeImageEntry(entry: ImageEntry, context: EncodeContext): Promise<DesktopImageEntry> {
  const file = entry.file
    ? await addAssetFromBlob(entry.file, `file-${entry.id}`, entry.file.name, entry.file.type, context)
    : null

  return {
    ...entry,
    file,
    originalUrl: await encodeAssetUrl(entry.originalUrl, `original-${entry.id}`, context) ?? '',
    cleanedImageUrl: await encodeAssetUrl(entry.cleanedImageUrl, `cleaned-${entry.id}`, context),
  }
}

function decodeImageEntry(entry: DesktopImageEntry, assetMap: Map<string, NativeDraftAsset>): ImageEntry {
  const fileAsset = entry.file ? assetMap.get(entry.file.id) : undefined
  const file = fileAsset ? assetToFile(fileAsset, entry.file?.name, entry.file?.type) : null
  const originalUrl = decodeAssetUrl(entry.originalUrl, assetMap)

  return {
    ...entry,
    file,
    originalUrl: originalUrl || (file ? URL.createObjectURL(file) : entry.originalUrl),
    cleanedImageUrl: decodeAssetUrl(entry.cleanedImageUrl, assetMap),
  }
}

async function encodeAssetUrl(
  value: string | null | undefined,
  idBase: string,
  context: EncodeContext,
): Promise<string | null> {
  if (!value) return null
  if (!shouldPersistUrl(value)) return value

  const existingId = context.urlAssetIds.get(value)
  if (existingId) return `${ASSET_URL_PREFIX}${existingId}`

  try {
    const response = await fetch(value)
    const blob = await response.blob()
    const ref = await addAssetFromBlob(blob, idBase, `${safeAssetId(idBase)}.bin`, blob.type, context)
    context.urlAssetIds.set(value, ref.id)
    return `${ASSET_URL_PREFIX}${ref.id}`
  } catch (error) {
    console.warn('[runtime:electron] Failed to persist draft asset URL:', error)
    return value
  }
}

async function addAssetFromBlob(
  blob: Blob,
  idBase: string,
  name: string,
  type: string,
  context: EncodeContext,
): Promise<DraftAssetRef> {
  const id = uniqueAssetId(safeAssetId(idBase), context.assets)
  context.assets.push({
    id,
    name: safeFileName(name || `${id}.bin`),
    type: type || 'application/octet-stream',
    data: await blob.arrayBuffer(),
  })
  return {
    id,
    name: safeFileName(name || `${id}.bin`),
    type: type || 'application/octet-stream',
  }
}

function decodeAssetUrl(value: string | null, assetMap: Map<string, NativeDraftAsset>): string | null {
  const prefix = value?.startsWith(ASSET_URL_PREFIX)
    ? ASSET_URL_PREFIX
    : value?.startsWith(LEGACY_ASSET_URL_PREFIX)
      ? LEGACY_ASSET_URL_PREFIX
      : null
  if (!value || !prefix) return value
  const asset = assetMap.get(value.slice(prefix.length))
  if (!asset) return null
  return URL.createObjectURL(assetToBlob(asset))
}

function assetToFile(asset: NativeDraftAsset, name?: string, type?: string): File {
  return new File([assetToBlob(asset)], name || asset.name, { type: type || asset.type })
}

function assetToBlob(asset: NativeDraftAsset): Blob {
  return new Blob([asset.data], { type: asset.type })
}

function shouldPersistUrl(value: string): boolean {
  return value.startsWith('blob:') || value.startsWith('data:')
}

function safeAssetId(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'asset'
}

function safeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').slice(0, 120) || 'asset.bin'
}

function uniqueAssetId(base: string, assets: NativeDraftAsset[]): string {
  let candidate = base
  let index = 1
  while (assets.some((asset) => asset.id === candidate)) {
    candidate = `${base}-${index}`
    index += 1
  }
  return candidate
}
