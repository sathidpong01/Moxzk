import { create } from 'zustand'
import { toast } from 'sonner'
import {
  CloudflareApiError,
  getCurrentUser,
  loginWithEmail,
  logout,
  redeemSupporterKey as apiRedeemSupporterKey,
  registerWithEmail,
  type AppSession,
  type AppUser,
} from '../services/cloudflareApi'
import { getAppRuntime } from '../runtime'
import type { Profile } from '../types/database'

let hasInitializedAuth = false

export interface AuthUiError {
  code: string
  status: number | null
  message: string
  retryAfterSec: number | null
  lockoutUntil: number | null
  requiresChallenge: boolean
}

interface AuthStore {
  user: AppUser | null
  session: AppSession | null
  profile: Profile | null
  loading: boolean
  showAuthModal: boolean
  authError: AuthUiError | null

  setShowAuthModal: (show: boolean) => void
  clearAuthError: () => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  redeemSupporterKey: (key: string) => Promise<void>
  init: () => Promise<() => void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  showAuthModal: false,
  authError: null,

  setShowAuthModal: (show) => set({ showAuthModal: show, authError: null }),
  clearAuthError: () => set({ authError: null }),

  signInWithEmail: async (email, password) => {
    set({ loading: true, authError: null })
    try {
      const auth = await loginWithEmail(email, password)
      set({ ...auth, loading: false, showAuthModal: false, authError: null })
      toast.success('เข้าสู่ระบบสำเร็จ!')
    } catch (error) {
      set({ loading: false, authError: toAuthUiError(error, 'เข้าสู่ระบบล้มเหลว') })
      throw error
    }
  },

  signUpWithEmail: async (email, password, username) => {
    set({ loading: true, authError: null })
    try {
      const auth = await registerWithEmail(email, password, username)
      set({ ...auth, loading: false, showAuthModal: false, authError: null })
      toast.success('สมัครสำเร็จ!')
    } catch (error) {
      set({ loading: false, authError: toAuthUiError(error, 'สมัครสมาชิกล้มเหลว') })
      throw error
    }
  },

  signInWithGoogle: async () => {
    const runtime = getAppRuntime()
    set({ loading: true, authError: null })
    try {
      const result = await runtime.auth.signInWithGoogle()
      if (!result.ok) throw new Error(result.error || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
      if (runtime.capabilities.canUseCustomProtocolAuth) {
        await get().fetchProfile()
        set({ showAuthModal: false, authError: null })
        toast.success('เข้าสู่ระบบด้วย Google สำเร็จ!')
      }
    } catch (error) {
      set({ loading: false, authError: toAuthUiError(error, 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ') })
      toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ')
      throw error
    }
  },

  signOut: async () => {
    try {
      await logout()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ออกจากระบบล้มเหลว')
      return
    }
    set({ user: null, session: null, profile: null, loading: false })
    toast.success('ออกจากระบบแล้ว')
  },

  fetchProfile: async () => {
    const auth = await getCurrentUser()
    if (!auth) {
      set({ user: null, session: null, profile: null, loading: false })
      return
    }
    set({ ...auth, loading: false })
  },

  redeemSupporterKey: async (key: string) => {
    const auth = await apiRedeemSupporterKey(key)
    set({ ...auth })
  },

  init: async () => {
    if (hasInitializedAuth) return () => {}
    hasInitializedAuth = true
    set({ loading: true })
    try {
      await get().fetchProfile()
    } catch (error) {
      console.warn('[auth] Failed to initialize session:', error)
      set({ user: null, session: null, profile: null, loading: false })
    }
    return () => {}
  },
}))

function toAuthUiError(error: unknown, fallbackMessage: string): AuthUiError {
  if (error instanceof CloudflareApiError) {
    return {
      code: error.code,
      status: error.status,
      message: error.message,
      retryAfterSec: error.retryAfterSec,
      lockoutUntil: error.lockoutUntil,
      requiresChallenge: error.requiresChallenge,
    }
  }
  return {
    code: 'UNKNOWN',
    status: null,
    message: error instanceof Error ? error.message : fallbackMessage,
    retryAfterSec: null,
    lockoutUntil: null,
    requiresChallenge: false,
  }
}
