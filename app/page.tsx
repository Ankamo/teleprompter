"use client";

import { useState, useRef, useEffect } from "react";

export default function TeleprompterProduccion() {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [scenes, setScenes] = useState([
    { id: 1, title: "ESCENA 1", text: "Este es el texto de tu teleprompter. Puedes cambiar de escena o pegar tu propio guion abajo." }
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [scriptText, setScriptText] = useState(
    `ESCENA 1\nEste es el texto de tu teleprompter. Puedes cambiar de escena o pegar tu propio guion abajo.\n\nESCENA 2\nEste es el texto de la segunda escena. ¡Pega aquí lo que quieras!`
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const accessCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: "user" },
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      setCameraReady(false);
      setCameraError("No se pudo acceder a la cámara. Revisa los permisos.");
    }
  };

  const generateScenes = () => {
    const blocks = scriptText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    if (blocks.length === 0) return;

    const newScenes = blocks.map((block, i) => {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      const firstLine = lines[0] ?? `ESCENA ${i + 1}`;
      const title = firstLine.toUpperCase().startsWith("ESCENA") ? firstLine.toUpperCase() : `ESCENA ${i + 1}`;
      const body = lines.slice(1).join(" ").trim();
      return { id: i + 1, title, text: body || firstLine };
    });

    setScenes(newScenes);
    setCurrentSceneIndex(0);
  };

  useEffect(() => {
    accessCamera();
  }, []);

  const startRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    chunksRef.current = [];
    let options = { mimeType: "video/webm;codecs=vp8,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: "video/webm" };

    const recorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Se guarda como .webm para evitar errores de codificación en Windows Player
      a.download = `teleprompter-${Date.now()}.webm`;
      a.click();
    };

    recorder.start(250);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-3xl flex flex-col gap-6">
        
        {/* 1. VISOR DE LA CÁMARA (HORIZONTAL 16:9) */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/50">
            <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">Vista de Grabación</span>
            <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>

          <div className="w-full aspect-video bg-black relative flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            
            {/* Texto superpuesto únicamente cuando se está grabando */}
            {isRecording && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-8 backdrop-blur-[1px]">
                <div className="max-w-xl text-center">
                  <span className="text-[10px] font-mono bg-red-600 text-white px-2 py-0.5 rounded-md uppercase tracking-widest block w-max mx-auto mb-3 animate-pulse">
                    {scenes[currentSceneIndex]?.title || "PROMPTER"}
                  </span>
                  <p className="text-white text-lg sm:text-2xl font-bold leading-relaxed drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] select-none">
                    {scenes[currentSceneIndex]?.text}
                  </p>
                </div>
              </div>
            )}

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-xs text-zinc-400">
                {cameraError || "Accediendo a la cámara..."}
              </div>
            )}
          </div>

          {/* Botón de Grabación integrado debajo del Visor */}
          <div className="p-3 bg-zinc-950/80 border-t border-zinc-800 flex justify-center">
            {!isRecording ? (
              <button 
                onClick={startRecording} 
                disabled={!cameraReady} 
                className="py-2.5 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
              >
                🔴 Iniciar Grabación
              </button>
            ) : (
              <button 
                onClick={stopRecording} 
                className="py-2.5 px-6 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all animate-pulse"
              >
                ⏹️ Detener y Guardar
              </button>
            )}
          </div>
        </div>

        {/* 2. BARRA DE TEXTO PARA AGREGAR EL GUION */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Editor de Guion</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Escribe o pega tu texto aquí. Usa doble espacio (Enter) para fragmentar las escenas.</p>
          </div>

          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={5}
            placeholder="Pega tu guion aquí..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-700 font-sans leading-relaxed"
          />

          <button 
            onClick={generateScenes} 
            className="self-start px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-zinc-700 transition"
          >
            ✨ Cargar Guion al Prompter
          </button>
        </div>

        {/* 3. VISUALIZADOR DE ESCENAS GENERADAS */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
          <div className="px-5 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
            <span className="text-xs font-semibold text-zinc-300">
              Vista del Guion: {scenes[currentSceneIndex]?.title || "ESCENA"}
            </span>
            <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2.5 py-0.5 rounded border border-zinc-800">
              {currentSceneIndex + 1} / {scenes.length}
            </span>
          </div>

          <div className="p-6 min-h-[120px] flex items-center justify-center bg-zinc-950/20">
            <p className="text-center text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
              {scenes[currentSceneIndex]?.text}
            </p>
          </div>

          {scenes.length > 1 && (
            <div className="px-4 py-3 bg-zinc-950/40 border-t border-zinc-800 flex justify-end gap-2">
              <button
                disabled={currentSceneIndex === 0}
                onClick={() => setCurrentSceneIndex(p => Math.max(p - 1, 0))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg disabled:opacity-30 border border-zinc-700 transition"
              >
                ← Anterior
              </button>
              <button
                disabled={currentSceneIndex === scenes.length - 1}
                onClick={() => setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1))}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg disabled:opacity-30 border border-zinc-700 transition"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
