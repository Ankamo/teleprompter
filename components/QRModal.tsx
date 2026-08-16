"use client";

import { useState } from "react";
import { X, Copy, Check, QrCode, Smartphone, Sparkles, Gamepad2, Camera } from "lucide-react";
import { generateQRCodeSVG } from "@/lib/qrGenerator";

interface QRModalProps {
  code: string;
  onClose: () => void;
}

export default function QRModal({ code, onClose }: QRModalProps) {
  const [copied, setCopied] = useState(false);
  const [targetMode, setTargetMode] = useState<"controller" | "camera">("controller");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pairingUrl = `${origin}/?code=${code}&mode=${targetMode}`;
  const qrSvg = generateQRCodeSVG(pairingUrl, "#10b981", "#09090b", 2);

  const copyLink = () => {
    navigator.clipboard.writeText(pairingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative space-y-5 text-center">
        {/* Botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Encabezado */}
        <div>
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl mb-2">
            <QrCode className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-white">Escanear para Emparejar</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Apunta la cámara de tu smartphone para conectar al instante
          </p>
        </div>

        {/* Selector de propósito en el móvil */}
        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            onClick={() => setTargetMode("controller")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium transition ${
              targetMode === "controller"
                ? "bg-emerald-600 text-white font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" /> Mando Táctil
          </button>
          <button
            onClick={() => setTargetMode("camera")}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium transition ${
              targetMode === "camera"
                ? "bg-emerald-600 text-white font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> Cámara Remota
          </button>
        </div>

        {/* Gráfico QR SVG enmarcado */}
        <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 inline-block shadow-inner">
          <div
            className="w-48 h-48 mx-auto"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        </div>

        {/* Código de 6 caracteres y botón de copia */}
        <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-2xl flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-mono text-zinc-500 uppercase block">Código Host</span>
            <span className="text-lg font-mono font-black text-emerald-400 tracking-[0.2em]">{code}</span>
          </div>

          <button
            onClick={copyLink}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold border border-zinc-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "¡Copiado!" : "Copiar Enlace"}</span>
          </button>
        </div>

        <p className="text-[11px] text-zinc-500">
          No requiere descargar ninguna aplicación adicional en tu teléfono.
        </p>
      </div>
    </div>
  );
}
