import { AlertTriangle } from 'lucide-react'
import { Button, Modal } from '../ui/primitives'

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
  return (
    <Modal isOpen={open} onClose={onCancel} title={title} className="max-w-xs text-center">
        <AlertTriangle size={32} className={`mx-auto mb-3 ${variant === 'error' ? 'text-red-300' : variant === 'warning' ? 'text-yellow-300' : 'text-blue-300'}`} />
        <p className="mb-4 text-xs text-[var(--mg-muted)]">{message}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant === 'error' ? 'danger' : 'primary'} size="sm" className="flex-1" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
    </Modal>
  )
}
