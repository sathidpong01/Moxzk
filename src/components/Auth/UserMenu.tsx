import { useAuthStore } from '../../store/authStore'
import { useAlbumStore } from '../../store/albumStore'
import { LogIn, LogOut, User, FolderOpen } from 'lucide-react'
import { Button, DropdownItem, DropdownMenu } from '../ui/primitives'

export default function UserMenu() {
  const { user, profile, signOut, setShowAuthModal } = useAuthStore()

  if (!user) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowAuthModal(true)}
      >
        <LogIn size={14} />
        <span className="hidden sm:inline">เข้าสู่ระบบ</span>
      </Button>
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
    <DropdownMenu
      trigger={(
        <button className="mg-button mg-button-ghost mg-button-sm px-2" aria-label={displayName}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="h-5 w-5 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20">
            <User size={10} className="text-blue-300" />
          </div>
        )}
        </button>
      )}
      className="w-52"
    >
      <div className="px-2 py-1 text-xs text-[var(--mg-dim)] truncate">{user.email}</div>
      <DropdownItem onClick={() => useAlbumStore.getState().openForBrowse()}>
        <FolderOpen size={14} /> อัลบั้มของฉัน
      </DropdownItem>
      <DropdownItem>
        <User size={14} /> โปรไฟล์
      </DropdownItem>
      <div className="my-1 h-px bg-[var(--mg-border)]" />
      <DropdownItem className="text-red-300" onClick={signOut}>
        <LogOut size={14} /> ออกจากระบบ
      </DropdownItem>
    </DropdownMenu>
  )
}
