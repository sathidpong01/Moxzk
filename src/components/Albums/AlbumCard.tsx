import type { Album } from '../../types/database'
import { BookOpen, Clock3, Languages, Settings2 } from 'lucide-react'
import { LazyThumbnail } from './LazyThumbnail'

interface AlbumCardProps {
  album: Album
  mode?: 'browse' | 'save'
  onOpen: (album: Album) => void
  onManage: (album: Album) => void
}

const LANG_LABELS: Record<string, string> = {
  ja: 'ญี่ปุ่น',
  zh: 'จีน',
  en: 'อังกฤษ',
  auto: 'อัตโนมัติ',
}

export function formatAlbumTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'เมื่อสักครู่'
  if (mins < 60) return `${mins} นาทีที่แล้ว`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ชม.ที่แล้ว`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} วันที่แล้ว`
  return new Date(dateStr).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

export function describeAlbumSourceLanguage(sourceLang?: string | null): string {
  if (!sourceLang) return 'ยังไม่ได้ระบุภาษา'
  return LANG_LABELS[sourceLang] ?? sourceLang.toUpperCase()
}

export default function AlbumCard({ album, mode = 'browse', onOpen, onManage }: AlbumCardProps) {
  const actionLabel = mode === 'save' ? 'บันทึกงานลงอัลบั้มนี้' : 'เปิดอัลบั้มในตัวแก้ไข'
  const sourceLabel = describeAlbumSourceLanguage(album.source_lang)
  const primaryButtonLabel = mode === 'save' ? 'บันทึกลงอัลบั้ม' : 'เปิดต่อ'
  const secondaryButtonLabel = 'รายละเอียด'

  return (
    <article
      aria-label={`${actionLabel}: ${album.title}`}
      className="group relative flex h-full flex-col overflow-visible rounded-[18px] bg-transparent transition duration-200 hover:-translate-y-1"
    >
      <figure className="relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[16px] border border-white/10 bg-[#0b0b0b] shadow-[0_18px_44px_rgba(0,0,0,0.3)]">
        {album.cover_key ? (
          <LazyThumbnail
            src={album.cover_key as string}
            alt={album.title}
            className="h-full w-full"
            imgClassName="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#111111] text-[var(--moxzk-dim)]">
            <BookOpen size={30} />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--moxzk-muted)]">No cover</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%,rgba(0,0,0,0.08)_56%,rgba(0,0,0,0.76)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-semibold text-white/90 backdrop-blur">
            <Clock3 size={11} className="text-white/70" />
            {formatAlbumTimeAgo(album.updated_at)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[var(--moxzk-accent)] px-2 py-1 text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.32)]">
            <Languages size={11} className="text-white/85" />
            <span className="truncate">{sourceLabel}</span>
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <h3 className="line-clamp-3 text-[1.05rem] font-extrabold uppercase leading-5 tracking-[0.01em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]" title={album.title}>
                {album.title}
              </h3>
            </div>
          </div>
        </div>
      </figure>

      <div className="flex flex-1 flex-col gap-3 px-1 pb-1 pt-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            className="moxzk-button moxzk-button-primary moxzk-button-sm min-w-0 rounded-[12px] px-3"
            onClick={(event) => {
              event.stopPropagation()
              onOpen(album)
            }}
          >
            <span className="truncate">{primaryButtonLabel}</span>
          </button>
          <button
            type="button"
            className="moxzk-button moxzk-button-soft moxzk-button-sm rounded-[12px] border-white/10 bg-white/[0.04] px-3 hover:bg-white/[0.08]"
            onClick={(event) => {
              event.stopPropagation()
              onManage(album)
            }}
          >
            <Settings2 size={12} />
            {secondaryButtonLabel}
          </button>
        </div>
      </div>
    </article>
  )
}
