import type { Album } from '../../types/database'
import { FolderOpen, Trash2, MoreVertical, Clock, Languages } from 'lucide-react'

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
    <div
      className="group card card-compact bg-base-200/50 hover:bg-base-200 border border-base-300/50 hover:border-primary/30 transition-all cursor-pointer"
      onClick={() => onOpen(album)}
    >
      {/* Cover area */}
      <figure className="h-28 bg-base-300/50 flex items-center justify-center overflow-hidden">
        {album.cover_key && (album.cover_key as string).startsWith('data:') ? (
          <img
            src={album.cover_key as string}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <FolderOpen size={32} className="text-base-content/20" />
        )}
      </figure>

      <div className="card-body gap-1 p-3">
        <h3 className="font-bold text-sm truncate">{album.title}</h3>
        {album.description && (
          <p className="text-xs text-base-content/50 truncate">{album.description}</p>
        )}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2 text-[10px] text-base-content/40">
            <span className="flex items-center gap-0.5">
              <Clock size={10} />
              {timeAgo(album.updated_at)}
            </span>
            <span className="flex items-center gap-0.5">
              <Languages size={10} />
              {LANG_LABELS[album.source_lang] ?? album.source_lang}
            </span>
          </div>

          {/* Actions dropdown */}
          <div className="dropdown dropdown-end" onClick={(e) => e.stopPropagation()}>
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-xs btn-square opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical size={12} />
            </div>
            <ul tabIndex={0} className="dropdown-content z-50 menu menu-xs floating-panel p-1 w-32">
              <li>
                <button
                  className="text-error gap-1"
                  onClick={() => onDelete(album.id)}
                >
                  <Trash2 size={12} /> ลบอัลบั้ม
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
