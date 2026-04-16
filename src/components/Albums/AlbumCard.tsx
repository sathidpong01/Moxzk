import type { Album } from '../../types/database'
import { Trash2, MoreVertical, Clock, Languages, BookOpen } from 'lucide-react'
import { DropdownItem, DropdownMenu, IconButton } from '../ui/primitives'

interface AlbumCardProps {
  album: Album
  onOpen: (album: Album) => void
  onDelete: (id: string) => void
}

const LANG_LABELS: Record<string, string> = {
  ja: '🇯🇵 JP',
  zh: '🇨🇳 ZH',
  en: '🇺🇸 EN',
  auto: '🔍 Auto',
}

function timeAgo(dateStr: string): string {
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

export default function AlbumCard({ album, onOpen, onDelete }: AlbumCardProps) {
  return (
    <article
      className="group cursor-pointer rounded-[8px] border border-white/10 bg-[#181818] p-2 transition duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#1f1f1f]"
      onClick={() => onOpen(album)}
    >
      <figure className="relative flex aspect-[2/3] items-center justify-center overflow-hidden rounded-[6px] border border-white/10 bg-[#0b0b0b]">
        {album.cover_key && (album.cover_key as string).startsWith('data:') ? (
          <img
            src={album.cover_key as string}
            alt={album.title}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[var(--mg-dim)]">
            <BookOpen size={34} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em]">No cover</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" />

        <div onClick={(e) => e.stopPropagation()} className="absolute right-1.5 top-1.5">
          <DropdownMenu
            trigger={(
              <IconButton label="Album actions" className="h-7 w-7 bg-black/70 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <MoreVertical size={12} />
              </IconButton>
            )}
            className="w-32"
          >
            <DropdownItem className="text-red-300" onClick={() => onDelete(album.id)}>
              <Trash2 size={12} /> ลบอัลบั้ม
            </DropdownItem>
          </DropdownMenu>
        </div>
      </figure>

      <div className="space-y-2 px-1 pb-1 pt-2">
        <h3 className="truncate text-sm font-bold text-[var(--mg-text)]" title={album.title}>{album.title}</h3>
        {album.description && (
          <p className="line-clamp-2 min-h-8 text-xs leading-4 text-[var(--mg-muted)]">{album.description}</p>
        )}
        {!album.description && (
          <p className="min-h-8 text-xs leading-4 text-[var(--mg-dim)]">ยังไม่มีคำอธิบาย</p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[10px] text-[var(--mg-dim)]">
          <span className="flex min-w-0 items-center gap-1">
            <Clock size={10} className="shrink-0" />
            <span className="truncate">{timeAgo(album.updated_at)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Languages size={10} />
            {LANG_LABELS[album.source_lang] ?? album.source_lang}
          </span>
        </div>
      </div>
    </article>
  )
}
