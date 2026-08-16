"use client";

import { useState, useEffect } from "react";
import {
  X, Radio, Key, Globe, Play, Square, AlertTriangle,
  CheckCircle2, Shield, Activity, Eye, EyeOff, Tv, Sparkles, Copy, Check
} from "lucide-react";

interface FacebookLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  isStreaming: boolean;
  onStartStream: (config: { serverUrl: string; streamKey: string; resolution: string; bitrate: number }) => void;
  onStopStream: () => void;
  streamDuration: number;
  currentBitrate: number;
  chunksSent: number;
}

export default function FacebookLiveModal({
  isOpen,
  onClose,
  isStreaming,
  onStartStream,
  onStopStream,
  streamDuration,
  currentBitrate,
  chunksSent,
}: FacebookLiveModalProps) {
  const [serverUrl, setServerUrl] = useState("rtmps://live-api-s.facebook.com:443/rtmp/");
  const [streamKey, setStreamKey] = useState("FB-1509884729151154-0-Ab7_Ow-FMwid7BCp9GSB1lCs");
  const [showKey, setShowKey] = useState(false);
  const [resolution, setResolution] = useState<"1080p" | "720p">("1080p");
  const [bitrate, setBitrate] = useState<number>(3500);
  const [activeTab, setActiveTab] = useState<"direct" | "obs">("direct");
  const [copiedKey, setCopiedKey] = useState(false);

  // Cargar clave guardada de localStorage si existe
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("fb_live_stream_key");
      if (savedKey) setStreamKey(savedKey);
      const savedUrl = localStorage.getItem("fb_live_server_url");
      if (savedUrl) setServerUrl(savedUrl);
    } catch { }
  }, []);

  const handleSaveAndStart = () => {
    if (!streamKey.trim()) {
      alert("Por favor ingresa tu clave de transmisión de Facebook Live.");
      return;
    }
    try {
      localStorage.setItem("fb_live_stream_key", streamKey);
      localStorage.setItem("fb_live_server_url", serverUrl);
    } catch { }

    onStartStream({
      serverUrl: serverUrl.trim(),
      streamKey: streamKey.trim(),
      resolution,
      bitrate,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDuration = (s: number) => {
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${hrs > 0 ? `${hrs.toString().padStart(2, "0")}:` : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative flex flex-col gap-5 max-h-[92vh] overflow-y-auto no-scrollbar">

        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Encabezado con Icono de Facebook Live */}
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-2xl">
            <Radio className={`w-7 h-7 ${isStreaming ? "animate-pulse text-red-400" : "text-blue-400"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">Facebook Live Studio</h2>
              <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                isStreaming
                  ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                  : "bg-blue-500/10 text-blue-400 border-blue-500/30"
              }`}>
                {isStreaming ? "🔴 EN VIVO" : "RTMPS 1080p"}
              </span>
            </div>
            <p className="text-xs text-zinc-400">Emite tu cámara, logo, rótulos de redes y guion en directo</p>
          </div>
        </div>

        {/* Pestañas de modo */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-2xl border border-zinc-800 text-xs">
          <button
            onClick={() => setActiveTab("direct")}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition ${
              activeTab === "direct"
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4" /> Emisión Directa Web
          </button>
          <button
            onClick={() => setActiveTab("obs")}
            className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 font-bold transition ${
              activeTab === "obs"
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/40"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Tv className="w-4 h-4" /> Integración OBS / vMix
          </button>
        </div>

        {/* MONITOR DE TRANSMISIÓN EN TIEMPO REAL SI ESTÁ EMITIENDO */}
        {isStreaming && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                <span className="font-bold text-red-400 text-sm">TRANSMITIENDO EN VIVO</span>
              </div>
              <span className="font-mono text-base font-black text-white bg-black/40 px-3 py-1 rounded-xl border border-red-500/30">
                {formatDuration(streamDuration)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-500/20 text-center font-mono text-xs">
              <div className="bg-black/30 p-2 rounded-xl">
                <span className="text-[10px] text-zinc-400 uppercase block">Bitrate</span>
                <span className="font-bold text-emerald-400">{currentBitrate} kbps</span>
              </div>
              <div className="bg-black/30 p-2 rounded-xl">
                <span className="text-[10px] text-zinc-400 uppercase block">Resolución</span>
                <span className="font-bold text-white">{resolution}</span>
              </div>
              <div className="bg-black/30 p-2 rounded-xl">
                <span className="text-[10px] text-zinc-400 uppercase block">Paquetes</span>
                <span className="font-bold text-blue-400">{chunksSent}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === "direct" ? (
          <div className="space-y-4">
            {/* URL DEL SERVIDOR RTMPS */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" /> Servidor RTMP de Facebook Live
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-zinc-200 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                placeholder="rtmps://live-api-s.facebook.com:443/rtmp/"
              />
            </div>

            {/* CLAVE DE TRANSMISIÓN (STREAM KEY) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" /> Clave de Transmisión (Stream Key)
                </label>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                >
                  {showKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showKey ? "Ocultar" : "Mostrar"}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={streamKey}
                  onChange={(e) => setStreamKey(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl px-4 py-2.5 text-xs font-mono text-emerald-400 focus:ring-1 focus:ring-blue-500 focus:outline-none tracking-wider pr-10"
                  placeholder="FB-XXXXXXXXXXXX..."
                />
              </div>
              <p className="text-[11px] text-zinc-500">
                Tu clave actual configurada: <span className="font-mono text-zinc-400">{streamKey.slice(0, 8)}••••••••••••••••</span>
              </p>
            </div>

            {/* CALIDAD Y BITRATE */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">Resolución</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-xs text-white"
                >
                  <option value="1080p">1080p Full HD (1920x1080)</option>
                  <option value="720p">720p HD (1280x720)</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-mono text-zinc-400 uppercase block mb-1">Tasa de Bits (Bitrate)</label>
                <select
                  value={bitrate}
                  onChange={(e) => setBitrate(+e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-xs text-white"
                >
                  <option value={4000}>4000 kbps (Fibra / Alta velocidad)</option>
                  <option value={3000}>3000 kbps (Recomendado)</option>
                  <option value={2000}>2000 kbps (Conexión media)</option>
                </select>
              </div>
            </div>

            {/* BOTÓN PRINCIPAL DE TRANSMISIÓN */}
            <div className="pt-2">
              {!isStreaming ? (
                <button
                  onClick={handleSaveAndStart}
                  className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-blue-900/40 transition active:scale-98"
                >
                  <Radio className="w-5 h-5 animate-pulse" />
                  🔴 Emitir en Facebook Live Ahora
                </button>
              ) : (
                <button
                  onClick={onStopStream}
                  className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-red-900/40 transition active:scale-98 animate-pulse"
                >
                  <Square className="w-5 h-5" />
                  ⏹ Finalizar Transmisión en Facebook
                </button>
              )}
            </div>
          </div>
        ) : (
          /* PESTAÑA MODO OBS / VMIX */
          <div className="space-y-4 text-xs text-zinc-300">
            <p className="text-zinc-400">
              Si utilizas software de transmisión como <b>OBS Studio, vMix o Streamlabs</b>, puedes enviar la señal con tu teleprompter directamente a Facebook:
            </p>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 space-y-3 font-mono">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Servidor:</span>
                <span className="text-blue-400 select-all">{serverUrl}</span>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 uppercase block">Clave de Transmisión:</span>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-emerald-400 truncate max-w-xs">{streamKey}</span>
                  <button
                    onClick={() => copyToClipboard(streamKey)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-[11px]"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey ? "Copiada" : "Copiar"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-2xl flex items-start gap-2.5 text-blue-300">
              <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
              <span>
                En OBS ve a <b>Ajustes ➔ Emisión ➔ Servicio: Facebook Live</b> y pega la clave de transmisión.
              </span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
