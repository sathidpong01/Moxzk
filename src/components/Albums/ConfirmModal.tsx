import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'error' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT_BTN: Record<string, string> = {
  error: 'btn-error',
  warning: 'btn-warning',
  info: 'btn-info',
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  variant = 'error',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-110 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative floating-panel w-full max-w-xs mx-4 p-5 panel-enter text-center">
        <AlertTriangle size={32} className={`mx-auto mb-3 ${variant === 'error' ? 'text-error' : variant === 'warning' ? 'text-warning' : 'text-info'}`} />
        <h3 className="font-bold text-sm mb-1">{title}</h3>
        <p className="text-xs text-base-content/60 mb-4">{message}</p>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm flex-1" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn btn-sm flex-1 ${VARIANT_BTN[variant]}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
