import type { BrushStroke, ImageEntry, TextRegion } from '../types'
import { syncActiveEntryBrushStrokes } from './brushStrokes'

export interface TextHistoryEntry {
  activeImageId: string | null
  before: TextRegion[]
  after: TextRegion[]
  selectedRegionId: string | null
  key?: string
}

export type EditorHistoryEntry =
  | ({
      kind: 'text'
    } & TextHistoryEntry)
  | {
      kind: 'brush'
      activeImageId: string | null
      before: BrushStroke[]
      after: BrushStroke[]
      selectedRegionId: string | null
      key?: string
    }

export interface EditorHistoryState {
  activeImageId: string | null
  regions: TextRegion[]
  brushStrokes: BrushStroke[]
  imageEntries: ImageEntry[]
  selectedRegionId: string | null
  _brushRedoStack: BrushStroke[]
}

export type EditorHistoryAppliedState = Pick<
  EditorHistoryState,
  'regions' | 'brushStrokes' | 'imageEntries' | 'selectedRegionId' | '_brushRedoStack'
>

export class EditorHistoryService {
  readonly maxEntries: number

  constructor(options: { maxEntries?: number } = {}) {
    this.maxEntries = options.maxEntries ?? 80
  }

  pushTextHistory(stack: TextHistoryEntry[], entry: TextHistoryEntry): TextHistoryEntry[] {
    if (this.regionListsEqual(entry.before, entry.after)) return stack

    const clonedEntry = {
      ...entry,
      before: this.cloneTextRegions(entry.before),
      after: this.cloneTextRegions(entry.after),
    }
    const last = stack[stack.length - 1]
    if (
      clonedEntry.key &&
      last?.key === clonedEntry.key &&
      last.activeImageId === clonedEntry.activeImageId
    ) {
      return [
        ...stack.slice(0, -1),
        {
          ...clonedEntry,
          before: last.before,
        },
      ].slice(-this.maxEntries)
    }

    return [...stack, clonedEntry].slice(-this.maxEntries)
  }

  pushEditorHistory(stack: EditorHistoryEntry[], entry: EditorHistoryEntry): EditorHistoryEntry[] {
    if (JSON.stringify(entry.before) === JSON.stringify(entry.after)) return stack

    const clonedEntry = this.cloneEditorHistoryEntry(entry)
    const last = stack[stack.length - 1]
    if (
      clonedEntry.kind === 'text' &&
      clonedEntry.key &&
      last?.kind === 'text' &&
      last.key === clonedEntry.key &&
      last.activeImageId === clonedEntry.activeImageId
    ) {
      return [
        ...stack.slice(0, -1),
        {
          ...clonedEntry,
          before: last.before,
        },
      ].slice(-this.maxEntries)
    }

    return [...stack, clonedEntry].slice(-this.maxEntries)
  }

  applyEditorHistoryEntry(
    state: EditorHistoryState,
    entry: EditorHistoryEntry,
    direction: 'undo' | 'redo',
  ): EditorHistoryAppliedState {
    if (entry.kind === 'text') {
      const regions = direction === 'undo' ? entry.before : entry.after
      return {
        regions,
        brushStrokes: state.brushStrokes,
        imageEntries: syncActiveEntryRegions(state.imageEntries, state.activeImageId, regions),
        selectedRegionId: entry.selectedRegionId,
        _brushRedoStack: state._brushRedoStack,
      }
    }

    const brushStrokes = direction === 'undo' ? entry.before : entry.after
    const redoSlice = direction === 'undo'
      ? entry.after.slice(entry.before.length)
      : []
    return {
      regions: state.regions,
      brushStrokes,
      imageEntries: syncActiveEntryBrushStrokes(state.imageEntries, state.activeImageId, brushStrokes),
      selectedRegionId: entry.selectedRegionId,
      _brushRedoStack: redoSlice,
    }
  }

  findLastActiveHistoryIndex(
    stack: EditorHistoryEntry[],
    activeImageId: string | null,
  ): number {
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].activeImageId === activeImageId) return index
    }
    return -1
  }

  cloneTextRegions(regions: TextRegion[]): TextRegion[] {
    return regions.map((region) => ({
      ...region,
      bbox: { ...region.bbox },
    }))
  }

  cloneBrushStrokes(strokes: BrushStroke[]): BrushStroke[] {
    return strokes.map((stroke) => ({
      ...stroke,
      points: [...stroke.points],
    }))
  }

  private cloneEditorHistoryEntry(entry: EditorHistoryEntry): EditorHistoryEntry {
    if (entry.kind === 'text') {
      return {
        ...entry,
        before: this.cloneTextRegions(entry.before),
        after: this.cloneTextRegions(entry.after),
      }
    }
    return {
      ...entry,
      before: this.cloneBrushStrokes(entry.before),
      after: this.cloneBrushStrokes(entry.after),
    }
  }

  private regionListsEqual(a: TextRegion[], b: TextRegion[]): boolean {
    if (a.length !== b.length) return false
    return JSON.stringify(a) === JSON.stringify(b)
  }
}

function syncActiveEntryRegions(
  entries: ImageEntry[],
  activeImageId: string | null,
  regions: TextRegion[],
): ImageEntry[] {
  if (!activeImageId) return entries
  return entries.map((entry) =>
    entry.id === activeImageId ? { ...entry, regions } : entry,
  )
}

export const editorHistoryService = new EditorHistoryService()
