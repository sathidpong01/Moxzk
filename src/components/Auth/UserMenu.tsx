import { useAuthStore } from '../../store/authStore'
import { useAlbumStore } from '../../store/albumStore'
import { LogIn, LogOut, User, FolderOpen } from 'lucide-react'

export default function UserMenu() {
  const { user, profile, signOut, setShowAuthModal } = useAuthStore()

  if (!user) {
    return (
      <button
        className="btn btn-ghost btn-xs gap-1.5"
        onClick={() => setShowAuthModal(true)}
      >
        <LogIn size={14} />
        <span className="hidden sm:inline">เข้าสู่ระบบ</span>
      </button>
    )
  }

  const displayName = profile?.username
    || user.user_metadata?.name
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'User'

  const avatarUrl = profile?.avatar_url
    || user.user_metadata?.avatar_url
    || user.user_metadata?.picture

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-xs gap-1.5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-5 h-5 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
            <User size={10} className="text-primary" />
          </div>
        )}
        <span className="hidden sm:inline text-xs max-w-[80px] truncate">
          {displayName}
        </span>
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content z-50 menu menu-sm floating-panel p-2 w-52 mt-2"
      >
        <li className="menu-title">
          <span className="text-xs truncate">{user.email}</span>
        </li>
        <li>
          <button className="gap-2" onClick={() => useAlbumStore.getState().openForBrowse()}>
            <FolderOpen size={14} /> อัลบั้มของฉัน
          </button>
        </li>
        <li>
          <button className="gap-2">
            <User size={14} /> โปรไฟล์
          </button>
        </li>
        <div className="divider my-0.5" />
        <li>
          <button className="gap-2 text-error" onClick={signOut}>
            <LogOut size={14} /> ออกจากระบบ
          </button>
        </li>
      </ul>
    </div>
  )
}
