import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useLetterAudio = () => {
  const [recordings, setRecordings] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("letter_recordings").select("letter, audio_url");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((r: any) => { map[r.letter] = r.audio_url; });
        setRecordings(map);
      }
    };
    fetch();
  }, []);

  const playLetter = useCallback((letter: string) => {
    if (recordings[letter]) {
      const audio = new Audio(recordings[letter]);
      audio.play();
    } else {
      const utterance = new SpeechSynthesisUtterance(letter);
      utterance.lang = "ar-SA";
      utterance.rate = 0.7;
      speechSynthesis.speak(utterance);
    }
  }, [recordings]);

  return { recordings, playLetter };
};
