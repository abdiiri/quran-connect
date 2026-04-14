
-- Table to store letter pronunciation recordings
CREATE TABLE public.letter_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  letter TEXT NOT NULL,
  letter_name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint: one recording per letter
ALTER TABLE public.letter_recordings ADD CONSTRAINT unique_letter UNIQUE (letter);

-- Enable RLS
ALTER TABLE public.letter_recordings ENABLE ROW LEVEL SECURITY;

-- Anyone can read recordings (used in learning module)
CREATE POLICY "Anyone can read recordings" ON public.letter_recordings FOR SELECT USING (true);

-- Anyone can insert recordings (admin check in app)
CREATE POLICY "Anyone can insert recordings" ON public.letter_recordings FOR INSERT WITH CHECK (true);

-- Anyone can update recordings (admin check in app)
CREATE POLICY "Anyone can update recordings" ON public.letter_recordings FOR UPDATE USING (true);

-- Storage bucket for audio files
INSERT INTO storage.buckets (id, name, public) VALUES ('letter-audio', 'letter-audio', true);

-- Anyone can read audio files
CREATE POLICY "Public audio access" ON storage.objects FOR SELECT USING (bucket_id = 'letter-audio');

-- Anyone can upload audio files
CREATE POLICY "Anyone can upload audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'letter-audio');

-- Anyone can update audio files
CREATE POLICY "Anyone can update audio" ON storage.objects FOR UPDATE USING (bucket_id = 'letter-audio');
