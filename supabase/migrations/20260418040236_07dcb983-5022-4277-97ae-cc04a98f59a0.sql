-- Wipe existing users (auth + app_users)
DELETE FROM public.app_users;
DELETE FROM auth.users;

-- Add link to auth.users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enforce one row per auth user
CREATE UNIQUE INDEX IF NOT EXISTS app_users_auth_user_id_key
  ON public.app_users(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Case-insensitive unique username
CREATE UNIQUE INDEX IF NOT EXISTS app_users_name_lower_key
  ON public.app_users(LOWER(name));

-- Enable RLS (idempotent)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies so we can recreate them cleanly
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='app_users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.app_users', r.policyname);
  END LOOP;
END $$;

-- Anyone can read profiles (needed to look up users by 6-digit ID before/after auth)
CREATE POLICY "Profiles are viewable by everyone"
ON public.app_users
FOR SELECT
USING (true);

-- Only logged-in users can insert, and only their own row
CREATE POLICY "Users can insert their own profile"
ON public.app_users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_user_id);

-- Only the owner can update their row
CREATE POLICY "Users can update their own profile"
ON public.app_users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (auth.uid() = auth_user_id);

-- Only the owner can delete their row
CREATE POLICY "Users can delete their own profile"
ON public.app_users
FOR DELETE
TO authenticated
USING (auth.uid() = auth_user_id);