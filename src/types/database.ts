export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          avatar_url: string | null
          plan: 'free' | 'pro' | 'team'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'pro' | 'team'
        }
        Update: {
          username?: string | null
          avatar_url?: string | null
          plan?: 'free' | 'pro' | 'team'
          updated_at?: string
        }
      }
      albums: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          cover_key: string | null
          source_lang: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          cover_key?: string | null
          source_lang?: string
        }
        Update: {
          title?: string
          description?: string | null
          cover_key?: string | null
          source_lang?: string
          updated_at?: string
        }
      }
      album_pages: {
        Row: {
          id: string
          album_id: string
          page_number: number
          original_key: string | null
          cleaned_key: string | null
          thumbnail_key: string | null
          regions: unknown
          brush_strokes: unknown
          status: 'pending' | 'processing' | 'clean_done' | 'translated' | 'error'
          processing_mode: 'full' | 'clean_only'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          album_id: string
          page_number: number
          original_key?: string | null
          cleaned_key?: string | null
          thumbnail_key?: string | null
          regions?: unknown
          brush_strokes?: unknown
          status?: 'pending' | 'processing' | 'clean_done' | 'translated' | 'error'
          processing_mode?: 'full' | 'clean_only'
          error_message?: string | null
        }
        Update: {
          page_number?: number
          original_key?: string | null
          cleaned_key?: string | null
          thumbnail_key?: string | null
          regions?: unknown
          brush_strokes?: unknown
          status?: 'pending' | 'processing' | 'clean_done' | 'translated' | 'error'
          processing_mode?: 'full' | 'clean_only'
          error_message?: string | null
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Album = Database['public']['Tables']['albums']['Row']
export type AlbumPage = Database['public']['Tables']['album_pages']['Row']
