import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { arabicAlphabet, ArabicLetter } from "@/data/arabicAlphabet";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mic, Square, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const AdminRecording = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [selectedLetter, setSelectedLetter] = useState<ArabicLetter | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recordedLetters, setRecordedLetters] = useState<Set<string>>(new Set());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Redirect non-admin users
  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/home");
    }
  }, [user, navigate]);

  // Fetch already recorded letters
  useEffect(() => {
    const fetchRecorded = async () => {
      const { data } = await supabase.from("letter_recordings").select("letter");
      if (data) {
        setRecordedLetters(new Set(data.map((r: any) => r.letter)));
      }
    };
    fetchRecorded();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setAudioBlob(null);
      setAudioUrl(null);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const uploadRecording = async () => {
    if (!audioBlob || !selectedLetter || !user) return;
    setUploading(true);

    try {
      const fileName = `letter-${selectedLetter.id}-${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from("letter-audio")
        .upload(fileName, audioBlob, { contentType: "audio/webm", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("letter-audio")
        .getPublicUrl(fileName);

      // Upsert recording record
      const { error: dbError } = await supabase
        .from("letter_recordings")
        .upsert(
          {
            letter: selectedLetter.letter,
            letter_name: selectedLetter.name,
            audio_url: urlData.publicUrl,
            recorded_by: user.id,
          },
          { onConflict: "letter" }
        );

      if (dbError) throw dbError;

      setRecordedLetters((prev) => new Set([...prev, selectedLetter.letter]));
      setAudioBlob(null);
      setAudioUrl(null);
      toast.success(`Saved recording for ${selectedLetter.name}`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary p-4 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-primary-foreground p-2 -ml-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">Record Pronunciations</h1>
            <p className="text-primary-foreground/70 text-xs">
              {recordedLetters.size}/{arabicAlphabet.length} letters recorded
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Recording panel */}
        {selectedLetter && (
          <div className="glass-card rounded-2xl p-6 mb-6 text-center animate-scale-in">
            <p className="font-arabic text-7xl text-primary mb-2">{selectedLetter.letter}</p>
            <h3 className="text-xl font-semibold text-foreground">{selectedLetter.name}</h3>
            <p className="text-muted-foreground text-sm mb-4">/{selectedLetter.transliteration}/</p>

            <div className="flex items-center justify-center gap-4">
              {!isRecording && !audioBlob && (
                <button
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all animate-pulse"
                >
                  <Mic className="w-7 h-7 text-destructive-foreground" />
                </button>
              )}

              {isRecording && (
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-destructive flex items-center justify-center hover:opacity-90 transition-all"
                >
                  <Square className="w-6 h-6 text-destructive-foreground" />
                </button>
              )}
            </div>

            {isRecording && (
              <p className="text-destructive text-sm mt-3 animate-pulse">Recording...</p>
            )}

            {audioUrl && !isRecording && (
              <div className="mt-4 space-y-3">
                <audio src={audioUrl} controls className="mx-auto" />
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={startRecording}
                    className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium"
                  >
                    Re-record
                  </button>
                  <button
                    onClick={uploadRecording}
                    disabled={uploading}
                    className="px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-medium flex items-center gap-2"
                  >
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Letter Grid */}
        <div className="grid grid-cols-4 gap-3">
          {arabicAlphabet.map((letter) => (
            <button
              key={letter.id}
              onClick={() => {
                setSelectedLetter(letter);
                setAudioBlob(null);
                setAudioUrl(null);
                setIsRecording(false);
              }}
              className={`glass-card rounded-xl p-3 text-center hover:shadow-md transition-all relative ${
                selectedLetter?.id === letter.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <p className="font-arabic text-3xl text-foreground">{letter.letter}</p>
              <p className="text-xs text-muted-foreground mt-1">{letter.name}</p>
              {recordedLetters.has(letter.letter) && (
                <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminRecording;
