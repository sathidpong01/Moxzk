import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, ImageIcon, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { ExportFormat, ImageEntry } from '../../types'
import type { RuntimeExportDestination } from '../../runtime'
import {
  DEFAULT_EXPORT_DESTINATION,
  EXPORT_DESTINATION_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  EXPORT_PREVIEW_MODE_OPTIONS,
  EXPORT_QUALITY_PRESETS,
  type ExportPreviewMode,
  isExportQualityPreset,
  normalizeExportQualityPreset,
  supportsExportQuality,
} from '../../services/exportDrawer'
import {
  getExportCompareOriginalUrl,
  getExportPreviewRenderQueue,
  getExportThumbnailUrl,
  getNextExportPreviewId,
} from '../../services/exportPreview'
import {
  createExportPreviewCacheKey,
  reconcileExportPreviewCache,
} from '../../services/exportPreviewCache'
import { renderImageEntryToBlob } from '../../services/exporter'
import { clampViewerZoom, stepViewerZoom } from '../../services/viewerZoom'
import SplitView from '../Comparison/SplitView'
import { Button, Field, IconButton, cn } from '../ui/primitives'

interface ExportDrawerProps {
  isOpen: boolean
  activeImageId: string | null
  exportFormat: ExportFormat
  exportQuality: number
  imageEntries: ImageEntry[]
  onClose: () => void
  onExportFormatChange: (format: ExportFormat) => void
  onExportQualityChange: (quality: number) => void
  onExport: (selectedIds?: string[], destination?: RuntimeExportDestination) => Promise<boolean | void>
}

type SegmentedOption<T extends string | number> = {
  value: T
  label: string
}

function SegmentedPicker<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  stretch = false,
}: {
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  buttonClassName?: string
  stretch?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'gap-2 rounded-[18px] bg-white/[0.03] p-1.5',
        !className?.includes('grid') && 'flex flex-wrap',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            type="button"
            key={String(option.value)}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-w-0 min-h-10 cursor-pointer rounded-[14px] py-2 text-sm font-bold transition',
              stretch && 'flex-1',
              buttonClassName,
              active
                ? 'bg-[rgba(37,99,235,0.18)] text-white'
                : 'bg-transparent text-[var(--mg-muted)] hover:bg-white/[0.05] hover:text-[var(--mg-text)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function PreviewZoomBar({
  zoom,
  onChange,
}: {
  zoom: number
  onChange: (zoom: number) => void
}) {
  const zoomPercent = Math.round(clampViewerZoom(zoom) * 100)
  const buttonClassName = 'flex h-10 w-10 cursor-pointer items-center justify-center rounded-[14px] text-[var(--mg-muted)] transition hover:bg-white/[0.05] hover:text-[var(--mg-text)]'

  return (
    <div className="flex items-center gap-1 rounded-[18px] bg-white/[0.03] p-1.5">
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(stepViewerZoom(zoom, 'out'))}
        aria-label="ซูมออก"
        title="ซูมออก"
      >
        <ZoomOut size={16} />
      </button>
      <div className="min-w-16 rounded-[12px] bg-black/20 px-3 py-2 text-center font-mono text-xs font-bold text-[var(--mg-text)]">
        {zoomPercent}%
      </div>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(stepViewerZoom(zoom, 'in'))}
        aria-label="ซูมเข้า"
        title="ซูมเข้า"
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => onChange(1)}
        aria-label="รีเซ็ตมุมมอง"
        title="รีเซ็ตมุมมอง"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  )
}

export default function ExportDrawer({
  isOpen,
  activeImageId,
  exportFormat,
  exportQuality,
  imageEntries,
  onClose,
  onExportFormatChange,
  onExportQualityChange,
  onExport,
}: ExportDrawerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exportDestination, setExportDestination] = useState<RuntimeExportDestination>(DEFAULT_EXPORT_DESTINATION)
  const [activePreviewId, setActivePreviewId] = useState<string | null>(activeImageId)
  const [previewMode, setPreviewMode] = useState<ExportPreviewMode>('after')
  const [previewZoom, setPreviewZoom] = useState(1)
  const [renderedPreviewUrls, setRenderedPreviewUrls] = useState<Record<string, string>>({})
  const [renderedPreviewErrors, setRenderedPreviewErrors] = useState<Record<string, string>>({})
  const [isRenderingPreview, setIsRenderingPreview] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [canScrollPreviewBackward, setCanScrollPreviewBackward] = useState(false)
  const [canScrollPreviewForward, setCanScrollPreviewForward] = useState(false)
  const renderedPreviewUrlsRef = useRef<Record<string, string>>({})
  const renderedPreviewErrorsRef = useRef<Record<string, string>>({})
  const previewCacheKeyRef = useRef<string | null>(null)
  const previewStripRef = useRef<HTMLDivElement | null>(null)

  const sortedEntries = useMemo(
    () => [...imageEntries].sort((a, b) => (a.pageNumber ?? 0) - (b.pageNumber ?? 0)),
    [imageEntries],
  )
  const selectedEntries = useMemo(
    () => sortedEntries.filter((entry) => selectedIds.includes(entry.id)),
    [selectedIds, sortedEntries],
  )
  const previewCacheKey = useMemo(
    () => (isOpen ? createExportPreviewCacheKey(exportFormat, exportQuality) : null),
    [exportFormat, exportQuality, isOpen],
  )

  useEffect(() => {
    if (!isOpen) return
    setSelectedIds(sortedEntries.map((entry) => entry.id))
    setActivePreviewId(activeImageId)
    setPreviewMode('after')
    setPreviewZoom(1)
    setExportDestination(DEFAULT_EXPORT_DESTINATION)
    setIsExporting(false)
  }, [activeImageId, isOpen, sortedEntries])

  useEffect(() => {
    if (!isOpen) return
    if (!supportsExportQuality(exportFormat)) return
    if (isExportQualityPreset(exportQuality)) return
    onExportQualityChange(normalizeExportQualityPreset(exportQuality))
  }, [exportFormat, exportQuality, isOpen, onExportQualityChange])

  useEffect(() => {
    const nextId = getNextExportPreviewId(selectedEntries, activePreviewId)
    if (nextId !== activePreviewId) setActivePreviewId(nextId)
  }, [activePreviewId, selectedEntries])

  useEffect(() => {
    if (!isOpen) return
    setPreviewZoom(1)
  }, [activePreviewId, isOpen])

  const syncPreviewStripControls = () => {
    const strip = previewStripRef.current
    if (!strip) {
      setCanScrollPreviewBackward(false)
      setCanScrollPreviewForward(false)
      return
    }

    const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth)
    setCanScrollPreviewBackward(strip.scrollLeft > 2)
    setCanScrollPreviewForward(strip.scrollLeft < maxScrollLeft - 2)
  }

  useEffect(() => {
    syncPreviewStripControls()
  }, [selectedEntries.length, isOpen])

  useEffect(() => {
    const strip = previewStripRef.current
    if (!strip || !activePreviewId) return

    const activeButton = strip.querySelector<HTMLElement>(`[data-preview-id="${activePreviewId}"]`)
    activeButton?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })

    const frame = window.requestAnimationFrame(() => {
      syncPreviewStripControls()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activePreviewId, selectedEntries.length])

  useEffect(() => {
    const strip = previewStripRef.current
    if (!strip) return

    const handleScroll = () => syncPreviewStripControls()
    strip.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    handleScroll()

    return () => {
      strip.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [isOpen])

  useEffect(() => {
    renderedPreviewUrlsRef.current = renderedPreviewUrls
  }, [renderedPreviewUrls])

  useEffect(() => {
    renderedPreviewErrorsRef.current = renderedPreviewErrors
  }, [renderedPreviewErrors])

  const previewRenderQueue = useMemo(
    () => getExportPreviewRenderQueue(selectedEntries, activePreviewId)
      .map((id) => selectedEntries.find((entry) => entry.id === id))
      .filter((entry): entry is ImageEntry => Boolean(entry)),
    [activePreviewId, selectedEntries],
  )

  useEffect(() => {
    return () => {
      for (const url of Object.values(renderedPreviewUrlsRef.current)) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      }
    }
  }, [])

  useEffect(() => {
    const nextCacheState = reconcileExportPreviewCache(
      {
        cacheKey: previewCacheKeyRef.current,
        renderedUrls: renderedPreviewUrlsRef.current,
        renderedErrors: renderedPreviewErrorsRef.current,
      },
      previewCacheKey,
    )

    previewCacheKeyRef.current = nextCacheState.cacheKey
    if (!nextCacheState.shouldReset) return

    for (const url of Object.values(renderedPreviewUrlsRef.current)) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
    renderedPreviewUrlsRef.current = nextCacheState.renderedUrls
    renderedPreviewErrorsRef.current = nextCacheState.renderedErrors
    setRenderedPreviewUrls(nextCacheState.renderedUrls)
    setRenderedPreviewErrors(nextCacheState.renderedErrors)

    if (!isOpen || selectedEntries.length === 0) {
      setIsRenderingPreview(false)
      return
    }

    setIsRenderingPreview(true)
  }, [isOpen, previewCacheKey, selectedEntries.length])

  useEffect(() => {
    if (!isOpen || selectedEntries.length === 0) {
      setIsRenderingPreview(false)
      return
    }

    const hasPending = previewRenderQueue.some((entry) =>
      !renderedPreviewUrlsRef.current[entry.id] && !renderedPreviewErrorsRef.current[entry.id],
    )
    if (!hasPending) {
      setIsRenderingPreview(false)
      return
    }

    let cancelled = false
    setIsRenderingPreview(true)

    void (async () => {
      for (let index = 0; index < previewRenderQueue.length; index += 1) {
        const entry = previewRenderQueue[index]
        if (cancelled) return
        if (renderedPreviewUrlsRef.current[entry.id] || renderedPreviewErrorsRef.current[entry.id]) continue

        try {
          const blob = await renderImageEntryToBlob(entry, exportFormat, exportQuality / 100)
          const url = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(url)
            return
          }

          setRenderedPreviewUrls((current) => {
            const previous = current[entry.id]
            if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous)
            const next = { ...current, [entry.id]: url }
            renderedPreviewUrlsRef.current = next
            return next
          })
          setRenderedPreviewErrors((current) => {
            if (!(entry.id in current)) return current
            const next = { ...current }
            delete next[entry.id]
            renderedPreviewErrorsRef.current = next
            return next
          })
        } catch (error) {
          if (cancelled) return
          setRenderedPreviewErrors((current) => {
            const next = {
              ...current,
              [entry.id]: error instanceof Error ? error.message : 'สร้างตัวอย่างล้มเหลว',
            }
            renderedPreviewErrorsRef.current = next
            return next
          })
        }

        if (index > 0) {
          await new Promise((resolve) => window.setTimeout(resolve, 0))
        }
      }
      if (!cancelled) setIsRenderingPreview(false)
    })()

    return () => {
      cancelled = true
    }
  }, [exportFormat, exportQuality, isOpen, previewRenderQueue, selectedEntries.length])

  const allSelected = sortedEntries.length > 0 && selectedIds.length === sortedEntries.length
  const activeEntry = selectedEntries.find((entry) => entry.id === activePreviewId) ?? null
  const activeOriginalUrl = activeEntry ? getExportCompareOriginalUrl(activeEntry) : null
  const activeTranslatedUrl = activeEntry ? renderedPreviewUrls[activeEntry.id] : null
  const activeRenderError = activeEntry ? renderedPreviewErrors[activeEntry.id] : null
  const canShowActivePreview = previewMode === 'after'
    ? Boolean(activeTranslatedUrl)
    : Boolean(activeOriginalUrl && activeTranslatedUrl)
  const hasQualityControls = supportsExportQuality(exportFormat)

  const toggleAll = () => {
    setSelectedIds(allSelected ? [] : sortedEntries.map((entry) => entry.id))
  }

  const toggleEntry = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  const handleExportClick = async () => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const didExport = await onExport(sortedEntries.length > 1 ? selectedIds : undefined, exportDestination)
      if (didExport) {
        onClose()
        return
      }
      setIsExporting(false)
    } catch {
      setIsExporting(false)
    }
  }

  const scrollPreviewStripByPage = (direction: 'backward' | 'forward') => {
    const strip = previewStripRef.current
    if (!strip) return

    const distance = Math.max(220, Math.round(strip.clientWidth * 0.72)) * (direction === 'forward' ? 1 : -1)
    strip.scrollBy({ left: distance, behavior: 'smooth' })
  }

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[220]">
      <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-0 flex justify-end overflow-hidden">
        <DialogPanel className="flex h-full w-full max-w-[72rem] flex-col bg-[rgba(11,11,12,0.98)] shadow-[-24px_0_64px_rgba(0,0,0,0.45)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-6 py-4">
            <div className="min-w-0">
              <DialogTitle className="sr-only">ส่งออกโปรเจกต์</DialogTitle>
              <p className="text-sm font-medium text-[var(--mg-muted)]">
                {selectedEntries.length > 0
                  ? `${selectedEntries.length} จาก ${sortedEntries.length} หน้า พร้อมส่งออก`
                  : 'เลือกหน้าอย่างน้อย 1 หน้าเพื่อส่งออก'}
              </p>
            </div>
            <IconButton label="ปิดหน้าส่งออก" onClick={onClose} className="h-10 w-10 rounded-[14px]">
              <X size={18} />
            </IconButton>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5">
            <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1fr)_20.5rem]">
              <section className="min-h-0 rounded-[24px] bg-white/[0.02] p-4">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SegmentedPicker
                      value={previewMode}
                      options={EXPORT_PREVIEW_MODE_OPTIONS}
                      onChange={setPreviewMode}
                      ariaLabel="รูปแบบ preview"
                      className="w-fit"
                      buttonClassName="min-w-0 px-5 text-xs sm:text-sm"
                    />
                    <PreviewZoomBar zoom={previewZoom} onChange={setPreviewZoom} />
                  </div>

                  <div className="mt-4 min-h-0 flex-1 rounded-[22px] bg-[rgba(255,255,255,0.02)] p-3">
                    {activeEntry && canShowActivePreview && activeTranslatedUrl ? (
                      <SplitView
                        originalImageUrl={activeOriginalUrl || activeTranslatedUrl}
                        translatedImageUrl={activeTranslatedUrl}
                        mode={previewMode}
                        zoom={previewZoom}
                        onZoomChange={setPreviewZoom}
                      />
                    ) : (
                      <div className="flex h-full min-h-[24rem] flex-col items-center justify-center rounded-[18px] bg-black/20 px-6 text-center text-[var(--mg-muted)]">
                        <ImageIcon size={40} aria-hidden="true" />
                        <p className="mt-4 text-sm font-bold text-[var(--mg-text)]">
                          {isRenderingPreview
                            ? 'กำลังสร้างตัวอย่างส่งออก'
                            : activeRenderError || (previewMode === 'after'
                              ? 'ยังไม่มีภาพ after ที่พร้อมดู'
                              : 'ยังไม่มีภาพสำหรับเปรียบเทียบ')}
                        </p>
                        <p className="mt-1 text-xs">
                          {selectedEntries.length > 0
                            ? previewMode === 'after'
                              ? 'ระบบจะแสดงภาพหลัง export แบบเดี่ยวเมื่อเรนเดอร์เสร็จ'
                              : 'ระบบจะใช้ภาพต้นฉบับเทียบกับภาพที่เรนเดอร์สำหรับ export'
                            : 'เลือกหน้าจากรายการด้านขวา'}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedEntries.length > 1 && (
                    <div className="mt-4 shrink-0 rounded-[22px] bg-[rgba(255,255,255,0.02)] p-3">
                      <div className="relative">
                        <button
                          type="button"
                          aria-label="เลื่อนหน้าตัวอย่างไปก่อนหน้า"
                          onClick={() => scrollPreviewStripByPage('backward')}
                          disabled={!canScrollPreviewBackward}
                          className={cn(
                            'absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(7,7,7,0.88)] text-[var(--mg-text)] shadow-[0_12px_28px_rgba(0,0,0,0.36)] backdrop-blur transition',
                            canScrollPreviewBackward ? 'cursor-pointer opacity-100 hover:bg-[rgba(18,18,18,0.96)]' : 'pointer-events-none opacity-0',
                          )}
                        >
                          <ChevronLeft size={18} />
                        </button>

                        <button
                          type="button"
                          aria-label="เลื่อนหน้าตัวอย่างไปถัดไป"
                          onClick={() => scrollPreviewStripByPage('forward')}
                          disabled={!canScrollPreviewForward}
                          className={cn(
                            'absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(7,7,7,0.88)] text-[var(--mg-text)] shadow-[0_12px_28px_rgba(0,0,0,0.36)] backdrop-blur transition',
                            canScrollPreviewForward ? 'cursor-pointer opacity-100 hover:bg-[rgba(18,18,18,0.96)]' : 'pointer-events-none opacity-0',
                          )}
                        >
                          <ChevronRight size={18} />
                        </button>

                        <div
                          ref={previewStripRef}
                          className="overflow-x-auto pb-1 pr-1 scroll-smooth"
                          onWheel={(event) => {
                            const strip = previewStripRef.current
                            if (!strip) return
                            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
                            event.preventDefault()
                            strip.scrollBy({ left: event.deltaY, behavior: 'auto' })
                          }}
                        >
                          <div className="flex min-w-max gap-2.5">
                            {selectedEntries.map((entry) => {
                              const previewUrl = getExportThumbnailUrl(entry, renderedPreviewUrls)
                              const isActive = entry.id === activePreviewId
                              return (
                                <button
                                  type="button"
                                  key={entry.id}
                                  data-preview-id={entry.id}
                                  aria-pressed={isActive}
                                  onClick={() => setActivePreviewId(entry.id)}
                                  className={cn(
                                    'w-[8.5rem] cursor-pointer overflow-hidden rounded-[18px] bg-white/[0.025] text-left transition hover:bg-white/[0.04]',
                                    isActive
                                      ? 'bg-[rgba(37,99,235,0.12)]'
                                      : '',
                                  )}
                                >
                                  <div className="flex aspect-[2/3] items-center justify-center bg-black/35">
                                    {previewUrl ? (
                                      <img
                                        src={previewUrl}
                                        alt={`หน้า ${entry.pageNumber ?? '?'}`}
                                        className="h-full w-full object-contain"
                                        draggable={false}
                                      />
                                    ) : (
                                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mg-muted)]">
                                        <ImageIcon size={28} aria-hidden="true" />
                                        <span className="text-xs font-bold">ไม่มีตัวอย่าง</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                                    <span className="font-bold text-[var(--mg-text)]">หน้า {entry.pageNumber ?? '?'}</span>
                                    <span className="truncate text-[var(--mg-muted)]">
                                      {renderedPreviewUrls[entry.id]
                                        ? 'พร้อม'
                                        : isRenderingPreview
                                          ? 'กำลังสร้าง'
                                          : entry.status}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <aside className="min-h-0 rounded-[24px] bg-white/[0.02] p-4">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="shrink-0">
                    <h2 className="text-lg font-bold text-[var(--mg-text)]">ตั้งค่าส่งออก</h2>
                  </div>

                  <div className="mg-scrollbar-hidden mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    <Field as="fieldset" label="รูปแบบไฟล์" className="gap-2">
                      <SegmentedPicker
                        value={exportFormat}
                        options={EXPORT_FORMAT_OPTIONS}
                        onChange={onExportFormatChange}
                        ariaLabel="รูปแบบไฟล์ส่งออก"
                        className="grid grid-cols-3"
                        buttonClassName="w-full justify-center px-2"
                        stretch
                      />
                    </Field>

                    <Field as="fieldset" label="ปลายทาง" className="gap-2">
                      <span className="sr-only">บันทึกเป็น ZIP หรือบันทึกลงโฟลเดอร์</span>
                      <SegmentedPicker
                        value={exportDestination}
                        options={EXPORT_DESTINATION_OPTIONS}
                        onChange={setExportDestination}
                        ariaLabel="ปลายทางการส่งออก"
                        className="grid grid-cols-2"
                        buttonClassName="w-full justify-center px-2 text-xs"
                        stretch
                      />
                      <p className="text-xs leading-5 text-[var(--mg-muted)]">
                        {exportDestination === 'folder'
                          ? 'Chrome จะขอสิทธิ์อ่านและแก้ไขโฟลเดอร์ก่อนบันทึกหลายไฟล์'
                          : 'บันทึกเป็นไฟล์เดียว ไม่ต้องให้สิทธิ์โฟลเดอร์กับ browser'}
                      </p>
                    </Field>

                    {hasQualityControls && (
                      <Field
                        as="fieldset"
                        label={(
                          <span className="flex items-center justify-between gap-2">
                            <span>คุณภาพ</span>
                            <span className="text-[11px] font-bold text-[var(--mg-dim)]">{exportQuality}%</span>
                          </span>
                        )}
                        className="gap-2"
                      >
                        <SegmentedPicker
                          value={exportQuality}
                          options={EXPORT_QUALITY_PRESETS.map((value) => ({ value, label: `${value}%` }))}
                          onChange={onExportQualityChange}
                          ariaLabel="คุณภาพไฟล์ส่งออก"
                          className="grid grid-cols-4"
                          buttonClassName="w-full justify-center px-2"
                          stretch
                        />
                      </Field>
                    )}

                    {sortedEntries.length > 1 && (
                      <Field as="fieldset" label="หน้า" className="min-h-0 gap-2">
                        <div className="min-h-0 rounded-[20px] bg-black/20 p-2.5">
                          <label className="flex items-center gap-3 rounded-[14px] bg-white/[0.03] px-3 py-2.5 text-sm font-bold text-[var(--mg-text)]">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={toggleAll}
                              className="h-4 w-4 accent-[var(--mg-accent)]"
                            />
                            เลือกทุกหน้า
                          </label>

                          <div className="mt-2 max-h-[22rem] space-y-1.5 overflow-auto pr-1">
                            {sortedEntries.map((entry) => {
                              const checked = selectedIds.includes(entry.id)
                              return (
                                <label
                                  key={entry.id}
                                  className={cn(
                                    'flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5 text-sm transition',
                                    checked
                                      ? 'bg-[rgba(37,99,235,0.12)]'
                                      : 'bg-transparent hover:bg-white/[0.04]',
                                  )}
                                >
                                  <span className="flex min-w-0 items-center gap-3">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => toggleEntry(entry.id)}
                                      className="h-4 w-4 accent-[var(--mg-accent)]"
                                    />
                                    <span className="font-bold text-[var(--mg-text)]">หน้า {entry.pageNumber ?? '?'}</span>
                                  </span>
                                  <span className="truncate text-xs text-[var(--mg-muted)]">{entry.status}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      </Field>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="lg"
                    className="mt-4 w-full rounded-[16px]"
                    onClick={() => void handleExportClick()}
                    disabled={isExporting || (sortedEntries.length > 1 && selectedIds.length === 0)}
                  >
                    <Download size={16} />
                    {isExporting ? 'กำลังส่งออก...' : 'ส่งออกไฟล์'}
                  </Button>
                </div>
              </aside>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
