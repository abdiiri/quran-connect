import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { arabicAlphabet } from "@/data/arabicAlphabet";
import { ArrowLeft, ChevronLeft, ChevronRight, Eraser, Trash2, PartyPopper } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ColoringCanvas from "@/components/coloring/ColoringCanvas";

const PEN_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6",
  "#8B5CF6", "#EC4899", "#06B6D4", "#000000", "#8B4513",
];
const BRUSH_SIZES = [8, 16, 24];

const ColoringPage = () => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isErasing, setIsErasing] = useState(false);
  const [coloredLetters, setColoredLetters] = useState<Set<number>>(new Set());
  const [showCongrats, setShowCongrats] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const [letterProgress, setLetterProgress] = useState(0);

  const currentLetter = arabicAlphabet[currentIndex];

  const handleLetterProgress = useCallback((percent: number) => {
    setLetterProgress(percent);
  }, []);

  const handleComplete = useCallback(() => {
    setColoredLetters(prev => {
      if (prev.has(currentIndex)) return prev;
      const next = new Set(prev);
      next.add(currentIndex);
      if (next.size === arabicAlphabet.length) {
        setShowCongrats(true);
      }
      return next;
    });
  }, [currentIndex]);

  const { canvasRef, maskRef, clearCanvas, startDraw, draw, stopDraw } = ColoringCanvas({
    letter: currentLetter,
    penColor, brushSize, isErasing,
    onComplete: handleComplete,
    onProgress: handleLetterProgress,
    resetKey,
  });

  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(arabicAlphabet.length - 1, idx));
    setCurrentIndex(next);
    setResetKey(k => k + 1);
  };

  const handleContinue = () => setShowCongrats(false);
  const handleNext = () => {
    setShowCongrats(false);
    if (currentIndex < arabicAlphabet.length - 1) goTo(currentIndex + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="gradient-primary p-4 pb-6 rounded-b-3xl">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="text-primary-foreground p-2 -ml-2 hover:bg-primary-foreground/10 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-primary-foreground">Color the Letters</h1>
          <span className="ml-auto text-primary-foreground/70 text-sm">{currentIndex + 1}/{arabicAlphabet.length}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4">
        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Letter progress</span>
            <span>{Math.round(letterProgress)}%</span>
          </div>
          <Progress value={letterProgress} className="h-2" />
          {/* Dot indicators */}
          <div className="flex flex-wrap gap-1 mt-2 justify-center">
            {arabicAlphabet.map((l, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={`w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center transition-all ${
                  idx === currentIndex
                    ? "ring-2 ring-primary bg-primary text-primary-foreground scale-110"
                    : coloredLetters.has(idx)
                    ? "bg-green-500 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                title={l.name}
              >
                {l.letter}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="glass-card rounded-2xl p-3 mb-4 flex items-center justify-center bg-card">
          <canvas
            ref={canvasRef}
            className="touch-none rounded-xl cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />
          <canvas ref={maskRef} className="hidden" />
        </div>

        {/* Color Picker */}
        <div className="glass-card rounded-2xl p-4 mb-3">
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => { setPenColor(color); setIsErasing(false); }}
                className={`w-9 h-9 rounded-full border-2 transition-all ${
                  penColor === color && !isErasing ? "border-foreground scale-110 shadow-md" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Tools row */}
        <div className="flex items-center gap-2 mb-4">
          {BRUSH_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => { setBrushSize(size); setIsErasing(false); }}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                brushSize === size && !isErasing ? "bg-primary/20 ring-2 ring-primary" : "bg-muted"
              }`}
            >
              <div className="rounded-full bg-foreground" style={{ width: size / 2 + 4, height: size / 2 + 4 }} />
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setIsErasing(!isErasing)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isErasing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Eraser className="w-4 h-4" /> Rubber
          </button>
          <button
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0} className="p-3 rounded-xl bg-muted text-foreground disabled:opacity-30 transition-opacity">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="font-arabic text-3xl text-primary">{currentLetter.letter}</p>
          <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex === arabicAlphabet.length - 1} className="p-3 rounded-xl bg-muted text-foreground disabled:opacity-30 transition-opacity">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Congratulations Dialog */}
      <Dialog open={showCongrats} onOpenChange={setShowCongrats}>
        <DialogContent className="max-w-xs rounded-2xl text-center">
          <DialogHeader className="items-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
              <PartyPopper className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-xl">🎉 Congratulations!</DialogTitle>
            <DialogDescription>
              You've colored all {arabicAlphabet.length} Arabic letters! Amazing work! 🌟
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={handleContinue} className="w-full py-2.5 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">
              Continue Coloring
            </button>
            <button
              onClick={() => { setShowCongrats(false); navigate("/home"); }}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ColoringPage;
