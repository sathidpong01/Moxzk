import { create } from 'zustand'
import { toast } from 'sonner'
import {
  getCurrentUser,
  loginWithEmail,
  logout,
  registerWithEmail,
  type AppSession,
  type AppUser,
} from '../services/cloudflareApi'
import { getAppRuntime } from '../runtime'
import type { Profile } from '../types/database'

let hasInitializedAuth = false

interface AuthStore {
  user: AppUser | null
  session: AppSession | null
  profile: Profile | null
  loading: boolean
  showAuthModal: boolean

  setShowAuthModal: (show: boolean) => void
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, username?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  init: () => Promise<() => void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,
  showAuthModal: false,

  setShowAuthModal: (show) => set({ showAuthModal: show }),

  signInWithEmail: async (email, password) => {
    set({ loading: true })
    try {
      const auth = await loginWithEmail(email, password)
      set({ ...auth, loading: false, showAuthModal: false })
      toast.success('เข้าสู่ระบบสำเร็จ!')
    } catch (error) {
      set({ loading: false })
      toast.error(error instanceof Error ? error.message : 'เข้าสู่ระบบล้มเหลว')
      throw error
    }
  },

  signUpWithEmail: async (email, password, username) => {
    set({ loading: true })
    try {
      const auth = await registerWithEmail(email, password, username)
      set({ ...auth, loading: false, showAuthModal: false })
      toast.success('สมัครสำเร็จ!')
    } catch (error) {
      set({ loading: false })
      toast.error(error instanceof Error ? error.message : 'สมัครสมาชิกล้มเหลว')
      throw error
    }
  },

  signInWithGoogle: async () => {
    const runtime = getAppRuntime()
    const hasElectronBridge = typeof window !== 'undefined' && Boolean(window.mgRuntime)
    set({ loading: true })
    try {
      const result = await runtime.auth.signInWithGoogle()
      if (!result.ok) throw new Error(result.error || 'Google login ล้มเหลว')
      if (runtime.kind === 'electron' || hasElectronBridge) {
        await get().fetchProfile()
        set({ showAuthModal: false })
        toast.success('เข้าสู่ระบบด้วย Google สำเร็จ!')
      }
    } catch (error) {
      set({ loading: false })
      toast.error(error instanceof Error ? error.message : 'Google login ล้มเหลว')
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
