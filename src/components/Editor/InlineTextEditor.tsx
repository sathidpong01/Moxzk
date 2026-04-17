import { useEffect, useMemo, useRef } from 'react'
import {
  getInlineTextEditorTheme,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'

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
  align: 'left' | 'center'
  onChange: (value: string) => void
  onCommit: (metrics: InlineTextEditorCommitMetrics) => void
  onCancel: () => void
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
  onChange,
  onCommit,
  onCancel,
}: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipBlurCommitRef = useRef(false)
  const theme = getInlineTextEditorTheme(color)
  const displayFontSize = Math.max(1, fontSize)
  const lineHeight = 1.18
  const chromeScale = 1 / Math.max(0.1, viewportZoom)
  const verticalPadding = useMemo(() => {
    if (align !== 'center') return padding
    const availableWidth = Math.max(1, width - padding * 2)
    const averageGlyphWidth = displayFontSize * 0.62
    const charsPerLine = Math.max(1, Math.floor(availableWidth / Math.max(1, averageGlyphWidth)))
    const estimatedLines = (value.trim() || ' ')
      .split(/\r?\n/)
      .reduce((lines, paragraph) => lines + Math.max(1, Math.ceil([...paragraph].length / charsPerLine)), 0)
    const estimatedContentHeight = estimatedLines * displayFontSize * lineHeight
    return Math.max(padding, (height - estimatedContentHeight) / 2)
  }, [align, displayFontSize, height, padding, value, width])
  const commit = () => {
    const textarea = textareaRef.current
    onCommit({
      width: textarea?.offsetWidth ?? width,
      height: textarea?.offsetHeight ?? height,
    })
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  return (
    <textarea
      ref={textareaRef}
      className="mg-inline-text-editor block"
      style={{
        boxSizing: 'border-box',
        display: 'block',
        width,
        height,
        minWidth: width,
        minHeight: height,
        margin: 0,
        border: `${chromeScale}px solid rgba(37, 99, 235, 0.42)`,
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
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        outline: 'none',
        boxShadow: `0 0 0 ${chromeScale}px rgba(79, 124, 255, 0.55), 0 0 ${18 * chromeScale}px rgba(37, 99, 235, 0.22)`,
      }}
      value={value}
      spellCheck={false}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.value)}
      onBlur={() => {
        if (skipBlurCommitRef.current) return
        commit()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          skipBlurCommitRef.current = true
          onCancel()
          return
        }
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          commit()
        }
      }}
      aria-label="Edit translated text"
    />
  )
}
