import { useCall } from "@/contexts/CallContext";
import { useUser } from "@/contexts/UserContext";
import { arabicAlphabet } from "@/data/arabicAlphabet";
import { QuizLetter } from "@/hooks/useWebRTC";

const InCallQuiz = () => {
  const { user } = useUser();
  const { quizLetter, sendQuizLetter } = useCall();
  const isTeacher = user?.role === "teacher";

  const handlePickLetter = (letter: typeof arabicAlphabet[0]) => {
    const ql: QuizLetter = {
      letter: letter.letter,
      name: letter.name,
      transliteration: letter.transliteration,
    };
    sendQuizLetter(ql);
  };

  return (
    <div className="w-full bg-background/95 backdrop-blur-sm border-t border-border">
      {/* Show current quiz letter for both users */}
      {quizLetter && (
        <div className="text-center py-4 px-4">
          <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Quiz Letter</p>
          <div className="inline-flex items-center gap-4 bg-primary/10 rounded-2xl px-6 py-3">
            <span className="text-5xl font-amiri text-primary">{quizLetter.letter}</span>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{quizLetter.name}</p>
              <p className="text-xs text-muted-foreground">{quizLetter.transliteration}</p>
            </div>
          </div>
        </div>
      )}

      {/* Teacher letter picker */}
      {isTeacher && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-2 text-center">Pick a letter to quiz the learner</p>
          <div className="flex flex-wrap gap-2 justify-center max-h-32 overflow-y-auto">
            {arabicAlphabet.map((l) => (
              <button
                key={l.name}
                onClick={() => handlePickLetter(l)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-amiri transition-all ${
                  quizLetter?.letter === l.letter
                    ? "gradient-primary text-primary-foreground"
                    : "bg-muted hover:bg-primary/20 text-foreground"
                }`}
              >
                {l.letter}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InCallQuiz;
