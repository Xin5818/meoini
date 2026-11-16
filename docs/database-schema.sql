
-- Meoini PostgreSQL Database Schema
-- Version: 1.1
-- Authentication: Supabase Auth
-- Target: Supabase PostgreSQL
-- Usage: Initial database setup on a new project

BEGIN;

-- ==========================================
-- 1. Users
-- ==========================================

CREATE TABLE public.users (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,

    email TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. Decks
-- ==========================================

CREATE TABLE public.decks (
    id TEXT NOT NULL,
    user_id UUID NOT NULL
        REFERENCES public.users(id) ON DELETE CASCADE,

    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    language TEXT NOT NULL DEFAULT 'all',
    icon TEXT NOT NULL DEFAULT 'library',
    color TEXT NOT NULL DEFAULT 'primary',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, id)
);

-- ==========================================
-- 3. Flashcards
-- ==========================================

CREATE TABLE public.flashcards (
    id TEXT NOT NULL,
    user_id UUID NOT NULL,
    deck_id TEXT NOT NULL,

    card_type TEXT NOT NULL DEFAULT 'dictionary'
        CHECK (card_type IN ('dictionary', 'custom')),

    front TEXT,
    back TEXT,
    notes TEXT,
    audio_url TEXT,
    image_url TEXT,

    word TEXT NOT NULL,
    language TEXT NOT NULL,
    meaning TEXT NOT NULL,
    part_of_speech TEXT,
    example TEXT,

    dictionary_entry JSONB,

    lookup_status TEXT
        CHECK (
            lookup_status IN (
                'pending',
                'querying',
                'found',
                'not_found',
                'error'
            )
        ),

    lookup_started_at TIMESTAMPTZ,
    lookup_completed_at TIMESTAMPTZ,
    lookup_error TEXT,

    last_reviewed_at TIMESTAMPTZ,

    last_review_mode TEXT
        CHECK (last_review_mode IN ('scheduled', 'early')),

    early_review_count INTEGER NOT NULL DEFAULT 0
        CHECK (early_review_count >= 0),

    tags TEXT[] NOT NULL DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL,

    interval_days INTEGER NOT NULL DEFAULT 0
        CHECK (interval_days >= 0),

    repetitions INTEGER NOT NULL DEFAULT 0
        CHECK (repetitions >= 0),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (user_id, id),

    CONSTRAINT fk_flashcards_deck
        FOREIGN KEY (user_id, deck_id)
        REFERENCES public.decks(user_id, id)
        ON DELETE CASCADE
);

-- ==========================================
-- 4. Review Logs
-- ==========================================

CREATE TABLE public.review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,
    flashcard_id TEXT NOT NULL,

    rating TEXT NOT NULL
        CHECK (rating IN ('again', 'hard', 'good')),

    review_mode TEXT NOT NULL
        CHECK (review_mode IN ('scheduled', 'early')),

    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_review_logs_flashcard
        FOREIGN KEY (user_id, flashcard_id)
        REFERENCES public.flashcards(user_id, id)
        ON DELETE CASCADE
);

-- ==========================================
-- 5. Indexes
-- ==========================================

CREATE INDEX idx_flashcards_user_id
    ON public.flashcards(user_id);

CREATE INDEX idx_flashcards_deck_id
    ON public.flashcards(user_id, deck_id);

CREATE INDEX idx_flashcards_due_at
    ON public.flashcards(user_id, due_at);

CREATE INDEX idx_review_logs_flashcard_id
    ON public.review_logs(user_id, flashcard_id);

CREATE INDEX idx_review_logs_user_id
    ON public.review_logs(user_id);

CREATE INDEX idx_review_logs_reviewed_at
    ON public.review_logs(user_id, reviewed_at DESC);

-- ==========================================
-- 6. Updated At Function
-- ==========================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER decks_updated_at
BEFORE UPDATE ON public.decks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER flashcards_updated_at
BEFORE UPDATE ON public.flashcards
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- ==========================================
-- 7. Supabase Auth User Synchronization
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id)
    DO UPDATE SET email = EXCLUDED.email;

    INSERT INTO public.decks (
        id,
        user_id,
        name,
        description,
        language,
        icon,
        color
    )
    VALUES (
        'default',
        NEW.id,
        'Default',
        '',
        'all',
        'library',
        'primary'
    )
    ON CONFLICT (user_id, id) DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_email_updated
AFTER UPDATE OF email ON auth.users
FOR EACH ROW
WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 8. Synchronize Existing Auth Users
-- ==========================================

INSERT INTO public.users (id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email;

INSERT INTO public.decks (
    id,
    user_id,
    name,
    description,
    language,
    icon,
    color
)
SELECT
    'default',
    id,
    'Default',
    '',
    'all',
    'library',
    'primary'
FROM auth.users
ON CONFLICT (user_id, id) DO NOTHING;

-- ==========================================
-- 9. Enable Row Level Security
-- ==========================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 10. Users Policies
-- ==========================================

CREATE POLICY "Users can read own profile"
ON public.users
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = id);

-- ==========================================
-- 11. Decks Policies
-- ==========================================

CREATE POLICY "Users can manage own decks"
ON public.decks
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- ==========================================
-- 12. Flashcards Policies
-- ==========================================

CREATE POLICY "Users can manage own flashcards"
ON public.flashcards
FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

-- ==========================================
-- 13. Review Logs Policies
-- ==========================================

CREATE POLICY "Users can read own review logs"
ON public.review_logs
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own review logs"
ON public.review_logs
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
        SELECT 1
        FROM public.flashcards
        WHERE flashcards.user_id = (SELECT auth.uid())
          AND flashcards.id = review_logs.flashcard_id
    )
);

-- ==========================================
-- 14. Database Permissions
-- ==========================================

GRANT USAGE ON SCHEMA public TO authenticated;

REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.decks FROM anon;
REVOKE ALL ON public.flashcards FROM anon;
REVOKE ALL ON public.review_logs FROM anon;

GRANT SELECT ON public.users TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.decks TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.flashcards TO authenticated;

GRANT SELECT, INSERT
ON public.review_logs TO authenticated;

COMMIT;

-- ==========================================
-- End of Meoini Database Schema v1.1
-- ==========================================
