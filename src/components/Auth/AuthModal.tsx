import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Mail, Lock, User, Loader2 } from 'lucide-react'
import { Button, Modal, TextInput } from '../ui/primitives'

type AuthMode = 'login' | 'signup'

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password, username || undefined)
      }
      setEmail('')
      setPassword('')
      setUsername('')
    } catch {
      // Error already toasted in store
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch {
      // Error already toasted
    }
  }

  return (
    <Modal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      title={mode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
      className="max-w-sm"
    >
        <div className="text-center mb-6">
          <p className="mt-1 text-sm text-[var(--moxzk-muted)]">
            {mode === 'login'
              ? 'เข้าสู่ระบบเพื่อบันทึกและจัดการอัลบั้ม'
              : 'สร้างบัญชีและเริ่มใช้งานได้ทันที'}
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="space-y-2 mb-4">
          <Button
            variant="soft"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={submitting}
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            ดำเนินการด้วย Google
          </Button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-[var(--moxzk-dim)]">
          <span className="h-px flex-1 bg-[var(--moxzk-border)]" />
          หรือใช้อีเมล
          <span className="h-px flex-1 bg-[var(--moxzk-border)]" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <label className="flex items-center gap-2 rounded-[7px] border border-[var(--moxzk-border)] bg-white/[0.045] px-3">
              <User size={14} className="text-[var(--moxzk-muted)]" />
              <TextInput
                type="text"
                className="grow border-0 bg-transparent px-0"
                placeholder="ชื่อผู้ใช้"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-2 rounded-[7px] border border-[var(--moxzk-border)] bg-white/[0.045] px-3">
            <Mail size={14} className="text-[var(--moxzk-muted)]" />
            <TextInput
              type="email"
              className="grow border-0 bg-transparent px-0"
              placeholder="อีเมล"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="flex items-center gap-2 rounded-[7px] border border-[var(--moxzk-border)] bg-white/[0.045] px-3">
            <Lock size={14} className="text-[var(--moxzk-muted)]" />
            <TextInput
              type="password"
              className="grow border-0 bg-transparent px-0"
              placeholder="รหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={submitting || !email || !password}
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === 'login' ? (
              'เข้าสู่ระบบ'
            ) : (
              'สมัครสมาชิก'
            )}
          </Button>
        </form>

        {/* Switch mode */}
        <p className="mt-4 text-center text-sm text-[var(--moxzk-muted)]">
          {mode === 'login' ? (
            <>
              ยังไม่มีบัญชี?{' '}
              <button
                className="font-medium text-blue-300 hover:underline"
                onClick={() => setMode('signup')}
              >
                สมัครสมาชิก
              </button>
            </>
          ) : (
            <>
              มีบัญชีแล้ว?{' '}
              <button
                className="font-medium text-blue-300 hover:underline"
                onClick={() => setMode('login')}
              >
                เข้าสู่ระบบ
              </button>
            </>
          )}
        </p>
    </Modal>
  )
}
