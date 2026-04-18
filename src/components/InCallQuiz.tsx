import { useCall } from "@/contexts/CallContext";
import { useUser } from "@/contexts/UserContext";
import { arabicAlphabet } from "@/data/arabicAlphabet";
import { QuizLetter } from "@/hooks/useMeteredCall";
import { useLetterAudio } from "@/hooks/useLetterAudio";
import { useState } from "react";
import { ChevronDown, ChevronUp, Volume2 } from "lucide-react";

const InCallQuiz = () => {
  const { user } = useUser();
  const { quizLetter, sendQuizLetter } = useCall();
  const isTeacher = user?.role === "teacher";
  const [pickerOpen, setPickerOpen] = useState(false);
  const { playLetter } = useLetterAudio();

  const handlePickLetter = (letter: typeof arabicAlphabet[0]) => {
    const ql: QuizLetter = {
      letter: letter.letter,
      name: letter.name,
      transliteration: letter.transliteration,
    };
    sendQuizLetter(ql);
  };

  return (
    <div className="w-full px-4">
      {quizLetter && (
        <div className="text-center mb-3">
          <p className="text-[10px] text-primary-foreground/50 uppercase tracking-widest mb-1">Quiz Letter</p>
          <div className="inline-flex items-center gap-3 bg-primary-foreground/10 backdrop-blur-md rounded-2xl px-5 py-2">
            <span className="text-4xl font-amiri text-primary-foreground">{quizLetter.letter}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-primary-foreground">{quizLetter.name}</p>
              <p className="text-xs text-primary-foreground/60">{quizLetter.transliteration}</p>
            </div>
            <button
              onClick={() => playLetter(quizLetter.letter)}
              className="ml-1 w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center hover:bg-primary-foreground/30 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </div>
      )}

      {isTeacher && (
        <div className="mb-2">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="mx-auto flex items-center gap-1 text-[10px] text-primary-foreground/50 uppercase tracking-wider hover:text-primary-foreground/80 transition-colors"
          >
            Pick letter {pickerOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </button>
          {pickerOpen && (
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 max-h-24 overflow-y-auto">
              {arabicAlphabet.map((l) => (
                <button
                  key={l.name}
                  onClick={() => handlePickLetter(l)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-amiri transition-all ${
                    quizLetter?.letter === l.letter
                      ? "gradient-primary text-primary-foreground"
                      : "bg-primary-foreground/10 hover:bg-primary-foreground/20 text-primary-foreground"
                  }`}
                >
                  {l.letter}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InCallQuiz;
