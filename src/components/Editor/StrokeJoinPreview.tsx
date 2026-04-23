import type { ReactNode } from 'react'
import type { TextStrokeJoin } from '../../types'
import { TooltipSurface, cn } from '../ui/primitives'

const STROKE_JOIN_LABELS: Record<TextStrokeJoin, string> = {
  round: 'ขอบมน',
  bevel: 'ตัดมุม',
  miter: 'มุมคม',
}

const STROKE_JOIN_VALUES: TextStrokeJoin[] = ['round', 'bevel', 'miter']

export function getStrokeJoinLabel(join: TextStrokeJoin): string {
  return STROKE_JOIN_LABELS[join]
}

export function StrokeJoinPreviewIcon({
  join,
  className,
}: {
  join: TextStrokeJoin
  className?: string
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <path
        d="M15 5H8V15"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinejoin={join}
        strokeLinecap="butt"
        strokeMiterlimit="10"
      />
    </svg>
  )
}

export function StrokeJoinPreviewLabel({
  join,
  className,
}: {
  join: TextStrokeJoin
  className?: string
}): ReactNode {
  return (
    <span className={cn('flex w-full items-center justify-center', className)}>
      <StrokeJoinPreviewIcon join={join} />
      <span className="sr-only">{getStrokeJoinLabel(join)}</span>
    </span>
  )
}

export function StrokeJoinToggleGroup({
  value,
  onChange,
  className,
  iconClassName,
  tooltipSide = 'top',
  size = 'md',
}: {
  value: TextStrokeJoin
  onChange: (value: TextStrokeJoin) => void
  className?: string
  iconClassName?: string
  tooltipSide?: 'top' | 'bottom'
  size?: 'sm' | 'md'
}) {
  const buttonSizeClass = size === 'sm' ? 'h-8 w-8 rounded-[8px]' : 'h-9 w-9 rounded-[12px]'

  return (
    <div role="group" aria-label="ทรงขอบ" className={cn('flex items-center gap-1', className)}>
      {STROKE_JOIN_VALUES.map((join) => {
        const active = value === join
        return (
          <TooltipSurface key={join} label={getStrokeJoinLabel(join)} side={tooltipSide}>
            <button
              type="button"
              className={cn(
                'flex items-center justify-center bg-transparent text-[var(--mg-muted)] transition hover:bg-white/[0.08] hover:text-[var(--mg-text)]',
                buttonSizeClass,
                active && 'bg-[var(--mg-accent)] text-white hover:bg-[var(--mg-accent)] hover:text-white',
              )}
              onClick={() => onChange(join)}
              aria-label={getStrokeJoinLabel(join)}
              aria-pressed={active}
            >
              <StrokeJoinPreviewIcon join={join} className={cn('h-[18px] w-[18px]', iconClassName)} />
            </button>
          </TooltipSurface>
        )
      })}
    </div>
  )
}
