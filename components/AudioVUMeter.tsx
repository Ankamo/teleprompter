"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, AlertTriangle } from "lucide-react";

interface AudioVUMeterProps {
  stream: MediaStream | null;
  className?: string;
}

export default function AudioVUMeter({ stream, className = "" }: AudioVUMeterProps) {
  const [level, setLevel] = useState(0); // 0 a 100
  const [peak, setPeak] = useState(0);   // 0 a 100
  const [isClipping, setIsClipping] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const peakDecayRef = useRef<number>(0);
  const clipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      setPeak(0);
      setIsClipping(false);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length || !audioTracks[0].enabled) {
      setLevel(0);
      setPeak(0);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calcular RMS (Root Mean Square) del buffer de audio
        let sumSquares = 0;
        let peakValue = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const norm = (dataArray[i] - 128) / 128;
          const abs = Math.abs(norm);
          if (abs > peakValue) peakValue = abs;
          sumSquares += norm * norm;
        }

        const rms = Math.sqrt(sumSquares / dataArray.length);
        // Escala no lineal perceptual (0 a 100)
        const currentLevel = Math.min(100, Math.round(rms * 280));
        setLevel(currentLevel);

        // Peak Hold con caída suave
        if (currentLevel > peakDecayRef.current) {
          peakDecayRef.current = currentLevel;
        } else {
          peakDecayRef.current = Math.max(0, peakDecayRef.current - 1.2);
        }
        setPeak(Math.round(peakDecayRef.current));

        // Detección de Clipping (> 95% del rango o pico > 0.98)
        if (peakValue > 0.95 || currentLevel >= 95) {
          setIsClipping(true);
          if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
          clipTimeoutRef.current = setTimeout(() => setIsClipping(false), 1200);
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (clipTimeoutRef.current) clearTimeout(clipTimeoutRef.current);
        source.disconnect();
        analyser.disconnect();
        if (audioCtx.state !== "closed") {
          audioCtx.close();
        }
      };
    } catch (err) {
      console.warn("AudioContext VU Meter initialization failed:", err);
    }
  }, [stream]);

  // Generar 16 segmentos de barra LED
  const segments = 16;
  const activeSegments = Math.round((level / 100) * segments);
  const peakSegment = Math.min(segments - 1, Math.floor((peak / 100) * segments));

  return (
    <div className={`flex items-center gap-2.5 bg-zinc-950/80 border border-zinc-800/80 px-3 py-1.5 rounded-xl text-xs ${className}`}>
      <div className="flex items-center gap-1.5 text-zinc-400">
        <Mic className={`w-3.5 h-3.5 ${level > 5 ? "text-emerald-400 animate-pulse" : "text-zinc-500"}`} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">MIC VU</span>
      </div>

      {/* Barra de Segmentos LED */}
      <div className="flex items-center gap-0.5 flex-1 max-w-[130px] h-3 bg-zinc-900 rounded px-1">
        {Array.from({ length: segments }).map((_, i) => {
          const isActive = i < activeSegments;
          const isPeakBar = i === peakSegment && peak > 5;

          let colorClass = "bg-zinc-800";
          if (isActive || isPeakBar) {
            if (i < 10) {
              colorClass = "bg-emerald-500 shadow-[0_0_6px_#10b981]";
            } else if (i < 14) {
              colorClass = "bg-amber-400 shadow-[0_0_6px_#f59e0b]";
            } else {
              colorClass = "bg-red-500 shadow-[0_0_8px_#ef4444]";
            }
          }

          return (
            <div
              key={i}
              className={`flex-1 h-2 rounded-[1px] transition-all duration-75 ${colorClass}`}
            />
          );
        })}
      </div>

      {/* Alerta de Clipping */}
      {isClipping ? (
        <span className="flex items-center gap-0.5 text-[10px] font-bold font-mono text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/40 animate-pulse">
          <AlertTriangle className="w-2.5 h-2.5" /> CLIP!
        </span>
      ) : (
        <span className="font-mono text-[10px] text-zinc-500 w-7 text-right">
          {level > 0 ? `${level}%` : "MUTE"}
        </span>
      )}
    </div>
  );
}
