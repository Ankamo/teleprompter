"use client";

import {
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight,
  FlipHorizontal, FlipVertical, Radio, Sparkles, Volume2, ShieldAlert
} from "lucide-react";
import type { DataConnection } from "peerjs";

interface RemoteControllerProps {
  hostId: string;
  dataConnection: DataConnection | null;
  isConnected: boolean;
  onDisconnect: () => void;
  // Estado local sincronizado recibido desde el Host
  hostState: {
    isPrompting: boolean;
    isRecording: boolean;
    scrollSpeed: number;
    currentSceneIndex: number;
    totalScenes: number;
    sceneTitle: string;
    scriptTitle: string;
  };
}

export default function RemoteController({
  hostId,
  dataConnection,
  isConnected,
  onDisconnect,
  hostState,
}: RemoteControllerProps) {

  const sendAction = (action: string, payload?: any) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(30);
      } catch { }
    }

    if (dataConnection && dataConnection.open) {
      dataConnection.send({
        type: "remote-control-action",
        action,
        payload,
      });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none touch-manipulation">
      {/* Barra superior de estado */}
      <header className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 p-3.5 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className={`w-3 h-3 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" : "bg-amber-500"}`} />
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
              {isConnected ? "Control Vinculado" : "Conectando..."}
            </div>
            <div className="font-mono font-bold text-emerald-400 text-xs">
              Host: {hostId || "---"}
            </div>
          </div>
        </div>

        <button
          onClick={onDisconnect}
          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold border border-zinc-700 transition"
        >
          Desconectar
        </button>
      </header>

      {/* Tarjeta central informativa */}
      <div className="my-auto py-4 space-y-5">
        {/* Info de la Escena Actual */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-2xl p-4 text-center shadow-lg">
          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block mb-1">
            {hostState.scriptTitle || "Guion en Host"}
          </span>
          <h2 className="text-xl font-bold text-white tracking-wide">
            {hostState.sceneTitle || `Escena ${hostState.currentSceneIndex + 1}`}
          </h2>
          <div className="text-xs font-mono text-emerald-400 mt-1">
            Escena {hostState.currentSceneIndex + 1} de {Math.max(1, hostState.totalScenes)}
          </div>
        </div>

        {/* BOTÓN GIGANTE PLAY / PAUSA */}
        <div className="flex justify-center">
          <button
            onClick={() => sendAction("toggle-prompting")}
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 shadow-2xl transition-all active:scale-95 border-4 ${
              hostState.isPrompting
                ? "bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.35)]"
                : "bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.35)]"
            }`}
          >
            {hostState.isPrompting ? (
              <>
                <Pause className="w-12 h-12 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-wider">PAUSAR</span>
              </>
            ) : (
              <>
                <Play className="w-12 h-12 ml-1.5 stroke-[2.5]" />
                <span className="text-xs font-black uppercase tracking-wider">LEER</span>
              </>
            )}
          </button>
        </div>

        {/* CONTROL DE VELOCIDAD */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-mono text-zinc-400 uppercase tracking-wider">Velocidad del Prompter</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{hostState.scrollSpeed}x</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => sendAction("speed-down")}
              className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 active:scale-90 rounded-xl font-bold text-lg text-white border border-zinc-700 flex items-center justify-center"
            >
              -
            </button>

            <input
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              value={hostState.scrollSpeed}
              onChange={(e) => sendAction("set-speed", +e.target.value)}
              className="flex-1 accent-emerald-500 h-2 bg-zinc-800 rounded-lg cursor-pointer"
            />

            <button
              onClick={() => sendAction("speed-up")}
              className="w-12 h-12 bg-zinc-800 hover:bg-zinc-700 active:scale-90 rounded-xl font-bold text-lg text-white border border-zinc-700 flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        {/* NAVEGACIÓN DE ESCENAS & REINICIO */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            onClick={() => sendAction("prev-scene")}
            className="py-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-95 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold"
          >
            <ChevronLeft className="w-5 h-5 text-emerald-400" />
            <span>Ant.</span>
          </button>

          <button
            onClick={() => sendAction("restart-scroll")}
            className="py-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-95 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold text-amber-300"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Reiniciar</span>
          </button>

          <button
            onClick={() => sendAction("next-scene")}
            className="py-3.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 active:scale-95 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold"
          >
            <ChevronRight className="w-5 h-5 text-emerald-400" />
            <span>Sig.</span>
          </button>
        </div>

        {/* BOTÓN DISPARADOR DE GRABACIÓN REMOTA */}
        <button
          onClick={() => sendAction("toggle-recording")}
          className={`w-full py-4 rounded-2xl font-bold uppercase tracking-wider text-sm flex items-center justify-center gap-2.5 transition active:scale-95 shadow-lg ${
            hostState.isRecording
              ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
          }`}
        >
          <span className="w-3.5 h-3.5 rounded-full bg-current animate-pulse" />
          {hostState.isRecording ? "Detener Grabación en Host" : "Iniciar Grabación en Host"}
        </button>
      </div>

      {/* Footer con atajos de espejo */}
      <footer className="pt-2 border-t border-zinc-900 flex justify-between items-center text-xs text-zinc-500 font-mono">
        <button
          onClick={() => sendAction("toggle-text-mirror-h")}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white"
        >
          <FlipHorizontal className="w-4 h-4" /> Espejo H
        </button>

        <button
          onClick={() => sendAction("toggle-text-mirror-v")}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl hover:text-white"
        >
          <FlipVertical className="w-4 h-4" /> Espejo V
        </button>
      </footer>
    </div>
  );
}
