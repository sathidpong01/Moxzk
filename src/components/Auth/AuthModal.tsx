import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useAuthStore, type AuthUiError } from '../../store/authStore'
import { AlertTriangle, Check, Eye, EyeOff, Loader2, ShieldCheck, X } from 'lucide-react'
import { Button, IconButton, Modal, TextInput } from '../ui/primitives'

type AuthMode = 'login' | 'signup' | 'recovery'
type NoticeTone = 'error' | 'warning' | 'info'

export default function AuthModal() {
  const {
    showAuthModal,
    setShowAuthModal,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    authError,
    clearAuthError,
  } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [googlePending, setGooglePending] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null)
  const [remainingSec, setRemainingSec] = useState<number | null>(null)

  useEffect(() => {
    if (!showAuthModal) return
    setMode('login')
    setEmail('')
    setPassword('')
    setUsername('')
    setShowPassword(false)
    setCapsLockOn(false)
    setAgreedToTerms(false)
    setSubmitting(false)
    setGoogleSubmitting(false)
    setGooglePending(false)
    setSubmitAttempted(false)
    setBlockedUntil(null)
    setRemainingSec(null)
    clearAuthError()
  }, [showAuthModal, clearAuthError])

  useEffect(() => {
    const nextBlockedUntil = getBlockedUntil(authError)
    setBlockedUntil(nextBlockedUntil)
    setRemainingSec(nextBlockedUntil ? Math.max(0, Math.ceil((nextBlockedUntil - Date.now()) / 1000)) : null)
  }, [authError])

  useEffect(() => {
    if (!blockedUntil) return
    const interval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000))
      setRemainingSec(next)
      if (next <= 0) window.clearInterval(interval)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [blockedUntil])

  const trimmedEmail = email.trim()
  const emailValid = isValidEmail(trimmedEmail)
  const passwordRules = useMemo(() => getPasswordRules(password, trimmedEmail), [password, trimmedEmail])
  const passwordValid = mode === 'signup'
    ? passwordRules.minLength && passwordRules.hasLetter && passwordRules.hasNumber
    : password.length >= 8
  const showEmailError = (submitAttempted || email.length > 0) && !emailValid
  const showPasswordError = submitAttempted && mode !== 'recovery' && !passwordValid
  const isBlocked = remainingSec != null && remainingSec > 0
  const canSubmit = mode !== 'recovery'
    && emailValid
    && passwordValid
    && (mode !== 'signup' || agreedToTerms)
    && !isBlocked
    && !submitting
    && !googleSubmitting
  const notice = getAuthNotice(authError, mode, remainingSec)

  const resetInlineState = () => {
    setSubmitAttempted(false)
    clearAuthError()
  }

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setPassword('')
    setShowPassword(false)
    setCapsLockOn(false)
    resetInlineState()
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitAttempted(true)
    if (!canSubmit) return
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signInWithEmail(trimmedEmail, password)
      } else if (mode === 'signup') {
        await signUpWithEmail(trimmedEmail, password, username.trim() || undefined)
      }
      setEmail('')
      setPassword('')
      setUsername('')
    } catch {
      // Inline auth notice is driven by authStore.authError.
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleSubmitting(true)
    setGooglePending(true)
    clearAuthError()
    try {
      await signInWithGoogle()
    } catch {
      setGooglePending(false)
    } finally {
      setGoogleSubmitting(false)
    }
  }

  const handlePasswordKeyEvent = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState('CapsLock'))
  }

  return (
    <Modal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      title="บัญชี Moxzk"
      hideHeader
      className="AuthModal overflow-hidden p-0"
    >
      <div key={mode} className="AuthModalContent relative">
        <IconButton label="ปิด" className="absolute right-5 top-5" onClick={() => setShowAuthModal(false)}>
          <X size={16} />
        </IconButton>

        <AuthHeading mode={mode} />

        <div className="mt-8 space-y-4">
          <GoogleAuthButton
            pending={googlePending}
            submitting={googleSubmitting}
            disabled={submitting}
            onClick={handleGoogleLogin}
          />
          <AuthDivider />
        </div>

        {notice && (
          <div className="mt-5">
            <AuthErrorNotice notice={notice} onAction={notice.action === 'switch-login' ? () => switchMode('login') : undefined} />
          </div>
        )}

        {mode === 'recovery' ? (
          <RecoveryPanel
            email={email}
            emailValid={emailValid}
            showEmailError={showEmailError}
            onEmailChange={(value) => {
              setEmail(value)
              resetInlineState()
            }}
            onSubmitAttempt={() => setSubmitAttempted(true)}
          />
        ) : (
          <EmailPasswordForm
            mode={mode}
                email={email}
                password={password}
                showPassword={showPassword}
            capsLockOn={capsLockOn}
            submitting={submitting}
            canSubmit={canSubmit}
            showEmailError={showEmailError}
            showPasswordError={showPasswordError}
            passwordRules={passwordRules}
            requiresChallenge={authError?.requiresChallenge ?? false}
            agreedToTerms={agreedToTerms}
            onAgreedToTermsChange={setAgreedToTerms}
            onSubmit={handleSubmit}
            onEmailChange={(value) => {
              setEmail(value)
              resetInlineState()
            }}
            onPasswordChange={(value) => {
              setPassword(value)
              resetInlineState()
            }}
                onTogglePassword={() => setShowPassword((value) => !value)}
            onPasswordKeyEvent={handlePasswordKeyEvent}
            onSwitchRecovery={() => switchMode('recovery')}
          />
        )}

        <AuthModeSwitch mode={mode} onChange={switchMode} />
      </div>
    </Modal>
  )
}

function AuthHeading({ mode }: { mode: AuthMode }) {
  if (mode === 'signup') {
    return (
      <div className="pr-9 text-center">
        <h1 className="text-2xl font-extrabold text-[var(--moxzk-text)]">สมัครสมาชิก Moxzk</h1>
        <p className="mt-2 text-sm text-[var(--moxzk-muted)]">สร้างบัญชีเพื่อเก็บอัลบั้มและเปิดงานต่อได้ทุกครั้ง</p>
      </div>
    )
  }

  if (mode === 'recovery') {
    return (
      <div className="pr-9">
        <h1 className="text-2xl font-extrabold text-[var(--moxzk-text)]">กู้บัญชี</h1>
        <p className="mt-2 text-sm text-[var(--moxzk-muted)]">กรอกอีเมลของคุณ หรือใช้ Google ถ้าบัญชีเคยเชื่อมไว้</p>
      </div>
    )
  }

  return (
    <div className="pr-9">
      <h1 className="text-2xl font-extrabold text-[var(--moxzk-text)]">เข้าสู่ระบบ</h1>
      <p className="mt-2 text-sm text-[var(--moxzk-muted)]">กลับมาเปิดอัลบั้มและงานแปลของคุณต่อ</p>
    </div>
  )
}

function GoogleAuthButton({
  pending,
  submitting,
  disabled,
  onClick,
}: {
  pending: boolean
  submitting: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="AuthSocialButton"
        onClick={onClick}
        disabled={disabled || submitting}
      >
        {submitting ? <Loader2 size={18} className="animate-spin" /> : <GoogleIcon />}
        {submitting ? 'กำลังเปิด Google...' : 'ดำเนินการด้วย Google'}
      </button>
      {pending && (
        <div className="flex items-start gap-2 rounded-[8px] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-[var(--moxzk-muted)]">
          <ShieldCheck size={14} className="mt-0.5 shrink-0 text-green-300" />
          <span className="text-pretty">รอการยืนยันจากเบราว์เซอร์ แอปจะกลับมาอัตโนมัติเมื่อเข้าสู่ระบบเสร็จ</span>
        </div>
      )}
    </div>
  )
}

function EmailPasswordForm({
  mode,
  email,
  password,
  showPassword,
  capsLockOn,
  submitting,
  canSubmit,
  showEmailError,
  showPasswordError,
  passwordRules,
  requiresChallenge,
  agreedToTerms,
  onAgreedToTermsChange,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onPasswordKeyEvent,
  onSwitchRecovery,
}: {
  mode: Exclude<AuthMode, 'recovery'>
  email: string
  password: string
  showPassword: boolean
  capsLockOn: boolean
  submitting: boolean
  canSubmit: boolean
  showEmailError: boolean
  showPasswordError: boolean
  passwordRules: PasswordRules
  requiresChallenge: boolean
  agreedToTerms: boolean
  onAgreedToTermsChange: (value: boolean) => void
  onSubmit: (event: FormEvent) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onPasswordKeyEvent: (event: KeyboardEvent<HTMLInputElement>) => void
  onSwitchRecovery: () => void
}) {
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
      <AuthField label={mode === 'signup' ? 'อีเมลของคุณ' : 'อีเมล'}>
        <TextInput
          type="email"
          className="AuthInput"
          placeholder="อีเมล"
          value={email}
          onChange={(event) => onEmailChange(event.currentTarget.value)}
          required
          autoComplete="email"
          aria-invalid={showEmailError}
        />
        {showEmailError && <FieldError>กรอกอีเมลให้ถูกต้อง</FieldError>}
      </AuthField>

      <AuthField
        label={mode === 'signup' ? 'รหัสผ่าน' : 'รหัสผ่าน'}
        action={mode === 'login' ? (
          <button type="button" className="AuthInlineLink" onClick={onSwitchRecovery}>
            ลืมรหัสผ่าน?
          </button>
        ) : null}
      >
        <div className="relative">
          <TextInput
            type={showPassword ? 'text' : 'password'}
            className="AuthInput pr-11"
            placeholder="รหัสผ่าน"
            value={password}
            onChange={(event) => onPasswordChange(event.currentTarget.value)}
            onKeyDown={onPasswordKeyEvent}
            onKeyUp={onPasswordKeyEvent}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            aria-invalid={showPasswordError}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[7px] text-[var(--moxzk-muted)] transition hover:bg-white/[0.06] hover:text-[var(--moxzk-text)]"
            onClick={onTogglePassword}
            aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {capsLockOn && (
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-yellow-200">
            <AlertTriangle size={12} /> Caps Lock เปิดอยู่
          </div>
        )}
        {mode === 'signup' ? (
          <PasswordChecklist rules={passwordRules} />
        ) : showPasswordError ? (
          <FieldError>รหัสผ่านต้องมีอย่างน้อย 8 ตัว</FieldError>
        ) : null}
      </AuthField>

      {mode === 'signup' && (
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-500"
            checked={agreedToTerms}
            onChange={(e) => onAgreedToTermsChange(e.currentTarget.checked)}
          />
          <span className="text-xs leading-5 text-[var(--moxzk-muted)]">
            ฉันยอมรับ{' '}
            <a
              href="/terms.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 underline underline-offset-2 hover:text-teal-300"
            >
              ข้อกำหนดการใช้งาน
            </a>
            {' '}และ{' '}
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-teal-400 underline underline-offset-2 hover:text-teal-300"
            >
              นโยบายความเป็นส่วนตัว
            </a>
          </span>
        </label>
      )}

      {requiresChallenge && <TurnstileChallenge />}

      <Button
        type="submit"
        variant="primary"
        className="AuthSubmit"
        disabled={!canSubmit}
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
  )
}

function RecoveryPanel({
  email,
  emailValid,
  showEmailError,
  onEmailChange,
  onSubmitAttempt,
}: {
  email: string
  emailValid: boolean
  showEmailError: boolean
  onEmailChange: (value: string) => void
  onSubmitAttempt: () => void
}) {
  return (
    <form
      className="mt-6 space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmitAttempt()
      }}
    >
      <AuthField label="อีเมล">
        <TextInput
          type="email"
          className="AuthInput"
          placeholder="อีเมล"
          value={email}
          onChange={(event) => onEmailChange(event.currentTarget.value)}
          autoComplete="email"
          aria-invalid={showEmailError}
        />
        {showEmailError && <FieldError>กรอกอีเมลให้ถูกต้อง</FieldError>}
      </AuthField>
      <AuthErrorNotice
        notice={{
          tone: 'info',
          title: 'ยังไม่เปิดกู้รหัสผ่านตอนนี้',
          message: emailValid
            ? 'ตอนนี้ให้ใช้ Google ถ้าบัญชีนี้เคยเชื่อมไว้ หรือสมัครบัญชีใหม่ด้วยอีเมลอื่น'
            : 'ระบบส่งอีเมลกู้รหัสผ่านยังไม่เปิดใช้งาน',
        }}
      />
      <Button type="submit" variant="soft" className="AuthSubmit" disabled={!email}>
        ตรวจอีเมล
      </Button>
    </form>
  )
}

function AuthField({ action, children, label }: { action?: React.ReactNode; children: React.ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-extrabold text-[var(--moxzk-text)]">
        {label}
        {action}
      </span>
      {children}
    </label>
  )
}

function AuthModeSwitch({ mode, onChange }: { mode: AuthMode; onChange: (mode: AuthMode) => void }) {
  if (mode === 'signup') {
    return (
      <div className="mt-5 text-center text-sm text-[var(--moxzk-text)]">
        มีบัญชีอยู่แล้ว?{' '}
        <button type="button" className="AuthInlineLink" onClick={() => onChange('login')}>
          เข้าสู่ระบบ
        </button>
      </div>
    )
  }

  if (mode === 'recovery') {
    return (
      <div className="mt-5 text-center text-sm text-[var(--moxzk-text)]">
        จำรหัสผ่านได้แล้ว?{' '}
        <button type="button" className="AuthInlineLink" onClick={() => onChange('login')}>
          เข้าสู่ระบบ
        </button>
      </div>
    )
  }

  return (
    <div className="mt-5 text-center text-sm text-[var(--moxzk-text)]">
      ยังไม่มีบัญชี?{' '}
      <button type="button" className="AuthInlineLink" onClick={() => onChange('signup')}>
        สมัครสมาชิก
      </button>
    </div>
  )
}

function PasswordChecklist({ rules }: { rules: PasswordRules }) {
  return (
    <div className="mt-2 grid gap-1 text-xs">
      <PasswordRule ok={rules.minLength}>ขั้นต่ำ 8 ตัว</PasswordRule>
      <PasswordRule ok={rules.hasLetter}>มีตัวอักษร</PasswordRule>
      <PasswordRule ok={rules.hasNumber}>มีตัวเลข</PasswordRule>
    </div>
  )
}

function PasswordRule({ ok, children }: { ok: boolean; children: string }) {
  return (
    <div className={ok ? 'flex items-center gap-1.5 text-green-300' : 'flex items-center gap-1.5 text-[var(--moxzk-dim)]'}>
      {ok ? <Check size={12} /> : <X size={12} />}
      <span>{children}</span>
    </div>
  )
}

function AuthErrorNotice({ notice, onAction }: { notice: AuthNotice; onAction?: () => void }) {
  const toneClass: Record<NoticeTone, string> = {
    error: 'bg-red-500/10 text-red-100',
    warning: 'bg-yellow-500/10 text-yellow-100',
    info: 'bg-blue-500/10 text-blue-100',
  }

  return (
    <div className={`rounded-[8px] px-3 py-2 text-sm leading-6 ${toneClass[notice.tone]}`}>
      <div className="font-bold">{notice.title}</div>
      <div className="text-xs leading-5 opacity-85">{notice.message}</div>
      {notice.action === 'switch-login' && onAction && (
        <button type="button" className="AuthInlineLink mt-1 text-xs" onClick={onAction}>
          ไปหน้าเข้าสู่ระบบ
        </button>
      )}
    </div>
  )
}

function TurnstileChallenge() {
  return (
    <div className="flex items-start gap-2 rounded-[8px] bg-white/[0.035] px-3 py-2 text-xs leading-5 text-[var(--moxzk-muted)]">
      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-blue-300" />
      <span>ต้องยืนยันเพิ่มเติมก่อนส่งคำขอนี้อีกครั้ง</span>
    </div>
  )
}

function FieldError({ children }: { children: string }) {
  return <p className="mt-1.5 text-xs text-red-200">{children}</p>
}

function AuthDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-[var(--moxzk-dim)]">
      <span className="h-px flex-1 bg-white/[0.09]" />
      หรือ
      <span className="h-px flex-1 bg-white/[0.09]" />
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

interface PasswordRules {
  minLength: boolean
  hasLetter: boolean
  hasNumber: boolean
}

function getPasswordRules(password: string, _email: string): PasswordRules {
  return {
    minLength: password.length >= 8,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

interface AuthNotice {
  tone: NoticeTone
  title: string
  message: string
  action?: 'switch-login'
}

function getAuthNotice(error: AuthUiError | null, mode: AuthMode, remainingSec: number | null): AuthNotice | null {
  if (!error) return null
  if (mode === 'signup' && error.code === 'CONFLICT') {
    return {
      tone: 'warning',
      title: 'อีเมลนี้ถูกใช้แล้ว',
      message: 'ลองเข้าสู่ระบบด้วยอีเมลนี้แทน หรือใช้ Google ถ้าบัญชีเคยเชื่อมไว้',
      action: 'switch-login',
    }
  }
  if (error.status === 401 || error.code === 'UNAUTHORIZED') {
    return {
      tone: 'error',
      title: 'เข้าสู่ระบบไม่สำเร็จ',
      message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    }
  }
  if (error.status === 429 || error.code === 'RATE_LIMITED') {
    return {
      tone: 'warning',
      title: 'ส่งคำขอถี่เกินไป',
      message: remainingSec && remainingSec > 0
        ? `ลองใหม่ได้ใน ${remainingSec} วินาที`
        : 'รอสักครู่แล้วลองใหม่',
    }
  }
  if (error.status === 423 || error.code === 'ACCOUNT_LOCKED') {
    return {
      tone: 'warning',
      title: 'บัญชีถูกพักชั่วคราว',
      message: remainingSec && remainingSec > 0
        ? `ลองใหม่ได้ใน ${remainingSec} วินาที หรือใช้ Google ถ้าบัญชีนี้เคยเชื่อมไว้`
        : 'รอสักครู่แล้วลองใหม่ หรือใช้ Google ถ้าบัญชีนี้เคยเชื่อมไว้',
    }
  }
  if (error.requiresChallenge || error.code === 'CHALLENGE_REQUIRED') {
    return {
      tone: 'info',
      title: 'ต้องยืนยันเพิ่มเติม',
      message: 'ระบบต้องการตรวจสอบก่อนส่งคำขอนี้อีกครั้ง',
    }
  }
  return {
    tone: 'error',
    title: mode === 'signup' ? 'สมัครสมาชิกไม่สำเร็จ' : 'เข้าสู่ระบบไม่สำเร็จ',
    message: error.message,
  }
}

function getBlockedUntil(error: AuthUiError | null): number | null {
  if (!error) return null
  if (error.lockoutUntil) return error.lockoutUntil
  if (error.retryAfterSec != null) return Date.now() + error.retryAfterSec * 1000
  return null
}
