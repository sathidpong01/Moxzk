import { useEffect, useState } from 'react'
import { Download, Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { getAppRuntime } from '../../runtime'
import type { RuntimeUpdateStatus } from '../../runtime'
import { Button } from '../ui/primitives'

interface UpdateRestartPromptProps {
  busy: boolean
}

export default function UpdateRestartPrompt({ busy }: UpdateRestartPromptProps) {
  const appRuntime = getAppRuntime()
  const [status, setStatus] = useState<RuntimeUpdateStatus | null>(null)
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    let mounted = true
    void appRuntime.updates.getStatus()
      .then((next) => {
        if (mounted) setStatus(next)
      })
      .catch(() => {})
    const unsubscribe = appRuntime.updates.onStatusChange(setStatus)
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [appRuntime.updates])

  // Reset the dismissed flag only when a genuinely new version appears, not on
  // every periodic status poll that still reports the same version.
  useEffect(() => {
    setDismissedVersion(null)
  }, [status?.version])

  // The prompt appears as soon as an update is being downloaded so the user is
  // notified immediately, then turns into a restart action once it is ready.
  const isDownloading = status?.state === 'available' || status?.state === 'downloading'
  const isDownloaded = status?.state === 'downloaded'
  if (!status || (!isDownloading && !isDownloaded)) return null
  // The "later" dismissal only applies to the actionable (downloaded) prompt;
  // the download-in-progress notice is informational and not dismissable.
  if (isDownloaded && dismissedVersion === status.version) return null

  const handleInstall = async () => {
    if (busy) return
    setInstalling(true)
    try {
      const result = await appRuntime.updates.installDownloadedUpdate()
      if (!result.ok) {
        toast.error(result.error ?? 'ติดตั้งอัปเดตไม่สำเร็จ')
        setInstalling(false)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ติดตั้งอัปเดตไม่สำเร็จ')
      setInstalling(false)
    }
  }

  return (
    <aside className="moxzk-update-prompt" aria-live="polite" aria-label="อัปเดต Moxzk">
      <div className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-white/8 text-[var(--moxzk-text)]">
        {isDownloaded ? <Download size={16} /> : <Loader2 size={16} className="animate-spin" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-[var(--moxzk-text)]">มี Moxzk เวอร์ชันใหม่</p>
        <p className="mt-1 text-xs leading-5 text-[var(--moxzk-muted)]">
          {isDownloading
            ? `กำลังดาวน์โหลด ${status.version ?? 'เวอร์ชันใหม่'} อยู่เบื้องหลัง`
            : busy
              ? 'ดาวน์โหลดเสร็จแล้ว จบงานที่กำลังทำอยู่ก่อนแล้วค่อยรีสตาร์ท'
              : `ดาวน์โหลด ${status.version ?? 'เวอร์ชันใหม่'} เสร็จแล้ว รีสตาร์ทเมื่อต้องการติดตั้ง`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isDownloaded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDismissedVersion(status.version ?? 'unknown')}
          >
            ภายหลัง
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={handleInstall}
          disabled={isDownloading || busy || installing}
          title={
            isDownloading
              ? 'กำลังดาวน์โหลด รอสักครู่'
              : busy
                ? 'รอให้งานที่กำลังทำอยู่เสร็จก่อน'
                : undefined
          }
        >
          {installing || isDownloading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RotateCcw size={13} />
          )}
          รีสตาร์ท
        </Button>
      </div>
    </aside>
  )
}
