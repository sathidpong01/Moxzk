import { useEffect, useMemo, useRef } from 'react'
import {
  getInlineTextEditorTheme,
  shouldFinishInlineTextEditorOnPointerDown,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import type { TextAlign, TextLayoutMode } from '../../types'

interface InlineTextEditorProps {
  width: number
  height: number
  value: string
  fontFamily: string
  fontWeight: number
  fontStyle: 'normal' | 'italic'
  fontSize: number
  lineHeight: number
  paddingX: number
  paddingY: number
  contentHeight?: number
  viewportZoom: number
  color: string
  align: TextAlign
  layoutMode: TextLayoutMode
  constrainToFrame: boolean
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
  lineHeight,
  paddingX,
  paddingY,
  contentHeight,
  viewportZoom,
  color,
  align,
  layoutMode,
  constrainToFrame,
  onChange,
  onFinish,
}: InlineTextEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const finishedRef = useRef(false)
  const theme = getInlineTextEditorTheme(color)
  const displayFontSize = Math.max(1, fontSize)
  const displayLineHeight = Math.max(1, lineHeight)
  const chromeScale = 1 / Math.max(0.1, viewportZoom)
  const editorWidth = width
  const editorHeight = height
  const verticalPadding = useMemo(() => {
    if (align !== 'center' || contentHeight === undefined) return paddingY
    return Math.max(paddingY, (height - contentHeight) / 2)
  }, [align, contentHeight, height, paddingY])
  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    const textarea = textareaRef.current
    const measuredWidth = textarea
      ? constrainToFrame
        ? textarea.offsetWidth
        : Math.max(textarea.offsetWidth, textarea.scrollWidth)
      : editorWidth
    const measuredHeight = textarea
      ? constrainToFrame
        ? textarea.offsetHeight
        : Math.max(textarea.offsetHeight, textarea.scrollHeight)
      : editorHeight
    onFinish({
      width: measuredWidth,
      height: measuredHeight,
      scrollWidth: textarea?.scrollWidth,
      scrollHeight: textarea?.scrollHeight,
      layoutMode,
    }, textarea?.value ?? value)
  }

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
        wrap={constrainToFrame ? 'soft' : 'off'}
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
          lineHeight: displayLineHeight,
          paddingTop: verticalPadding,
          paddingRight: paddingX,
          paddingBottom: paddingY,
          paddingLeft: paddingX,
          backgroundColor: theme.backgroundColor,
          color: theme.textColor,
          caretColor: theme.caretColor,
          textShadow: theme.textShadow,
          textAlign: align,
          resize: 'none',
          overflow: constrainToFrame ? 'hidden' : 'visible',
          whiteSpace: constrainToFrame ? 'pre-wrap' : 'pre',
          overflowWrap: constrainToFrame ? 'break-word' : 'normal',
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
