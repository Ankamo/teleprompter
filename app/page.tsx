"use client";

import { useState, useRef, useEffect } from "react";

export default function TeleprompterSencilloConCamara() {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [scenes, setScenes] = useState([
    { id: 1, title: "ESCENA 1", text: "Este es el texto de tu teleprompter. Puedes cambiar de escena o pegar tu propio guion abajo." }
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [scriptText, setScriptText] = useState(
    `Escena 1\nEste es el texto de tu teleprompter. Puedes cambiar de escena o pegar tu propio guion abajo.\n\nEscena 2\nEste es el texto de la segunda escena. ¡Pega aquí lo que quieras!`
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Activar cámara y mostrarla en pantalla
  const accessCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
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
      const title = firstLine.toLowerCase().startsWith("escena") ? firstLine.toUpperCase() : `ESCENA ${i + 1}`;
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
      const blob = new Blob(chunksRef.current, { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teleprompter-${Date.now()}.mp4`;
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
    <main className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* SECCIÓN SUPERIOR: CÁMARA Y TEXTO LADO A LADO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* 1. El Visor de la Cámara (Ocupa 1 columna en pantallas grandes) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[200px]">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-2 self-start">Vista Previa</span>
            <div className="w-full aspect-video md:aspect-square bg-black rounded-xl overflow-hidden relative border border-zinc-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-xs text-zinc-400 text-center p-2">
                  {cameraError || "Cargando cámara..."}
                </div>
              )}
            </div>
          </div>

          {/* 2. El Teleprompter (Ocupa 2 columnas) */}
          <div className="md:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xl">
            <div className="px-5 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
              <span className="text-xs font-semibold text-zinc-300">{scenes[currentSceneIndex]?.title || "ESCENA"}</span>
              <span className={`h-2 w-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
            </div>

            {/* Texto para leer */}
            <div className="p-6 sm:p-8 flex items-center justify-center min-h-[160px] bg-zinc-950/20">
              <p className={`text-center text-lg sm:text-xl font-medium leading-relaxed max-w-md ${isRecording ? "text-white font-semibold" : "text-zinc-400"}`}>
                {scenes[currentSceneIndex]?.text}
              </p>
            </div>

            {/* Controles de Escena e Grabación */}
            <div className="p-4 bg-zinc-950/40 border-t border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex gap-1.5">
                <button
                  disabled={currentSceneIndex === 0}
                  onClick={() => setCurrentSceneIndex(p => Math.max(p - 1, 0))}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg disabled:opacity-30 border border-zinc-700"
                >
                  ←
                </button>
                <span className="text-xs font-mono px-2 py-1 bg-zinc-900 rounded-md border border-zinc-800 text-zinc-400 flex items-center">
                  {currentSceneIndex + 1} / {scenes.length}
                </span>
                <button
                  disabled={currentSceneIndex === scenes.length - 1}
                  onClick={() => setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1))}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-lg disabled:opacity-30 border border-zinc-700"
                >
                  →
                </button>
              </div>

              {!isRecording ? (
                <button onClick={startRecording} disabled={!cameraReady} className="py-2 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-xl transition-all disabled:opacity-40">
                  🔴 Grabar
                </button>
              ) : (
                <button onClick={stopRecording} className="py-2 px-5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all animate-pulse">
                  ⏹️ Detener
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ÁREA DE COPIAR / PEGAR EL GUION */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Guion Completo</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Pega tu texto aquí libremente. Separa con doble ENTER para crear nuevas escenas.</p>
          </div>

          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-700 font-sans leading-relaxed"
          />

          <button onClick={generateScenes} className="self-start px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-zinc-700 transition">
            ✨ Cargar Guion al Prompter
          </button>
        </div>

      </div>
    </main>
  );
}
