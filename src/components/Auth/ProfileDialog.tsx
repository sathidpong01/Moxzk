import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Badge, Button, IconButton, Modal, TextInput } from '../ui/primitives'
import { useAuthStore } from '../../store/authStore'
import { useAlbumStore } from '../../store/albumStore'
import { useAppStore } from '../../store/appStore'
import {
  changePassword,
  deleteCurrentAccount,
  getProfile,
  revokeUserSessions,
  updateProfile,
  type UserAlbumSummary,
  type UserIdentity,
  type UserProfileResponse,
  type UserSessionInfo,
} from '../../services/cloudflareApi'
import {
  AtSign,
  ChevronRight,
  Check,
  Database,
  Eye,
  EyeOff,
  FolderOpen,
  Heart,
  ImageUp,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Settings2,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react'

type ProfileSection = 'profile' | 'email' | 'password' | 'albums' | 'security'

const PROFILE_SECTIONS: Array<{ value: ProfileSection; label: string; icon: ReactNode }> = [
  { value: 'profile', label: 'โปรไฟล์', icon: <User size={15} /> },
  { value: 'email', label: 'อีเมล', icon: <AtSign size={15} /> },
  { value: 'password', label: 'รหัสผ่าน', icon: <KeyRound size={15} /> },
  { value: 'albums', label: 'อัลบั้มของฉัน', icon: <FolderOpen size={15} /> },
  { value: 'security', label: 'ความปลอดภัย', icon: <ShieldCheck size={15} /> },
]

export default function ProfileDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, profile, fetchProfile, signOut } = useAuthStore()
  const [section, setSection] = useState<ProfileSection>('profile')
  const [data, setData] = useState<UserProfileResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSection('profile')
    setUsername(profile?.username ?? '')
    setAvatarUrl(profile?.avatar_url ?? '')
    setCurrentPassword('')
    setNewPassword('')
    setDeleteConfirm('')
    void refreshProfile()
  }, [isOpen, profile?.username, profile?.avatar_url])

  const identities = data?.identities ?? []
  const sessions = data?.sessions ?? []
  const visibleSessions = sessions.length > 0
    ? sessions
    : data
      ? [currentDeviceFallbackSession()]
      : []
  const albums = data?.albums ?? []
  const usage = data?.usage
  const hasPassword = identities.some((identity) => identity.provider === 'password')
  const currentSession = visibleSessions.find((session) => session.current)
  const displayEmail = user?.email ?? data?.user.email ?? ''
  const displayName = profile?.username || user?.user_metadata?.name || user?.user_metadata?.full_name || displayEmail

  async function refreshProfile() {
    setLoading(true)
    try {
      setData(await getProfile())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'โหลดโปรไฟล์ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveProfile(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await updateProfile({
        username: username.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      })
      await fetchProfile()
      await refreshProfile()
      toast.success('บันทึกโปรไฟล์แล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'บันทึกโปรไฟล์ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      toast.error('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว')
      return
    }
    setSaving(true)
    try {
      await changePassword({ currentPassword: currentPassword || undefined, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      await refreshProfile()
      toast.success(hasPassword ? 'เปลี่ยนรหัสผ่านแล้ว' : 'ตั้งรหัสผ่านแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(scope: 'others' | 'all', sessionId?: string) {
    setSaving(true)
    try {
      await revokeUserSessions({ scope, sessionId })
      await refreshProfile()
      toast.success(scope === 'all' ? 'ออกจากระบบทุกอุปกรณ์แล้ว' : 'ออกจากระบบอุปกรณ์อื่นแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ออกจากระบบอุปกรณ์อื่นไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    try {
      await deleteCurrentAccount(deleteConfirm)
      useAuthStore.setState({ user: null, session: null, profile: null, loading: false, showAuthModal: false, authError: null })
      toast.success('ลบบัญชีแล้ว')
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ลบบัญชีไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function handleOpenAlbums() {
    onClose()
    useAlbumStore.getState().openForBrowse()
  }

  async function handleOpenAlbum(albumId: string) {
    onClose()
    useAlbumStore.getState().openAlbumById(albumId)
  }

  async function handleSignOut() {
    await signOut()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="โปรไฟล์" hideHeader className="ProfileModal h-[min(700px,calc(100vh-2rem))] overflow-hidden p-0">
      <div className="grid h-full min-h-0 grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="ProfileModalSidebar flex min-h-0 flex-col px-5 py-5">
          <div className="truncate text-sm font-semibold text-[var(--moxzk-text)]">{displayEmail || 'Moxzk account'}</div>
          <div className="mt-2">
            {profile?.supporter_unlocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--moxzk-supporter-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--moxzk-supporter)]">
                <Heart size={10} className="fill-[var(--moxzk-supporter)]" /> Supporter
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[var(--moxzk-muted)] transition hover:bg-white/[0.10] hover:text-[var(--moxzk-text)]"
                onClick={() => { onClose(); setTimeout(() => useAppStore.getState().openSettingsAtTab('supporter'), 150) }}
              >
                <Settings2 size={10} /> Free · อัปเกรด
              </button>
            )}
          </div>
          <nav className="mt-6 space-y-2">
            {PROFILE_SECTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setSection(item.value)}
                className={`ProfileModalNavItem ${section === item.value ? 'ProfileModalNavItemActive' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                <ChevronRight size={14} className="shrink-0" />
              </button>
            ))}
          </nav>
          <button type="button" onClick={handleSignOut} className="ProfileModalLogout mt-auto">
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </aside>

        <main className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-center justify-between px-7 py-5">
            <h2 className="text-xl font-bold text-[var(--moxzk-text)]">{sectionTitle(section)}</h2>
            <div className="flex items-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin text-[var(--moxzk-muted)]" />}
              <IconButton label="ปิด" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">
            {section === 'profile' && (
              <ProfilePanel
                avatarUrl={avatarUrl}
                displayEmail={displayEmail}
                displayName={displayName}
                saving={saving}
                username={username}
                onAvatarUrlChange={setAvatarUrl}
                onSubmit={handleSaveProfile}
                onUsernameChange={setUsername}
              />
            )}
            {section === 'email' && <EmailPanel identities={identities} displayEmail={displayEmail} />}
            {section === 'password' && (
              <PasswordPanel
                currentPassword={currentPassword}
                hasPassword={hasPassword}
                newPassword={newPassword}
                saving={saving}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onSubmit={handleChangePassword}
              />
            )}
            {section === 'albums' && <AlbumsPanel albums={albums} loading={loading} usage={usage} onOpenAlbum={handleOpenAlbum} onOpenAlbums={handleOpenAlbums} />}
            {section === 'security' && (
              <SecurityPanel
                currentSessionId={currentSession?.id ?? null}
                deleteConfirm={deleteConfirm}
                displayEmail={displayEmail}
                saving={saving}
                hasStoredSessions={sessions.length > 0}
                sessions={visibleSessions}
                onDeleteConfirmChange={setDeleteConfirm}
                onDeleteAccount={handleDeleteAccount}
                onRevoke={handleRevoke}
              />
            )}
          </div>

        </main>
      </div>
    </Modal>
  )
}

function ProfilePanel({
  avatarUrl,
  displayEmail,
  displayName,
  saving,
  username,
  onAvatarUrlChange,
  onSubmit,
  onUsernameChange,
}: {
  avatarUrl: string
  displayEmail: string
  displayName: string
  saving: boolean
  username: string
  onAvatarUrlChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onUsernameChange: (value: string) => void
}) {
  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      <div className="flex items-center gap-4">
        <AvatarPreview src={avatarUrl} label={displayName || displayEmail || 'Moxzk'} />
        <Button type="button" variant="soft" onClick={() => document.getElementById('profile-avatar-file')?.click()}>
          <ImageUp size={15} /> เปลี่ยนรูป
        </Button>
        <input
          id="profile-avatar-file"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (!file) return
            try {
              onAvatarUrlChange(await readAvatarFile(file))
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'เลือกรูปโปรไฟล์ไม่สำเร็จ')
            }
          }}
        />
      </div>
      <FieldLine label="ชื่อที่แสดง">
        <TextInput value={username} onChange={(event) => onUsernameChange(event.currentTarget.value)} placeholder="satthidpong" className="ProfileModalInput" />
      </FieldLine>
      <Button type="submit" variant="primary" disabled={saving}>
        {saving ? <Loader2 size={15} className="animate-spin" /> : null}
        บันทึกโปรไฟล์
      </Button>
    </form>
  )
}

function EmailPanel({ identities, displayEmail }: { identities: UserIdentity[]; displayEmail: string }) {
  return (
    <div className="max-w-xl space-y-5">
      <FieldLine label="อีเมล">
        <TextInput value={displayEmail} readOnly className="ProfileModalInput" />
      </FieldLine>
      <p className="text-xs leading-5 text-[var(--moxzk-dim)]">ใช้อีเมลนี้สำหรับเข้าสู่ระบบและซิงก์งานของคุณ</p>
      <ProviderList identities={identities} />
    </div>
  )
}

function PasswordPanel({
  currentPassword,
  hasPassword,
  newPassword,
  saving,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSubmit,
}: {
  currentPassword: string
  hasPassword: boolean
  newPassword: string
  saving: boolean
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const passwordRules = getPasswordRules(newPassword)
  const passwordValid = passwordRules.minLength && passwordRules.hasLetter && passwordRules.hasNumber

  return (
    <form onSubmit={onSubmit} className="max-w-xl space-y-5">
      {hasPassword && (
        <FieldLine label="รหัสผ่านปัจจุบัน">
          <PasswordInput
            autoComplete="current-password"
            show={showCurrentPassword}
            value={currentPassword}
            onChange={onCurrentPasswordChange}
            onToggleShow={() => setShowCurrentPassword((show) => !show)}
          />
        </FieldLine>
      )}
      <FieldLine label="รหัสผ่านใหม่">
        <PasswordInput
          autoComplete="new-password"
          show={showNewPassword}
          value={newPassword}
          onChange={onNewPasswordChange}
          onToggleShow={() => setShowNewPassword((show) => !show)}
        />
      </FieldLine>
      <PasswordChecklist rules={passwordRules} />
      <Button type="submit" variant="primary" disabled={saving || !passwordValid}>
        {hasPassword ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน'}
      </Button>
    </form>
  )
}

function AlbumsPanel({
  albums,
  loading,
  usage,
  onOpenAlbum,
  onOpenAlbums,
}: {
  albums: UserAlbumSummary[]
  loading: boolean
  usage?: UserProfileResponse['usage']
  onOpenAlbum: (albumId: string) => void
  onOpenAlbums: () => void
}) {
  return (
    <div className="space-y-5">
      <UsageSummary usage={usage} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-[var(--moxzk-dim)]">เลือกอัลบั้มเพื่อเปิดดูหรือจัดการหน้าที่บันทึกไว้</p>
        <Button variant="soft" size="sm" onClick={onOpenAlbums}>
          <FolderOpen size={14} /> ดูทั้งหมด
        </Button>
      </div>
      <AlbumSummaryList albums={albums} onOpenAlbum={onOpenAlbum} loading={loading} />
    </div>
  )
}

function SecurityPanel({
  currentSessionId,
  deleteConfirm,
  displayEmail,
  hasStoredSessions,
  saving,
  sessions,
  onDeleteAccount,
  onDeleteConfirmChange,
  onRevoke,
}: {
  currentSessionId: string | null
  deleteConfirm: string
  displayEmail: string
  hasStoredSessions: boolean
  saving: boolean
  sessions: UserSessionInfo[]
  onDeleteAccount: (event: FormEvent) => void
  onDeleteConfirmChange: (value: string) => void
  onRevoke: (scope: 'others' | 'all', sessionId?: string) => void
}) {
  return (
    <div className="space-y-5">
      <section className="ProfileModalSection">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">อุปกรณ์ที่เข้าสู่ระบบ</div>
            <div className="text-xs text-[var(--moxzk-dim)]">{hasStoredSessions ? 'ตรวจสอบและออกจากระบบในเครื่องอื่นได้ที่นี่' : 'คุณกำลังใช้งานบัญชีนี้บนเครื่องนี้'}</div>
          </div>
          <Button variant="soft" size="sm" disabled={saving || !hasStoredSessions || sessions.length <= 1} onClick={() => onRevoke('others')}>
            ออกจากเครื่องอื่น
          </Button>
        </div>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <EmptyBlock icon={<KeyRound size={16} />} title="ยังไม่มีข้อมูลอุปกรณ์ให้แสดง" body="ข้อมูลอุปกรณ์จะปรากฏหลังจากโหลดโปรไฟล์สำเร็จ" />
          ) : sessions.map((session) => (
            <SessionRow key={session.id} session={session} currentSessionId={currentSessionId} onRevoke={(sessionId) => onRevoke('others', sessionId)} />
          ))}
        </div>
      </section>

      <form onSubmit={onDeleteAccount} className="ProfileModalDanger space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Trash2 size={15} /> ลบบัญชี
        </div>
        <p className="text-xs leading-5 opacity-85">เมื่อลบบัญชีแล้ว โปรไฟล์ อัลบั้ม รูปภาพ และงานที่บันทึกไว้จะถูกลบถาวร พิมพ์อีเมลของคุณเพื่อยืนยัน</p>
        <TextInput value={deleteConfirm} onChange={(event) => onDeleteConfirmChange(event.currentTarget.value)} placeholder={displayEmail || 'อีเมลของคุณ'} className="ProfileModalInput" />
        <Button type="submit" variant="danger" disabled={saving || !deleteConfirm}>
          ลบบัญชีถาวร
        </Button>
      </form>
    </div>
  )
}

function AvatarPreview({ src, label }: { src?: string | null; label: string }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06]">
      {src ? <img src={src} alt={label} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <User size={22} className="text-[var(--moxzk-muted)]" />}
    </div>
  )
}

function ProviderList({ identities }: { identities: UserIdentity[] }) {
  if (identities.length === 0) {
    return <EmptyBlock icon={<Link2 size={16} />} title="ยังไม่มีวิธีเข้าสู่ระบบที่ผูกไว้" body="ข้อมูลจะปรากฏหลังจากโหลดโปรไฟล์สำเร็จ" />
  }

  return (
    <div className="space-y-2">
      {identities.map((identity) => (
        <div key={identity.id} className="ProfileModalListRow">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 size={14} className="shrink-0 text-[var(--moxzk-muted)]" />
            <div className="min-w-0">
              <div className="text-sm font-bold capitalize">{identity.provider}</div>
              <div className="truncate text-xs text-[var(--moxzk-dim)]">{identity.email}</div>
            </div>
          </div>
          <Badge>{identity.provider === 'google' ? 'Google ID' : 'Password'}</Badge>
        </div>
      ))}
    </div>
  )
}

function AlbumSummaryList({ albums, onOpenAlbum, loading }: { albums: UserAlbumSummary[]; onOpenAlbum: (albumId: string) => void; loading: boolean }) {
  if (albums.length === 0) {
    return (
      <EmptyBlock
        icon={loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
        title={loading ? 'กำลังโหลดอัลบั้ม' : 'ยังไม่มีอัลบั้มในบัญชีนี้'}
        body={loading ? 'กำลังดึงข้อมูลบัญชีของคุณ' : 'เมื่อสร้างหรือบันทึกงานลงอัลบั้ม รายการจะขึ้นตรงนี้'}
      />
    )
  }

  return (
    <div className="grid gap-2">
      {albums.slice(0, 6).map((album) => (
        <button key={album.id} type="button" onClick={() => onOpenAlbum(album.id)} className="ProfileModalListRow text-left">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-[var(--moxzk-text)]">{album.title}</div>
            <div className="truncate text-xs text-[var(--moxzk-dim)]">
              {album.pageCount} หน้า · อัปเดต {formatDate(album.updatedAt)}
            </div>
          </div>
          <ChevronRight size={14} className="shrink-0 text-[var(--moxzk-muted)]" />
        </button>
      ))}
      {albums.length > 6 && (
        <div className="text-xs text-[var(--moxzk-dim)]">แสดง 6 อัลบั้มล่าสุดจากทั้งหมด {albums.length} อัลบั้ม</div>
      )}
    </div>
  )
}

function SessionRow({ session, currentSessionId, onRevoke }: { session: UserSessionInfo; currentSessionId: string | null; onRevoke: (sessionId: string) => void }) {
  const label = useMemo(() => session.userAgent?.slice(0, 80) || 'เครื่องนี้', [session.userAgent])
  return (
    <div className="ProfileModalListRow text-xs">
      <div className="min-w-0">
        <div className="truncate text-[var(--moxzk-text)]">{label}</div>
        <div className="text-[var(--moxzk-dim)]">{session.createdAt > 0 ? formatDate(session.createdAt) : 'กำลังใช้งานอยู่'} {session.current ? ' · เครื่องนี้' : ''}</div>
      </div>
      {session.id !== currentSessionId && !session.revokedAt && (
        <Button variant="ghost" size="sm" onClick={() => onRevoke(session.id)}>
          ออก
        </Button>
      )}
      {session.revokedAt && <Badge className="text-yellow-200">ออกจากระบบแล้ว</Badge>}
    </div>
  )
}

function UsageSummary({ usage }: { usage?: UserProfileResponse['usage'] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <Stat label="อัลบั้ม" value={usage?.albumCount ?? 0} />
      <Stat label="หน้า" value={usage?.pageCount ?? 0} />
      <Stat label="ไฟล์" value={usage?.objectCount ?? 0} />
      <Stat label="พื้นที่" value={formatBytes(usage?.storageBytes ?? 0)} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[8px] bg-white/[0.035] px-3 py-2">
      <div className="text-xs text-[var(--moxzk-dim)]">{label}</div>
      <div className="text-sm font-bold text-[var(--moxzk-text)]">{value}</div>
    </div>
  )
}

function EmptyBlock({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[8px] bg-black/20 px-3 py-3">
      <div className="mt-0.5 text-[var(--moxzk-muted)]">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-bold text-[var(--moxzk-text)]">{title}</div>
        <div className="text-xs leading-5 text-[var(--moxzk-dim)]">{body}</div>
      </div>
    </div>
  )
}

function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-bold text-[var(--moxzk-text)]">{label}</span>
      {children}
    </label>
  )
}

function sectionTitle(section: ProfileSection): string {
  if (section === 'profile') return 'โปรไฟล์'
  if (section === 'email') return 'อีเมล'
  if (section === 'password') return 'รหัสผ่าน'
  if (section === 'albums') return 'อัลบั้มของฉัน'
  return 'ความปลอดภัย'
}

function currentDeviceFallbackSession(): UserSessionInfo {
  return {
    id: 'current-device',
    current: true,
    userAgent: typeof navigator === 'undefined' ? 'เครื่องนี้' : navigator.userAgent,
    createdAt: Date.now(),
    expiresAt: 0,
    revokedAt: null,
  }
}

function PasswordInput({
  autoComplete,
  onChange,
  onToggleShow,
  show,
  value,
}: {
  autoComplete: string
  onChange: (value: string) => void
  onToggleShow: () => void
  show: boolean
  value: string
}) {
  return (
    <div className="relative">
      <TextInput
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        autoComplete={autoComplete}
        className="ProfileModalInput pr-10"
      />
      <button
        type="button"
        aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[7px] text-[var(--moxzk-muted)] hover:bg-white/[0.06] hover:text-[var(--moxzk-text)]"
        onClick={onToggleShow}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  )
}

interface PasswordRules {
  minLength: boolean
  hasLetter: boolean
  hasNumber: boolean
}

function PasswordChecklist({ rules }: { rules: PasswordRules }) {
  return (
    <div className="space-y-1.5 rounded-[8px] bg-white/[0.03] px-3 py-2 text-xs">
      <PasswordRule ok={rules.minLength}>อย่างน้อย 8 ตัวอักษร</PasswordRule>
      <PasswordRule ok={rules.hasLetter}>มีตัวอักษร</PasswordRule>
      <PasswordRule ok={rules.hasNumber}>มีตัวเลข</PasswordRule>
    </div>
  )
}

function PasswordRule({ children, ok }: { children: ReactNode; ok: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-emerald-300' : 'text-[var(--moxzk-muted)]'}`}>
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${ok ? 'bg-emerald-500/20' : 'bg-white/[0.06]'}`}>
        {ok ? <Check size={11} /> : null}
      </span>
      {children}
    </div>
  )
}

function getPasswordRules(password: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

async function readAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('เลือกไฟล์รูปภาพเท่านั้น')
  if (file.size > 5 * 1024 * 1024) throw new Error('รูปโปรไฟล์ต้องไม่เกิน 5 MB')
  const image = await loadImage(file)
  const canvas = document.createElement('canvas')
  const size = 256
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('ไม่สามารถเตรียมรูปโปรไฟล์ได้')
  const scale = Math.max(size / image.width, size / image.height)
  const width = image.width * scale
  const height = image.height * scale
  ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
  return canvas.toDataURL('image/webp', 0.82)
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('เปิดไฟล์รูปนี้ไม่ได้'))
    }
    image.src = url
  })
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString()
}
