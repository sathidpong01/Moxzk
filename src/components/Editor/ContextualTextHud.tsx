import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Cloud,
  Eye,
  Italic,
  Languages,
  Loader2,
  Move,
  RotateCcw,
  Circle,
  Square,
  Trash2,
  Type,
} from 'lucide-react'
import { FONT_ID_MAP, resolveRegionFont, restoreCustomFont } from '../../config/fonts'
import { getAllFonts } from '../../services/fontStorage'
import { convertArtisticRegionToBalloon, convertBalloonRegionToArtistic, expandTextRegionBox } from '../../services/textRegionMode'
import { computeTextHudPosition, type TextHudPlacement } from '../../services/textHudPosition'
import type { RegionUpdateOptions } from '../../store/appStore'
import type { TextAlign, TextBalloonShape, TextRegion, TextStrokeJoin, TextArtisticFit } from '../../types'
import {
  getRegionTextLayout,
  normalizeTextArtisticFit,
  normalizeTextBalloonShape,
  normalizeTextLayoutMode,
} from '../../utils/textLayout'
import { StrokeJoinPreviewIcon, StrokeJoinToggleGroup } from './StrokeJoinPreview'
import { TooltipSurface, cn } from '../ui/primitives'

const HUD_SURFACE_CLASS = 'flex h-9 items-center rounded-[12px] bg-white/[0.04] transition hover:bg-white/[0.08]'
const HUD_GROUP_SURFACE_CLASS = `${HUD_SURFACE_CLASS} gap-1 px-1`

interface ContextualTextHudProps {
  portalRoot: HTMLElement | null
  region: TextRegion | null
  anchorRect: { x: number; y: number; width: number; height: number } | null
  visible: boolean
  preferredPlacement?: TextHudPlacement
  isTranslating?: boolean
  previewingOriginal?: boolean
  onUpdate: (updates: Partial<TextRegion>, options?: RegionUpdateOptions) => void
  onDelete: () => void
  onTranslate: () => void
  onStartInlineEdit: () => void
  onPreviewOriginalStart: () => void
  onPreviewOriginalEnd: () => void
}

type FontOption = {
  id: string
  name: string
  family: string
  weight: number
  style: 'normal' | 'italic'
}

const TEXT_ALIGNS: Array<{ value: TextAlign; label: string; icon: typeof AlignLeft }> = [
  { value: 'left', label: 'ชิดซ้าย', icon: AlignLeft },
  { value: 'center', label: 'กึ่งกลาง', icon: AlignCenter },
  { value: 'right', label: 'ชิดขวา', icon: AlignRight },
]
const BALLOON_SHAPE_OPTIONS: Array<{ value: TextBalloonShape; label: string; icon: typeof Circle }> = [
  { value: 'round', label: 'วงรี', icon: Circle },
  { value: 'cloud', label: 'ก้อนเมฆ', icon: Cloud },
  { value: 'box', label: 'กล่อง', icon: Square },
]
const ARTISTIC_FIT_OPTIONS: Array<{ value: TextArtisticFit; label: string }> = [
  { value: 'free', label: 'อิสระ' },
  { value: 'bubble_guided', label: 'อิงบับเบิล' },
]

function isBoldWeight(weight: number): boolean {
  return weight >= 700
}

function rankVariantOption(option: FontOption, wantsBold: boolean): number {
  if (wantsBold) return Math.abs(option.weight - 700)
  return Math.abs(option.weight - 400)
}

function findFontVariant(
  options: FontOption[],
  family: string,
  wantsBold: boolean,
  wantsItalic: boolean,
): FontOption | null {
  const matches = options
    .filter((option) => option.family === family)
    .filter((option) => isBoldWeight(option.weight) === wantsBold)
    .filter((option) => (option.style === 'italic') === wantsItalic)
    .sort((left, right) => rankVariantOption(left, wantsBold) - rankVariantOption(right, wantsBold))

  return matches[0] ?? null
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatDraft(value: number, digits = 0): string {
  if (digits > 0) return value.toFixed(digits).replace(/\.0+$/, '')
  return Math.round(value).toString()
}

export default function ContextualTextHud({
  portalRoot,
  region,
  anchorRect,
  visible,
  preferredPlacement = 'top',
  isTranslating = false,
  previewingOriginal = false,
  onUpdate,
  onDelete,
  onTranslate,
  onStartInlineEdit,
  onPreviewOriginalStart,
  onPreviewOriginalEnd,
}: ContextualTextHudProps) {
  const hudRef = useRef<HTMLDivElement>(null)
  const fontMenuRef = useRef<HTMLDivElement>(null)
  const textBoxMenuRef = useRef<HTMLDivElement>(null)
  const [hudSize, setHudSize] = useState({ width: 0, height: 0 })
  const [fontMenuOpen, setFontMenuOpen] = useState(false)
  const [textBoxMenuOpen, setTextBoxMenuOpen] = useState(false)
  const [fontQuery, setFontQuery] = useState('')
  const [fontOptions, setFontOptions] = useState<FontOption[]>([])
  const [fontSizeDraft, setFontSizeDraft] = useState('36')
  const [strokeWidthDraft, setStrokeWidthDraft] = useState('0')
  const [rotationDraft, setRotationDraft] = useState('0')

  useEffect(() => {
    let cancelled = false
    getAllFonts().then(async (storedFonts) => {
      const customFonts: FontOption[] = []
      for (const storedFont of storedFonts) {
        try {
          const restored = await restoreCustomFont(storedFont)
          customFonts.push({
            id: restored.name,
            name: restored.name,
            family: restored.family,
            weight: restored.weight,
            style: restored.style,
          })
        } catch {
          // skip invalid or already unavailable custom fonts
        }
      }

      if (cancelled) return
      setFontOptions([
        ...Object.entries(FONT_ID_MAP).map(([id, font]) => ({
          id,
          name: font.name,
          family: font.family,
          weight: font.weight,
          style: font.style,
        })),
        ...customFonts,
      ])
    }).catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!region) return
    setFontSizeDraft(formatDraft(region.fontSize))
    setStrokeWidthDraft(formatDraft(region.strokeWidth, region.strokeWidth % 1 === 0 ? 0 : 1))
    setRotationDraft(formatDraft(region.rotation))
  }, [region?.id, region?.fontSize, region?.rotation, region?.strokeWidth])

  useEffect(() => {
    const node = hudRef.current
    if (!node || !visible) return
    const updateSize = () => {
      setHudSize({
        width: node.offsetWidth,
        height: node.offsetHeight,
      })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(node)
    return () => observer.disconnect()
  }, [fontMenuOpen, textBoxMenuOpen, region?.id, visible])

  useEffect(() => {
    if (!fontMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!fontMenuRef.current?.contains(event.target as Node)) {
        setFontMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [fontMenuOpen])

  useEffect(() => {
    if (!textBoxMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!textBoxMenuRef.current?.contains(event.target as Node)) {
        setTextBoxMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [textBoxMenuOpen])

  useEffect(() => {
    if (!visible) {
      setFontMenuOpen(false)
      setTextBoxMenuOpen(false)
      setFontQuery('')
    }
  }, [visible])

  const layoutMode = region ? normalizeTextLayoutMode(region.textLayoutMode) : 'balloon_fit'
  const balloonShape = region ? normalizeTextBalloonShape(region.balloonShape, region.mood) : 'round'
  const artisticFit = region ? normalizeTextArtisticFit(region.artisticFit) : 'free'
  const textAlign = region?.textAlign ?? 'center'
  const regionFont = region ? resolveRegionFont(region) : null
  const regionLayout = region && regionFont
    ? getRegionTextLayout(region, region.translatedText || ' ', {
        fontFamily: regionFont.family,
        fontWeight: regionFont.weight,
        fontStyle: regionFont.style,
      })
    : null
  const currentFontId = region?.fontId ?? region?.suggestedFont ?? region?.mood ?? 'normal'
  const currentFont = fontOptions.find((option) => option.id === currentFontId)
    ?? {
      id: currentFontId,
      name: currentFontId,
      family: FONT_ID_MAP[currentFontId]?.family ?? currentFontId,
      weight: FONT_ID_MAP[currentFontId]?.weight ?? 400,
      style: FONT_ID_MAP[currentFontId]?.style ?? 'normal',
    }
  const boldActive = isBoldWeight(currentFont.weight)
  const italicActive = currentFont.style === 'italic'
  const boldVariant = useMemo(
    () => findFontVariant(fontOptions, currentFont.family, !boldActive, italicActive),
    [boldActive, currentFont.family, fontOptions, italicActive],
  )
  const italicVariant = useMemo(
    () => findFontVariant(fontOptions, currentFont.family, boldActive, !italicActive),
    [boldActive, currentFont.family, fontOptions, italicActive],
  )

  const filteredFonts = useMemo(() => {
    const normalized = fontQuery.trim().toLowerCase()
    if (!normalized) return fontOptions
    return fontOptions.filter((option) => (
      option.name.toLowerCase().includes(normalized) || option.family.toLowerCase().includes(normalized)
    ))
  }, [fontOptions, fontQuery])
  const currentShapeOption = BALLOON_SHAPE_OPTIONS.find((option) => option.value === balloonShape) ?? BALLOON_SHAPE_OPTIONS[0]
  const CurrentShapeIcon = currentShapeOption.icon
  const layoutModeLabel = layoutMode === 'balloon_fit' ? 'พอดีกล่อง' : 'อิสระ'

  if (!portalRoot || !region || !anchorRect || !visible) return null

  const placement = computeTextHudPosition({
    anchorRect,
    containerWidth: portalRoot.clientWidth,
    containerHeight: portalRoot.clientHeight,
    hudWidth: hudSize.width,
    hudHeight: hudSize.height,
    preferredPlacement,
  })

  const updateNumericValue = (
    field: 'fontSize' | 'strokeWidth' | 'rotation',
    rawValue: string,
    min: number,
    max: number,
    digits = 0,
  ) => {
    const nextValue = Number(rawValue)
    if (!Number.isFinite(nextValue)) return
    onUpdate(
      { [field]: clampNumber(nextValue, min, max) } as Partial<TextRegion>,
      { historyKey: `hud:${field}:${region.id}` },
    )
    const formatted = formatDraft(clampNumber(nextValue, min, max), digits)
    if (field === 'fontSize') setFontSizeDraft(formatted)
    if (field === 'strokeWidth') setStrokeWidthDraft(formatted)
    if (field === 'rotation') setRotationDraft(formatted)
  }

  const reduceFont = () => {
    if (!region) return
    onUpdate({ fontSize: clampNumber(region.fontSize - 2, 8, 72) }, { historyKey: `hud:fontSize:${region.id}` })
  }

  const expandBox = () => {
    if (!region) return
    onUpdate(expandTextRegionBox(region), { historyKey: `hud:bbox:${region.id}` })
  }

  const fitText = () => {
    if (!region || !regionLayout) return
    if (layoutMode === 'balloon_fit') {
      onUpdate({ fontSize: Math.min(region.fontSize, regionLayout.fontSize) }, { historyKey: `hud:fit:${region.id}` })
      return
    }
    onUpdate({
      artisticFit: 'bubble_guided',
      textScaleX: 1,
      textScaleY: 1,
      fontSize: clampNumber(region.fontSize - 2, 8, 72),
    }, { historyKey: `hud:artisticFit:${region.id}` })
  }

  const hud = (
    <div className="pointer-events-none absolute inset-0 z-[220]">
      <div
        ref={hudRef}
        className="pointer-events-auto absolute overflow-visible"
        style={{ left: placement.left, top: placement.top }}
      >
        <div className="flex w-max max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-1.5 overflow-visible rounded-[18px] bg-[rgba(11,11,12,0.96)] px-3 py-2 shadow-[0_18px_42px_rgba(0,0,0,0.42)] backdrop-blur">
          <div ref={textBoxMenuRef} className="relative">
            <TooltipSurface label="รูปแบบกล่องข้อความ">
              <button
                type="button"
                className="flex h-9 min-w-[9.5rem] items-center gap-2 rounded-[12px] bg-white/[0.04] px-3 text-sm font-bold text-[var(--mg-text)] transition hover:bg-white/[0.08]"
                onClick={() => setTextBoxMenuOpen((value) => !value)}
                aria-expanded={textBoxMenuOpen}
                aria-label="รูปแบบกล่องข้อความ"
              >
                <CurrentShapeIcon size={14} className="shrink-0 text-[var(--mg-muted)]" />
                <span className="truncate">{layoutModeLabel}</span>
                <span className="max-w-[4.5rem] truncate text-xs text-[var(--mg-muted)]">{currentShapeOption.label}</span>
                <ChevronDown size={13} className="ml-auto shrink-0 text-[var(--mg-dim)]" />
              </button>
            </TooltipSurface>
            {textBoxMenuOpen && (
              <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-[14px] bg-[rgba(11,11,12,0.98)] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.45)]">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--mg-dim)]">การวาง</div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    className={hudMenuItemClass(layoutMode === 'balloon_fit')}
                    onClick={() => {
                      onUpdate({
                        textLayoutMode: 'balloon_fit',
                        ...(layoutMode === 'artistic' ? convertArtisticRegionToBalloon(region) : {}),
                      }, { historyKey: `hud:layout:${region.id}` })
                      setTextBoxMenuOpen(false)
                    }}
                  >
                    <Square size={14} />
                    <span>พอดีกล่อง</span>
                  </button>
                  <button
                    type="button"
                    className={hudMenuItemClass(layoutMode === 'artistic')}
                    onClick={() => {
                      onUpdate({
                        textLayoutMode: 'artistic',
                        ...(layoutMode === 'balloon_fit' ? convertBalloonRegionToArtistic(region) : {}),
                      }, { historyKey: `hud:layout:${region.id}` })
                      setTextBoxMenuOpen(false)
                    }}
                  >
                    <Move size={14} />
                    <span>อิสระ</span>
                  </button>
                </div>

                <div className="mt-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--mg-dim)]">รูปทรง</div>
                <div className="grid grid-cols-3 gap-1">
                  {BALLOON_SHAPE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={hudMenuItemClass(balloonShape === option.value)}
                        onClick={() => {
                          onUpdate({ balloonShape: option.value }, { historyKey: `hud:balloonShape:${region.id}` })
                          setTextBoxMenuOpen(false)
                        }}
                      >
                        <Icon size={14} />
                        <span>{option.label}</span>
                      </button>
                    )
                  })}
                </div>

                {layoutMode === 'artistic' && (
                  <>
                    <div className="mt-2 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--mg-dim)]">ขอบเขต</div>
                    <div className="grid grid-cols-2 gap-1">
                      {ARTISTIC_FIT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={hudMenuItemClass(artisticFit === option.value)}
                          onClick={() => {
                            onUpdate({ artisticFit: option.value }, { historyKey: `hud:artisticFit:${region.id}` })
                            setTextBoxMenuOpen(false)
                          }}
                        >
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={HUD_GROUP_SURFACE_CLASS}>
            {TEXT_ALIGNS.map((option) => {
              const Icon = option.icon
              return (
                <TooltipSurface key={option.value} label={option.label}>
                  <button
                    type="button"
                    className={hudSegmentButtonClass(textAlign === option.value)}
                    onClick={() => onUpdate({ textAlign: option.value }, { historyKey: `hud:align:${region.id}` })}
                    aria-label={option.label}
                  >
                    <Icon size={14} />
                  </button>
                </TooltipSurface>
              )
            })}
          </div>

          <div ref={fontMenuRef} className="relative">
            <TooltipSurface label="ฟอนต์">
              <button
                type="button"
                className="flex h-9 min-w-[12rem] max-w-[12rem] items-center gap-2 rounded-[12px] bg-white/[0.04] px-3 text-left text-sm text-[var(--mg-text)] transition hover:bg-white/[0.08]"
                onClick={() => setFontMenuOpen((value) => !value)}
                aria-expanded={fontMenuOpen}
                aria-label="ฟอนต์"
              >
                <Type size={14} className="shrink-0 text-[var(--mg-muted)]" />
                <span
                  className="truncate"
                  style={{ fontFamily: `"${currentFont.family}", sans-serif` }}
                >
                  {currentFont.name}
                </span>
              </button>
            </TooltipSurface>
            {fontMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-64 rounded-[16px] bg-[rgba(11,11,12,0.98)] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.45)]">
                <input
                  type="search"
                  value={fontQuery}
                  onChange={(event) => setFontQuery(event.target.value)}
                  placeholder="ค้นหาฟอนต์"
                  className="h-9 w-full rounded-[10px] border-0 bg-white/[0.04] px-3 text-sm text-[var(--mg-text)] outline-none placeholder:text-[var(--mg-dim)]"
                  aria-label="ค้นหาฟอนต์"
                />
                <div className="mt-2 max-h-64 overflow-y-auto pr-1">
                  {filteredFonts.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-sm transition hover:bg-white/[0.08]',
                        currentFont.id === option.id && 'bg-white/[0.08]',
                      )}
                      onClick={() => {
                        onUpdate({ fontId: option.id }, { historyKey: `hud:font:${region.id}` })
                        setFontMenuOpen(false)
                        setFontQuery('')
                      }}
                    >
                      <span style={{ fontFamily: `"${option.family}", sans-serif` }}>{option.name}</span>
                      {currentFont.id === option.id && <span className="text-xs font-bold text-[var(--mg-accent)]">ใช้แล้ว</span>}
                    </button>
                  ))}
                  {filteredFonts.length === 0 && (
                    <div className="px-3 py-4 text-sm text-[var(--mg-muted)]">ไม่พบฟอนต์</div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={HUD_GROUP_SURFACE_CLASS}>
            <TooltipSurface label={boldVariant ? (boldActive ? 'ปิดตัวหนา' : 'ตัวหนา') : 'ฟอนต์นี้ไม่รองรับตัวหนา'}>
              <button
                type="button"
                className={hudSegmentButtonClass(boldActive)}
                disabled={!boldVariant}
                onClick={() => {
                  if (!boldVariant) return
                  onUpdate({ fontId: boldVariant.id }, { historyKey: `hud:bold:${region.id}` })
                }}
                aria-label={boldActive ? 'ปิดตัวหนา' : 'ตัวหนา'}
              >
                <Bold size={14} />
              </button>
            </TooltipSurface>
            <TooltipSurface label={italicVariant ? (italicActive ? 'ปิดตัวเอียง' : 'ตัวเอียง') : 'ฟอนต์นี้ไม่รองรับตัวเอียง'}>
              <button
                type="button"
                className={hudSegmentButtonClass(italicActive)}
                disabled={!italicVariant}
                onClick={() => {
                  if (!italicVariant) return
                  onUpdate({ fontId: italicVariant.id }, { historyKey: `hud:italic:${region.id}` })
                }}
                aria-label={italicActive ? 'ปิดตัวเอียง' : 'ตัวเอียง'}
              >
                <Italic size={14} />
              </button>
            </TooltipSurface>
          </div>

          <NumericHudInput
            icon={<Type size={14} />}
            tooltip="ขนาดตัวอักษร"
            value={fontSizeDraft}
            onChange={(next) => {
              setFontSizeDraft(next)
              updateNumericValue('fontSize', next, 8, 72)
            }}
            onBlur={() => {
              setFontSizeDraft(formatDraft(region.fontSize))
            }}
            min={8}
            max={72}
            step={1}
          />

          <ColorHudInput
            tooltip="สีตัวอักษร"
            value={region.fontColor}
            onChange={(fontColor) => onUpdate({ fontColor }, { historyKey: `hud:fontColor:${region.id}` })}
            ariaLabel="สีตัวอักษร"
          />

          <NumericHudInput
            icon={<OutlineStrokeIcon />}
            tooltip="ความหนาขอบ"
            value={strokeWidthDraft}
            onChange={(next) => {
              setStrokeWidthDraft(next)
              updateNumericValue('strokeWidth', next, 0, 8, 1)
            }}
            onBlur={() => {
              setStrokeWidthDraft(formatDraft(region.strokeWidth, region.strokeWidth % 1 === 0 ? 0 : 1))
            }}
            min={0}
            max={8}
            step={0.5}
          />

          <ColorHudInput
            tooltip="สีขอบ"
            value={region.strokeColor}
            onChange={(strokeColor) => onUpdate({ strokeColor }, { historyKey: `hud:strokeColor:${region.id}` })}
            ariaLabel="สีขอบ"
          />

          {region.strokeWidth > 0 && (
            <div className={HUD_GROUP_SURFACE_CLASS}>
              <StrokeJoinToggleGroup
                value={region.strokeJoin ?? 'round'}
                onChange={(strokeJoin: TextStrokeJoin) => onUpdate({ strokeJoin }, { historyKey: `hud:strokeJoin:${region.id}` })}
                className="gap-0.5"
                iconClassName="h-[18px] w-[18px]"
                size="sm"
              />
            </div>
          )}

          <NumericHudInput
            icon={<RotateCcw size={14} />}
            tooltip="องศา"
            value={rotationDraft}
            onChange={(next) => {
              setRotationDraft(next)
              updateNumericValue('rotation', next, -180, 180)
            }}
            onBlur={() => {
              setRotationDraft(formatDraft(region.rotation))
            }}
            min={-180}
            max={180}
            step={1}
          />

          <TooltipSurface label="รีเซ็ตองศา">
            <button
              type="button"
              className={hudButtonClass(false)}
              onClick={() => {
                setRotationDraft('0')
                onUpdate({ rotation: 0 }, { historyKey: `hud:rotation:${region.id}` })
              }}
              aria-label="รีเซ็ตองศา"
            >
              <RotateCcw size={14} />
            </button>
          </TooltipSurface>

          <TooltipSurface label="แก้ข้อความ">
            <button
              type="button"
              className={hudButtonClass(false)}
              onClick={onStartInlineEdit}
              aria-label="แก้ข้อความ"
            >
              <Type size={14} />
            </button>
          </TooltipSurface>

          <TooltipSurface label="แปลใหม่">
            <button
              type="button"
              className={hudButtonClass(false)}
              onClick={onTranslate}
              disabled={isTranslating || !region.originalText}
              aria-label="แปลใหม่"
            >
              {isTranslating ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
            </button>
          </TooltipSurface>

          <TooltipSurface label="กดค้างดูต้นฉบับ">
            <button
              type="button"
              className={hudButtonClass(previewingOriginal)}
              onPointerDown={onPreviewOriginalStart}
              onPointerUp={onPreviewOriginalEnd}
              onPointerLeave={onPreviewOriginalEnd}
              onPointerCancel={onPreviewOriginalEnd}
              disabled={!region.originalText}
              aria-label="กดค้างดูต้นฉบับ"
            >
              <Eye size={14} />
            </button>
          </TooltipSurface>

          {regionLayout?.overflow && (
            <div className="ml-1 flex items-center gap-1 rounded-[12px] bg-[#7f1d1d1f] px-2 py-1 text-xs">
              <span className="font-bold text-[#fecaca]">
                {regionLayout.overflowReason === 'readability' ? 'คำแปลยาว/ตัวเล็ก' : 'ข้อความยังล้น'}
              </span>
              <button type="button" className={hudMiniButtonClass()} onClick={reduceFont}>ลดฟอนต์</button>
              <button type="button" className={hudMiniButtonClass()} onClick={expandBox}>ขยายกรอบ</button>
              <button type="button" className={hudMiniButtonClass(true)} onClick={fitText}>Fit</button>
            </div>
          )}

          <TooltipSurface label="ลบข้อความ">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[12px] text-[#ff8e8e] transition hover:bg-[#ff4d4f1f] hover:text-[#ffb0b0]"
              onClick={onDelete}
              aria-label="ลบข้อความ"
            >
              <Trash2 size={14} />
            </button>
          </TooltipSurface>
        </div>
      </div>
    </div>
  )

  return createPortal(hud, portalRoot)
}

function NumericHudInput({
  icon,
  tooltip,
  value,
  onChange,
  onBlur,
  min,
  max,
  step,
}: {
  icon: ReactNode
  tooltip: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  min: number
  max: number
  step: number
}) {
  return (
    <TooltipSurface label={tooltip}>
      <label className={cn(HUD_SURFACE_CLASS, 'gap-2 px-2 text-[var(--mg-muted)]')}>
        <span className="shrink-0">{icon}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className="h-full w-14 bg-transparent text-right text-sm leading-none text-[var(--mg-text)] outline-none"
        />
      </label>
    </TooltipSurface>
  )
}

function ColorHudInput({
  tooltip,
  value,
  onChange,
  ariaLabel,
}: {
  tooltip: string
  value: string
  onChange: (value: string) => void
  ariaLabel: string
}) {
  return (
    <TooltipSurface label={tooltip}>
      <label className={cn(HUD_SURFACE_CLASS, 'relative w-9 cursor-pointer justify-center overflow-hidden')}>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={ariaLabel}
        />
        <span
          className="pointer-events-none absolute inset-[5px] rounded-[7px]"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
      </label>
    </TooltipSurface>
  )
}

function OutlineStrokeIcon() {
  return <StrokeJoinPreviewIcon join="round" className="h-4 w-4" />
}

function hudButtonClass(active: boolean): string {
  return cn(
    'flex h-9 w-9 cursor-pointer items-center justify-center rounded-[12px] bg-transparent text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25 disabled:opacity-100 disabled:hover:bg-white/[0.08] disabled:hover:text-white/25',
    active && 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)] hover:text-white',
  )
}

function hudSegmentButtonClass(active: boolean): string {
  return cn(
    'flex h-8 w-8 cursor-pointer items-center justify-center rounded-[10px] bg-transparent text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)] disabled:cursor-not-allowed disabled:bg-white/[0.08] disabled:text-white/25 disabled:opacity-100 disabled:hover:bg-white/[0.08] disabled:hover:text-white/25',
    active && 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)] hover:text-white',
  )
}

function hudMenuItemClass(active: boolean): string {
  return cn(
    'flex h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] px-2 text-xs font-bold text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]',
    active && 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)] hover:text-white',
  )
}

function hudMiniButtonClass(primary = false): string {
  return cn(
    'rounded-[8px] px-2 py-1 text-[11px] font-bold transition',
    primary
      ? 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)]/90'
      : 'bg-white/[0.06] text-[var(--mg-muted)] hover:bg-white/[0.1] hover:text-[var(--mg-text)]',
  )
}
