import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  getInlineTextEditorTheme,
  shouldFinishInlineTextEditorOnPointerDown,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import type { TextAlign, TextLayoutMode } from '../../types'
import { layoutTextInBox } from '../../utils/textLayout'

interface InlineTextEditorProps {
  width: number
  height: number
  value: string
  fontFamily: string
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  fontSize: number
  padding: number
  viewportZoom: number
  color: string
  align: TextAlign
  layoutMode: TextLayoutMode
  onChange: (value: string) => void
  onFinish: (metrics: InlineTextEditorCommitMetrics, value: string) => void
}

export default function InlineTextEditor({
  width,
  height,
  value,
  fontFamily,
  fontWeight,
  fontStyle,
  fontSize,
  padding,
  viewportZoom,
  color,
  align,
  layoutMode,
  onChange,
  onFinish,
}: InlineTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const finishedRef = useRef(false)
  const [artisticSize, setArtisticSize] = useState<{ width: number; height: number } | null>(null)
  const theme = getInlineTextEditorTheme(color)
  const isArtistic = layoutMode === 'artistic'
  const displayFontSize = Math.max(1, fontSize)
  const lineHeight = 1.18
  const chromeScale = 1 / Math.max(0.1, viewportZoom)
  const editorWidth = isArtistic ? (artisticSize?.width ?? width) : width
  const editorHeight = isArtistic ? (artisticSize?.height ?? height) : height
  const verticalPadding = useMemo(() => {
    if (align !== 'center') return padding
    const layout = layoutTextInBox(value, { width, height }, displayFontSize, {
      fontFamily,
      fontWeight,
      fontStyle,
      lineHeight,
      paddingX: padding,
      paddingY: padding,
      minFontSize: Math.max(6, displayFontSize - 0.1),
      maxFontSize: displayFontSize,
    })
    return Math.max(padding, (height - layout.contentHeight) / 2)
  }, [align, displayFontSize, fontFamily, fontStyle, fontWeight, height, padding, value, width])
  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    const textarea = textareaRef.current
    onFinish({
      width: textarea?.offsetWidth ?? editorWidth,
      height: textarea?.offsetHeight ?? editorHeight,
      scrollWidth: textarea?.scrollWidth,
      scrollHeight: textarea?.scrollHeight,
      layoutMode,
    }, textarea?.value ?? value)
  }

  useLayoutEffect(() => {
    if (!isArtistic) {
      setArtisticSize(null)
      return
    }

    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.width = `${width}px`
    textarea.style.height = `${height}px`
    const next = {
      width: Math.max(width, textarea.scrollWidth),
      height: Math.max(height, textarea.scrollHeight),
    }
    setArtisticSize((current) =>
      current && Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5
        ? current
        : next,
    )
  }, [displayFontSize, fontFamily, fontStyle, fontWeight, height, isArtistic, value, width])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!shouldFinishInlineTextEditorOnPointerDown(rootRef.current, event.target)) return
      finish()
    }

    document.addEventListener('pointerdown', handlePointerDown, { capture: true })
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true })
  })

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: editorWidth,
        height: editorHeight,
        minWidth: editorWidth,
        minHeight: editorHeight,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <textarea
        ref={textareaRef}
        className="mg-inline-text-editor block"
        wrap={isArtistic ? 'off' : 'soft'}
        style={{
          boxSizing: 'border-box',
          display: 'block',
          width: editorWidth,
          height: editorHeight,
          minWidth: editorWidth,
          minHeight: editorHeight,
          margin: 0,
          border: `${chromeScale}px solid rgba(125, 150, 255, 0.38)`,
          borderRadius: 6 * chromeScale,
          fontFamily,
          fontWeight,
          fontStyle,
          fontSize: displayFontSize,
          lineHeight,
          paddingTop: verticalPadding,
          paddingRight: padding,
          paddingBottom: padding,
          paddingLeft: padding,
          backgroundColor: theme.backgroundColor,
          color: theme.textColor,
          caretColor: theme.caretColor,
          textShadow: theme.textShadow,
          textAlign: align,
          resize: 'none',
          overflow: 'hidden',
          whiteSpace: isArtistic ? 'pre' : 'pre-wrap',
          overflowWrap: isArtistic ? 'normal' : 'break-word',
          outline: 'none',
          boxShadow: `0 0 0 ${chromeScale}px rgba(118, 142, 255, 0.36), inset 0 0 0 ${chromeScale}px rgba(255, 255, 255, 0.08)`,
        }}
        value={value}
        spellCheck={false}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        onChange={(event) => onChange(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            finish()
            return
          }
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault()
            finish()
          }
        }}
        aria-label="Edit translated text"
      />
    </div>
  )
}
