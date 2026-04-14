import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { arabicAlphabet, ArabicLetter } from "@/data/arabicAlphabet";
import { useLetterAudio } from "@/hooks/useLetterAudio";
import { ArrowLeft, Volume2, BookOpen, Target, ChevronLeft, ChevronRight } from "lucide-react";
import PracticeMode from "@/components/PracticeMode";

const Learning = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState<"alphabet" | "practice">("alphabet");
  const { playLetter: speak } = useLetterAudio();
  const touchStart = useRef(0);

  const currentLetter = arabicAlphabet[currentIndex];

  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(arabicAlphabet.length - 1, idx));
    setCurrentIndex(next);
    speak(arabicAlphabet[next].letter);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary p-4 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-primary-foreground p-2 -ml-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Learn Arabic</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          {[
            { key: "alphabet" as const, label: "Alphabet", icon: BookOpen },
            { key: "practice" as const, label: "Practice", icon: Target },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${
                tab === t.key ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "alphabet" ? (
          <>
            {selectedLetter && (
              <div className="glass-card rounded-2xl p-6 mb-6 text-center animate-scale-in">
                <p className="font-arabic text-7xl text-primary mb-2">{selectedLetter.letter}</p>
                <h3 className="text-xl font-semibold text-foreground">{selectedLetter.name}</h3>
                <p className="text-muted-foreground">/{selectedLetter.transliteration}/</p>
                <div className="mt-3 bg-muted rounded-xl p-3">
                  <p className="font-arabic text-2xl text-foreground">{selectedLetter.exampleWord}</p>
                  <p className="text-sm text-muted-foreground">{selectedLetter.exampleMeaning}</p>
                </div>
                <button
                  onClick={() => speak(selectedLetter.letter)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl gradient-primary text-primary-foreground text-sm font-medium"
                >
                  <Volume2 className="w-4 h-4" /> Listen
                </button>
              </div>
            )}

            <div className="overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-3 w-max">
                {arabicAlphabet.map((letter) => (
                  <button
                    key={letter.id}
                    onClick={() => {
                      setSelectedLetter(letter);
                      speak(letter.letter);
                    }}
                    className={`glass-card rounded-xl p-3 text-center hover:shadow-md transition-all flex-shrink-0 w-20 ${
                      selectedLetter?.id === letter.id ? "ring-2 ring-primary" : ""
                    }`}
                  >
                    <p className="font-arabic text-3xl text-foreground">{letter.letter}</p>
                    <p className="text-xs text-muted-foreground mt-1">{letter.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <PracticeMode />
        )}
      </div>
    </div>
  );
};

export default Learning;
