"use client";

import { useState, useRef, useEffect } from "react";

export default function TeleprompterStudioElegante() {
  const [isRecording, setIsRecording] = useState(false);
  const [showSceneScript, setShowSceneScript] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [scenes, setScenes] = useState([
    {
      id: 1,
      title: "ESCENA 1",
      text: "Este es el texto del teleprompter para la primera escena. Puedes generar más escenas escribiendo un guion con bloques separados.",
    },
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [text, setText] = useState(scenes[0].text);
  const [scriptText, setScriptText] = useState(
    `Escena 1\nEste es el texto del teleprompter para la primera escena.\n\nEscena 2\nAquí va el texto para la segunda escena, separada por una línea en blanco.`
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
      console.error("Error al acceder a la cámara:", err);
      setCameraReady(false);
      setCameraError("Acceso a la cámara denegado o no disponible en este dispositivo.");
    }
  };

  const generateScenesFromScript = () => {
    const rawScenes = scriptText
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (rawScenes.length === 0) return;

    const newScenes = rawScenes.map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const firstLine = lines[0] ?? `ESCENA ${index + 1}`;
      const title = firstLine.toLowerCase().startsWith("escena")
        ? firstLine.toUpperCase()
        : `ESCENA ${index + 1}`;
      const body = lines.slice(1).join(" ").trim();

      return {
        id: index + 1,
        title,
        text: body || firstLine,
      };
    });

    setScenes(newScenes);
    setCurrentSceneIndex(0);
  };

  useEffect(() => {
    accessCamera();
  }, []);

  useEffect(() => {
    const currentScene = scenes[currentSceneIndex] ?? scenes[0];
    setText(currentScene.text);
  }, [currentSceneIndex, scenes]);

  const startRecording = () => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (!stream) return;

    chunksRef.current = [];
    
    // Configuración de tipos mime más compatibles universalmente para evitar el error de Opus en Windows
    let options = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm" };
    }

    try {
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
        a.download = `video-prompter-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };

      recorder.start(250); // Graba en fragmentos continuos pequeños para evitar pérdidas
      setIsRecording(true);
      setShowSceneScript(true);
    } catch (e) {
      console.error("Error al iniciar MediaRecorder:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowSceneScript(false);
    }
  };

  return (
    // Se removió 'select-none' para garantizar la copia y pega libre de texto en cualquier dispositivo
    <main className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans antialiased">
      
      {/* Nodo de cámara oculto en segundo plano. Sigue procesando el video, pero sin estorbar la UI */}
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />

      <div className="w-full max-w-2xl flex flex-col gap-5">
        
        {/* PANTALLA PRINCIPAL DEL PROMPTER */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md transition-all">
          
          {/* Header Superior Minimalista */}
          <div className="px-6 py-4 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/40">
            <div className="flex flex-col">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Estudio de Teleprompter</span>
              <span className="text-sm font-semibold tracking-tight text-white mt-0.5">
                {scenes[currentSceneIndex]?.title ?? "ESCENA 1"}
              </span>
            </div>
            
            <div className="flex items-center gap-2.5 bg-zinc-950/60 px-3 py-1 rounded-full border border-zinc-800">
              <span className={`w-2 h-2 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">
                {isRecording ? "Grabando" : "Cámara Lista"}
              </span>
            </div>
          </div>

          {/* Área Central del Texto */}
          <div className="p-8 sm:p-12 min-h-[260px] flex items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950/10 to-zinc-900/40">
            <p className={`text-center text-xl sm:text-2xl font-medium leading-relaxed max-w-lg transition-colors duration-300 ${
              isRecording ? "text-white font-semibold drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]" : "text-zinc-400"
            }`}>
              {text}
            </p>
          </div>

          {/* Selector de Navegación de Escenas Integrado en el Prompter */}
          {scenes.length > 1 && (
            <div className="px-6 py-3 bg-zinc-950/40 border-t border-zinc-800/40 flex justify-between items-center">
              <span className="text-xs font-mono text-zinc-500">
                Bloque {currentSceneIndex + 1} de {scenes.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentSceneIndex((prev) => Math.max(prev - 1, 0))}
                  disabled={currentSceneIndex === 0}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-[11px] font-medium rounded-lg border border-zinc-700 transition"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentSceneIndex((prev) => Math.min(prev + 1, scenes.length - 1))}
                  disabled={currentSceneIndex === scenes.length - 1}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:hover:bg-zinc-800 text-[11px] font-medium rounded-lg border border-zinc-700 transition"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}

          {/* Barra de Control de Grabación */}
          <div className="p-4 bg-zinc-950/80 border-t border-zinc-800/80 flex flex-col items-center justify-center">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={!cameraReady}
                className="w-full sm:w-auto py-3 px-8 bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:cursor-not-allowed"
              >
                🔴 Iniciar Grabación
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="w-full sm:w-auto py-3 px-8 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
              >
                <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                ⏹️ Detener y Guardar
              </button>
            )}
            {cameraError && (
              <p className="text-xs text-red-400 mt-2 font-mono">{cameraError}</p>
            )}
          </div>
        </div>

        {/* CONTENEDOR DEL GUION / ÁREA DE COPIADO */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xs font-mono uppercase tracking-widest text-zinc-400">Editor de Guion</h3>
            <p className="text-xs text-zinc-500">
              Copia, pega o edita tu contenido. Deja una línea en blanco entre bloques para segmentar tus escenas automáticamente.
            </p>
          </div>

          <textarea
            value={scriptText}
            onChange={(event) => setScriptText(event.target.value)}
            rows={5}
            placeholder="Pega tu texto aquí..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none transition focus:border-zinc-700 font-sans leading-relaxed"
          />

          <div className="flex justify-between items-center">
            <button
              type="button"
              onClick={generateScenesFromScript}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-zinc-700 transition flex items-center gap-1.5"
            >
              ✨ Actualizar Prompter
            </button>
            <span className="text-[11px] font-mono text-zinc-500 bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800">
              {scenes.length} {scenes.length === 1 ? "Escena cargada" : "Escenas detectadas"}
            </span>
          </div>
        </div>

      </div>
    </main>
  );
}
