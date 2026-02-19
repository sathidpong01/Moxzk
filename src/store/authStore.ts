import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'
import { toast } from 'sonner'

interface AuthStore {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  showAuthModal: boolean

  // Actions
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      set({ loading: false })
      toast.error(error.message)
      throw error
    }
    // Session listener will handle the rest
    toast.success('เข้าสู่ระบบสำเร็จ!')
    set({ showAuthModal: false })
  },

  signUpWithEmail: async (email, password, username) => {
    set({ loading: true })
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: username },
      },
    })
    if (error) {
      set({ loading: false })
      toast.error(error.message)
      throw error
    }
    toast.success('สมัครสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยัน')
    set({ showAuthModal: false })
  },

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
    if (error) {
      toast.error(`Google login ล้มเหลว: ${error.message}`)
      throw error
    }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(`ออกจากระบบล้มเหลว: ${error.message}`)
      return
    }
    set({ user: null, session: null, profile: null })
    toast.success('ออกจากระบบแล้ว')
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) return

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.warn('[auth] Failed to fetch profile:', error.message)
      return
    }
    set({ profile: data })
  },

  init: async () => {
    set({ loading: true })

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      set({ user: session.user, session })
      // Fetch profile after setting user
      await get().fetchProfile()
    }
    set({ loading: false })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        set({
          user: session?.user ?? null,
          session,
          loading: false,
        })

        if (event === 'SIGNED_IN' && session?.user) {
          // Small delay to let trigger create profile
          setTimeout(() => get().fetchProfile(), 500)
          const name = session.user.user_metadata?.name
            || session.user.user_metadata?.full_name
            || session.user.email?.split('@')[0]
          toast.success(`ยินดีต้อนรับ, ${name}!`)
          set({ showAuthModal: false })
        }

        if (event === 'SIGNED_OUT') {
          set({ profile: null })
        }

        if (event === 'TOKEN_REFRESHED') {
          console.log('[auth] Token refreshed')
        }
      },
    )

    // Return cleanup function
    return () => subscription.unsubscribe()
  },
}))
