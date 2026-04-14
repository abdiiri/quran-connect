import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { arabicAlphabet } from "@/data/arabicAlphabet";
import { ArrowLeft, ChevronLeft, ChevronRight, Eraser, Trash2 } from "lucide-react";

const PEN_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6",
  "#8B5CF6", "#EC4899", "#06B6D4", "#000000", "#8B4513",
];

const BRUSH_SIZES = [8, 16, 24];

const ColoringPage = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isErasing, setIsErasing] = useState(false);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const currentLetter = arabicAlphabet[currentIndex];

  // Create the letter mask (hollow letter outline)
  const createLetterMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;

    const w = mask.width;
    const h = mask.height;
    ctx.clearRect(0, 0, w, h);

    // Draw letter filled in white (this becomes the "inside" area)
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.min(w, h) * 0.7}px "Amiri", serif`;
    ctx.fillText(currentLetter.letter, w / 2, h / 2);
  }, [currentLetter]);

  // Draw the outline overlay on top of user drawing
  const drawOutline = useCallback(() => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    if (!canvas || !mask) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // We need a separate approach: use compositing to clip user strokes to letter shape
    // The mask canvas holds the letter shape
  }, []);

  // Initialize canvases
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    const size = Math.min(container.clientWidth, 400);
    canvas.width = size * 2; // retina
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const mask = maskRef.current;
    if (mask) {
      mask.width = size * 2;
      mask.height = size * 2;
    }

    createLetterMask();
    redraw();
  }, [currentIndex, createLetterMask]);

  // Store user strokes on a separate buffer
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Create off-screen buffer for strokes
    const buf = document.createElement("canvas");
    buf.width = canvas.width;
    buf.height = canvas.height;
    strokeCanvasRef.current = buf;
  }, [currentIndex]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    const strokeCanvas = strokeCanvasRef.current;
    if (!canvas || !mask || !strokeCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw light fill of letter shape as background hint
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.drawImage(mask, 0, 0);
    ctx.restore();

    // 2. Draw user strokes clipped to letter shape
    ctx.save();
    // Use mask as clip: destination-in compositing
    // First draw strokes to a temp canvas, then composite
    const temp = document.createElement("canvas");
    temp.width = w;
    temp.height = h;
    const tCtx = temp.getContext("2d");
    if (tCtx) {
      // Draw the user strokes
      tCtx.drawImage(strokeCanvas, 0, 0);
      // Clip to letter shape using destination-in
      tCtx.globalCompositeOperation = "destination-in";
      tCtx.drawImage(mask, 0, 0);
    }
    ctx.drawImage(temp, 0, 0);
    ctx.restore();

    // 3. Draw letter outline on top
    ctx.save();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.min(w, h) * 0.7}px "Amiri", serif`;
    ctx.strokeText(currentLetter.letter, w / 2, h / 2);
    ctx.restore();

    // 4. Draw letter name below
    ctx.save();
    ctx.fillStyle = "#6B7280";
    ctx.textAlign = "center";
    ctx.font = `${24}px sans-serif`;
    ctx.fillText(currentLetter.name, w / 2, h - 30);
    ctx.restore();
  }, [currentLetter]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing.current || !lastPos.current) return;
    const strokeCanvas = strokeCanvasRef.current;
    if (!strokeCanvas) return;
    const ctx = strokeCanvas.getContext("2d");
    if (!ctx) return;

    const pos = getPos(e);

    if (isErasing) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = brushSize * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = brushSize;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
    redraw();
  };

  const stopDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const strokeCanvas = strokeCanvasRef.current;
    if (!strokeCanvas) return;
    const ctx = strokeCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    redraw();
  };

  const goTo = (idx: number) => {
    const next = Math.max(0, Math.min(arabicAlphabet.length - 1, idx));
    setCurrentIndex(next);
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
          {/* Brush sizes */}
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

          {/* Eraser */}
          <button
            onClick={() => setIsErasing(!isErasing)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isErasing ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Eraser className="w-4 h-4" /> Rubber
          </button>

          {/* Clear */}
          <button
            onClick={clearCanvas}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
          >
            <Trash2 className="w-4 h-4" /> Clear
          </button>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="p-3 rounded-xl bg-muted text-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="font-arabic text-3xl text-primary">{currentLetter.letter}</p>
          <button
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex === arabicAlphabet.length - 1}
            className="p-3 rounded-xl bg-muted text-foreground disabled:opacity-30 transition-opacity"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColoringPage;
