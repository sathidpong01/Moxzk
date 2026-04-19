import { useEffect, useMemo, useRef } from 'react'
import { Check } from 'lucide-react'
import {
  getInlineTextEditorTheme,
  type InlineTextEditorCommitMetrics,
} from '../../services/inlineTextEditor'
import type { TextLayoutMode } from '../../types'
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
  align: 'left' | 'center'
  layoutMode: TextLayoutMode
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
  layoutMode,
  onChange,
  onCommit,
  onCancel,
}: InlineTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skipBlurCommitRef = useRef(false)
  const committedRef = useRef(false)
  const theme = getInlineTextEditorTheme(color)
  const isArtistic = layoutMode === 'artistic'
  const displayFontSize = Math.max(1, fontSize)
  const lineHeight = 1.18
  const chromeScale = 1 / Math.max(0.1, viewportZoom)
  const confirmButtonSize = 28 * chromeScale
  const confirmButtonOffset = -8 * chromeScale
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
  const commit = () => {
    if (committedRef.current) return
    committedRef.current = true
    const textarea = textareaRef.current
    onCommit({
      width: textarea?.offsetWidth ?? width,
      height: textarea?.offsetHeight ?? height,
      scrollWidth: textarea?.scrollWidth,
      scrollHeight: textarea?.scrollHeight,
      layoutMode,
    })
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height,
        minWidth: width,
        minHeight: height,
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
          width,
          height,
          minWidth: width,
          minHeight: height,
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
          overflow: isArtistic ? 'auto' : 'hidden',
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
      <button
        type="button"
        className="mg-inline-text-confirm"
        style={{
          position: 'absolute',
          right: confirmButtonOffset,
          bottom: confirmButtonOffset,
          zIndex: 2,
          width: confirmButtonSize,
          height: confirmButtonSize,
          minWidth: confirmButtonSize,
          minHeight: confirmButtonSize,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `${chromeScale}px solid rgba(147, 197, 253, 0.46)`,
          borderRadius: 7 * chromeScale,
          padding: 0,
          background: 'var(--mg-accent)',
          color: '#ffffff',
          boxShadow: `0 ${6 * chromeScale}px ${18 * chromeScale}px rgba(0, 0, 0, 0.35)`,
          cursor: 'pointer',
        }}
        aria-label="ยืนยัน"
        title="ยืนยัน"
        onPointerDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onMouseDown={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          commit()
        }}
      >
        <Check size={14 * chromeScale} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  )
}
