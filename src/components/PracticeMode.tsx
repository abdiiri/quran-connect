import { useState, useCallback } from "react";
import { arabicAlphabet } from "@/data/arabicAlphabet";
import { useLetterAudio } from "@/hooks/useLetterAudio";
import { CheckCircle2, XCircle, RefreshCw, Volume2 } from "lucide-react";

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

const PracticeMode = () => {
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const { playLetter } = useLetterAudio();

  const generateQuestion = useCallback(() => {
    const correct = arabicAlphabet[Math.floor(Math.random() * arabicAlphabet.length)];
    const others = shuffle(arabicAlphabet.filter((l) => l.id !== correct.id)).slice(0, 3);
    return { correct, options: shuffle([correct, ...others]) };
  }, []);

  const [question, setQuestion] = useState(generateQuestion);

  const handleAnswer = (id: number) => {
    if (feedback) return;
    const isCorrect = id === question.correct.id;
    setFeedback(isCorrect ? "correct" : "wrong");
    if (isCorrect) setScore((s) => s + 1);
    setTotal((t) => t + 1);
    setTimeout(() => {
      setFeedback(null);
      setQuestion(generateQuestion());
    }, 1200);
  };

  const reset = () => {
    setScore(0);
    setTotal(0);
    setFeedback(null);
    setQuestion(generateQuestion());
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          Score: <span className="font-semibold text-foreground">{score}/{total}</span>
        </div>
        <button onClick={reset} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      <div className="glass-card rounded-2xl p-6 text-center mb-6">
        <p className="text-sm text-muted-foreground mb-2">Which letter is this?</p>
        <p className="font-arabic text-6xl text-primary">{question.correct.letter}</p>
        <p className="text-sm text-muted-foreground mt-2">/{question.correct.transliteration}/</p>
        <button
          onClick={() => playLetter(question.correct.letter)}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl gradient-primary text-primary-foreground text-xs font-medium"
        >
          <Volume2 className="w-3.5 h-3.5" /> Listen
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {question.options.map((opt) => {
          let style = "glass-card hover:shadow-md";
          if (feedback) {
            if (opt.id === question.correct.id) style = "bg-primary/10 border-primary ring-2 ring-primary";
            else if (feedback === "wrong") style = "bg-destructive/10 border-destructive/30";
          }
          return (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt.id)}
              className={`${style} rounded-xl p-4 text-center transition-all`}
            >
              <p className="font-semibold text-foreground">{opt.name}</p>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div className={`mt-4 flex items-center justify-center gap-2 text-lg font-medium animate-scale-in ${feedback === "correct" ? "text-primary" : "text-destructive"}`}>
          {feedback === "correct" ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {feedback === "correct" ? "Correct! 🎉" : `Wrong — it's ${question.correct.name}`}
        </div>
      )}
    </div>
  );
};

export default PracticeMode;
