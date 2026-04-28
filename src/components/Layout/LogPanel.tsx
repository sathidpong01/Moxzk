import { useEffect, useRef } from 'react'

function getLogStyle(log: string): string {
  const lower = log.toLowerCase()
  if (lower.includes('error') || lower.includes('ผิดพลาด'))
    return 'bg-red-900/40 text-red-200 border-l-2 border-red-500'
  if (lower.includes('เสร็จ') || lower.includes('finished') || lower.includes('done') || lower.includes('complete'))
    return 'bg-green-900/40 text-green-200 border-l-2 border-green-500'
  if (lower.includes('[queue]') || lower.includes('[waiting]') || lower.includes('คิว'))
    return 'bg-yellow-900/40 text-yellow-200 border-l-2 border-yellow-500'
  if (lower.includes('[progress]') || lower.includes('กำลัง') || lower.includes('ocr') || lower.includes('ollama'))
    return 'bg-blue-900/40 text-blue-200 border-l-2 border-blue-500'
  return 'text-[var(--moxzk-muted)]'
}

export default function LogPanel({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  return (
    <div className="floating-panel-sm flex h-full min-h-0 flex-col p-2">
      <h3 className="mb-1 shrink-0 text-xs font-bold uppercase tracking-wider text-[var(--moxzk-muted)]">
        บันทึกระบบ ({logs.length})
      </h3>
      {logs.length === 0 && (
        <p className="py-4 text-center text-xs text-[var(--moxzk-dim)]">ยังไม่มีบันทึกระบบ กด AI แปลเพื่อเริ่ม</p>
      )}
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={`leading-tight rounded px-1.5 py-0.5 ${getLogStyle(log)}`}>
            <span className="opacity-40 mr-1">{i + 1}</span>
            {log}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
