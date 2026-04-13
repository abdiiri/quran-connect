
-- Create users table for the Quran learning app
CREATE TABLE public.app_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK (role IN ('learner', 'teacher')),
  is_online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Anyone can read users (needed for looking up call targets)
CREATE POLICY "Anyone can read users" ON public.app_users FOR SELECT USING (true);

-- Anyone can insert (no auth system, anonymous users)
CREATE POLICY "Anyone can insert users" ON public.app_users FOR INSERT WITH CHECK (true);

-- Anyone can update (for online status)
CREATE POLICY "Anyone can update users" ON public.app_users FOR UPDATE USING (true);
