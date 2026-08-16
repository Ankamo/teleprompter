"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, X, RotateCcw } from "lucide-react";
import type { ContrastTheme } from "@/lib/scriptParser";

interface FloatingPrompterWindowProps {
  text: string;
  isPrompting: boolean;
  onTogglePrompting: () => void;
  scrollSpeed: number;
  onSpeedChange: (speed: number) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  eyeLinePos: number;
  theme: ContrastTheme;
  textMirrorH: boolean;
  textMirrorV: boolean;
  onClose: () => void;
}

export default function FloatingPrompterWindow({
  text,
  isPrompting,
  onTogglePrompting,
  scrollSpeed,
  onSpeedChange,
  fontSize,
  onFontSizeChange,
  eyeLinePos,
  theme,
  textMirrorH,
  textMirrorV,
  onClose,
}: FloatingPrompterWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTimeRef = useRef(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const scrollLoop = (timestamp: number) => {
      if (!isPrompting || !containerRef.current) return;
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;

      if (delta > 16) {
        const el = containerRef.current;
        el.scrollTop += scrollSpeed * 0.5;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 5) {
          onTogglePrompting();
          return;
        }
        lastTimeRef.current = timestamp;
      }
      animRef.current = requestAnimationFrame(scrollLoop);
    };

    if (isPrompting) {
      lastTimeRef.current = 0;
      animRef.current = requestAnimationFrame(scrollLoop);
    } else if (animRef.current) {
      cancelAnimationFrame(animRef.current);
    }

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isPrompting, scrollSpeed, onTogglePrompting]);

  const resetScroll = () => {
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  return (
    <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-96 sm:h-[460px] bg-black/95 text-white border border-zinc-700/80 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
      {/* Header flotante */}
      <div className="px-3.5 py-2.5 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono font-bold text-zinc-300">Prompter Flotante (PiP)</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
          title="Cerrar ventana flotante"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Visor con línea de enfoque */}
      <div className="relative flex-1 bg-black overflow-hidden flex flex-col">
        {/* Línea guía de ojos */}
        <div
          className="absolute left-0 right-0 h-0.5 shadow-md pointer-events-none z-10"
          style={{
            top: `${eyeLinePos}%`,
            backgroundColor: theme.eyeLineColor,
            boxShadow: `0 0 10px ${theme.eyeLineColor}`,
          }}
        />

        {/* Contenedor de texto con scroll */}
        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto no-scrollbar py-28 px-4 text-center select-none"
        >
          <p
            className="font-bold leading-relaxed whitespace-pre-line drop-shadow-md transition-transform"
            style={{
              fontSize: `${fontSize}px`,
              color: theme.textColor,
              transform: `scaleX(${textMirrorH ? -1 : 1}) scaleY(${textMirrorV ? -1 : 1})`,
            }}
          >
            {text}
          </p>
        </div>
      </div>

      {/* Controles inferiores flotantes */}
      <div className="p-3 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onTogglePrompting}
            className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
              isPrompting
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
            }`}
          >
            {isPrompting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </button>

          <button
            onClick={resetScroll}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition"
            title="Reiniciar scroll"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Selector de velocidad */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-400">VEL</span>
          <input
            type="range"
            min="0.5"
            max="8"
            step="0.5"
            value={scrollSpeed}
            onChange={(e) => onSpeedChange(+e.target.value)}
            className="w-16 accent-emerald-400 h-1.5 bg-zinc-800 rounded cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-emerald-400 w-7">{scrollSpeed}x</span>
        </div>

        {/* Tamaño de fuente */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onFontSizeChange(Math.max(18, fontSize - 2))}
            className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold"
          >
            A-
          </button>
          <button
            onClick={() => onFontSizeChange(Math.min(60, fontSize + 2))}
            className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold"
          >
            A+
          </button>
        </div>
      </div>
    </div>
  );
}
