-- ============================================================
-- MG_Translater — Initial Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ── Profiles (extends auth.users) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username    TEXT UNIQUE,
  avatar_url  TEXT,
  plan        TEXT NOT NULL DEFAULT 'free'
              CHECK (plan IN ('free', 'pro', 'team')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ── Albums ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.albums (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  cover_key    TEXT,
  source_lang  TEXT NOT NULL DEFAULT 'ja',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_albums_user     ON public.albums(user_id);
CREATE INDEX IF NOT EXISTS idx_albums_updated  ON public.albums(updated_at DESC);

-- ── Album Pages ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.album_pages (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id         UUID NOT NULL REFERENCES public.albums ON DELETE CASCADE,
  page_number      INT NOT NULL,
  original_key     TEXT,
  cleaned_key      TEXT,
  thumbnail_key    TEXT,
  regions          JSONB NOT NULL DEFAULT '[]'::jsonb,
  brush_strokes    JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'clean_done', 'translated', 'error')),
  processing_mode  TEXT NOT NULL DEFAULT 'full'
                   CHECK (processing_mode IN ('full', 'clean_only')),
  error_message    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(album_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_album   ON public.album_pages(album_id, page_number);
CREATE INDEX IF NOT EXISTS idx_pages_status  ON public.album_pages(status);

-- ── Updated_at trigger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_albums_updated
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_album_pages_updated
  BEFORE UPDATE ON public.album_pages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Auto-create profile on signup ───────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    username   = COALESCE(EXCLUDED.username, profiles.username),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Row Level Security ──────────────────────────────────────

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.album_pages ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Albums: owner CRUD
CREATE POLICY "Users can view own albums"
  ON public.albums FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create albums"
  ON public.albums FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own albums"
  ON public.albums FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own albums"
  ON public.albums FOR DELETE
  USING (auth.uid() = user_id);

-- Album Pages: accessible if user owns the parent album
CREATE POLICY "Users can view own album pages"
  ON public.album_pages FOR SELECT
  USING (album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid()));

CREATE POLICY "Users can create album pages"
  ON public.album_pages FOR INSERT
  WITH CHECK (album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own album pages"
  ON public.album_pages FOR UPDATE
  USING (album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid()))
  WITH CHECK (album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own album pages"
  ON public.album_pages FOR DELETE
  USING (album_id IN (SELECT id FROM public.albums WHERE user_id = auth.uid()));
