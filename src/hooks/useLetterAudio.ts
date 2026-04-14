import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useLetterAudio = () => {
  const [recordings, setRecordings] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchRecordings = async () => {
      const { data } = await supabase.from("letter_recordings").select("letter, audio_url");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.letter] = r.audio_url; });
        setRecordings(map);
      }
    };
    fetchRecordings();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playLetter = useCallback((letter: string) => {
    // Stop any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (recordings[letter]) {
      const audio = new Audio(recordings[letter]);
      audioRef.current = audio;
      audio.onended = () => { audioRef.current = null; };
      audio.play().catch(() => {});
    } else {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(letter);
      utterance.lang = "ar-SA";
      utterance.rate = 0.7;
      speechSynthesis.speak(utterance);
    }
  }, [recordings]);

  return { recordings, playLetter };
};
