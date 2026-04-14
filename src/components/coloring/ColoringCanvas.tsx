import { useRef, useEffect, useCallback } from "react";
import { ArabicLetter } from "@/data/arabicAlphabet";

interface ColoringCanvasProps {
  letter: ArabicLetter;
  penColor: string;
  brushSize: number;
  isErasing: boolean;
  onComplete: () => void;
  onProgress: (percent: number) => void;
  resetKey: number;
}

const ColoringCanvas = ({ letter, penColor, brushSize, isErasing, onComplete, onProgress, resetKey }: ColoringCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const hasDrawn = useRef(false);

  const createLetterMask = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    const w = mask.width, h = mask.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#000000";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.min(w, h) * 0.7}px "Amiri", serif`;
    ctx.fillText(letter.letter, w / 2, h / 2);
  }, [letter]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const mask = maskRef.current;
    const strokeCanvas = strokeCanvasRef.current;
    if (!canvas || !mask || !strokeCanvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.drawImage(mask, 0, 0);
    ctx.restore();

    const temp = document.createElement("canvas");
    temp.width = w; temp.height = h;
    const tCtx = temp.getContext("2d");
    if (tCtx) {
      tCtx.drawImage(strokeCanvas, 0, 0);
      tCtx.globalCompositeOperation = "destination-in";
      tCtx.drawImage(mask, 0, 0);
    }
    ctx.drawImage(temp, 0, 0);

    ctx.save();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 3;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.min(w, h) * 0.7}px "Amiri", serif`;
    ctx.strokeText(letter.letter, w / 2, h / 2);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "#6B7280";
    ctx.textAlign = "center";
    ctx.font = `24px sans-serif`;
    ctx.fillText(letter.name, w / 2, h - 30);
    ctx.restore();
  }, [letter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;
    const size = Math.min(container.clientWidth, 400);
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const mask = maskRef.current;
    if (mask) { mask.width = size * 2; mask.height = size * 2; }
    const buf = document.createElement("canvas");
    buf.width = size * 2; buf.height = size * 2;
    strokeCanvasRef.current = buf;
    hasDrawn.current = false;
    createLetterMask();
    redraw();
  }, [letter, resetKey, createLetterMask, redraw]);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
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
    hasDrawn.current = true;
    redraw();
  };

  const stopDraw = () => {
    if (isDrawing.current && hasDrawn.current) {
      checkCoverage();
    }
    isDrawing.current = false;
    lastPos.current = null;
  };

  const checkCoverage = () => {
    const mask = maskRef.current;
    const strokeCanvas = strokeCanvasRef.current;
    if (!mask || !strokeCanvas) return;

    const temp = document.createElement("canvas");
    temp.width = mask.width; temp.height = mask.height;
    const tCtx = temp.getContext("2d");
    if (!tCtx) return;
    tCtx.drawImage(strokeCanvas, 0, 0);
    tCtx.globalCompositeOperation = "destination-in";
    tCtx.drawImage(mask, 0, 0);

    const clippedData = tCtx.getImageData(0, 0, temp.width, temp.height).data;
    const maskCtx = mask.getContext("2d");
    if (!maskCtx) return;
    const maskData = maskCtx.getImageData(0, 0, mask.width, mask.height).data;

    let maskPixels = 0, filledPixels = 0;
    for (let i = 3; i < maskData.length; i += 16) {
      if (maskData[i] > 128) {
        maskPixels++;
        if (clippedData[i] > 32) filledPixels++;
      }
    }
    const percent = maskPixels > 0 ? (filledPixels / maskPixels) * 100 : 0;
    onProgress(Math.min(100, percent));
    if (percent >= 45) {
      onComplete();
    }
  };

  const clearCanvas = () => {
    const strokeCanvas = strokeCanvasRef.current;
    if (!strokeCanvas) return;
    const ctx = strokeCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, strokeCanvas.width, strokeCanvas.height);
    hasDrawn.current = false;
    redraw();
  };

  return { canvasRef, maskRef, clearCanvas, startDraw, draw, stopDraw };
};

export default ColoringCanvas;
