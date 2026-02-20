import { useEffect, useRef } from 'react'

function getLogStyle(log: string): string {
  const lower = log.toLowerCase()
  if (lower.includes('error') || lower.includes('ผิดพลาด'))
    return 'bg-red-900/40 text-red-200 border-l-2 border-red-500'
  if (lower.includes('เสร็จ') || lower.includes('finished') || lower.includes('done') || lower.includes('complete'))
    return 'bg-green-900/40 text-green-200 border-l-2 border-green-500'
  if (lower.includes('[queue]') || lower.includes('[waiting]') || lower.includes('คิว'))
    return 'bg-yellow-900/40 text-yellow-200 border-l-2 border-yellow-500'
  if (lower.includes('[progress]') || lower.includes('กำลัง') || lower.includes('ocr') || lower.includes('gemini'))
    return 'bg-blue-900/40 text-blue-200 border-l-2 border-blue-500'
  return 'text-base-content/70'
}

export default function LogPanel({ logs }: { logs: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  return (
    <div className="floating-panel-sm p-2 h-full flex flex-col min-h-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-base-content/50 mb-1 shrink-0">
        Logs ({logs.length})
      </h3>
      {logs.length === 0 && (
        <p className="text-xs text-base-content/30 text-center py-4">ยังไม่มี log — กด AI Process เพื่อเริ่ม</p>
      )}
      <div className="overflow-y-auto flex-1 min-h-0 text-xs font-mono space-y-0.5">
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
