"use client";

import { useState, useRef, useEffect } from "react";

export default function TeleprompterBasicoOculto() {
  const [isRecording, setIsRecording] = useState(false);
  const [showSceneScript, setShowSceneScript] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scenes, setScenes] = useState([
    {
      id: 1,
      title: "Escena 1",
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
        video: true,
        audio: true,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      setCameraReady(false);
      setCameraError("Permiso denegado. Activa el acceso a la cámara y recarga la página o vuelve a intentarlo.");
    }
  };

  const generateScenesFromScript = () => {
    const rawScenes = scriptText
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (rawScenes.length === 0) {
      return;
    }

    const newScenes = rawScenes.map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const firstLine = lines[0] ?? `Escena ${index + 1}`;
      const title = firstLine.toLowerCase().startsWith("escena")
        ? firstLine
        : `Escena ${index + 1}`;
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
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      
      // Descargar automáticamente el fragmento grabado
      const a = document.createElement("a");
      a.href = url;
      a.download = `grabacion-${Date.now()}.mp4`;
      a.click();
    };

    recorder.start();
    setIsRecording(true);
    setShowSceneScript(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setShowSceneScript(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans select-none">
      <div className="w-full max-w-3xl flex flex-col items-center gap-6">
        {/* Contenedor Principal tipo Tarjeta "Cámara" */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-zinc-700"}`} />
              <span className="text-xs uppercase tracking-widest text-zinc-500">{isRecording ? "Grabando" : "Listo"}</span>
            </div>
          </div>

          <div className="p-6 bg-zinc-950/10 flex flex-col items-center gap-6">
            <div className="relative w-full max-w-md aspect-square rounded-[2rem] border-4 border-zinc-800 bg-black overflow-hidden shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 border border-white/10 rounded-[2rem]" />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-4 left-4 w-14 h-14 border-2 border-white/40 rounded-full" />
                <div className="absolute top-4 right-4 bg-black/40 px-3 py-1 rounded-full text-[11px] uppercase tracking-[0.22em] text-white/80">CAM</div>
                <div className="absolute bottom-4 left-4 w-10 h-10 border-b-2 border-l-2 border-white/40 rounded-br-xl" />
                <div className="absolute bottom-4 right-4 w-10 h-10 border-b-2 border-r-2 border-white/40 rounded-bl-xl" />
              </div>
              {!videoRef.current?.srcObject && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center px-4">
                  <span className="text-sm text-zinc-300">Accediendo a la cámara...</span>
                </div>
              )}
            </div>

            <div className="w-full rounded-3xl bg-zinc-950/80 border border-zinc-800 p-6">
              <div className="flex flex-col gap-4 pb-4 mb-4 border-b border-zinc-800/50">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Escribe tu guion</p>
                <p className="text-sm text-zinc-400">
                  Separa cada escena con una línea en blanco. El primer texto de cada bloque puede ser el título o el contenido de la escena.
                </p>
              </div>
              <textarea
                value={scriptText}
                onChange={(event) => setScriptText(event.target.value)}
                rows={7}
                className="w-full rounded-3xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-zinc-600"
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={generateScenesFromScript}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:border-zinc-600 hover:bg-zinc-800"
                >
                  📜 Generar escenas
                </button>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                  {scenes.length} escena{scenes.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>
            <div className="mb-4 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Escena actual</p>
                  <p className="text-base font-semibold text-zinc-100">{scenes[currentSceneIndex]?.title ?? "Escena 1"}</p>
                </div>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
                  {currentSceneIndex + 1} / {scenes.length}
                </span>
              </div>
              {scenes.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentSceneIndex((prev) => Math.max(prev - 1, 0))}
                    className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
                    disabled={currentSceneIndex === 0}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSceneIndex((prev) => Math.min(prev + 1, scenes.length - 1))}
                    className="rounded-2xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-[11px] font-semibold text-white transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
                    disabled={currentSceneIndex === scenes.length - 1}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
            </div>
            {showSceneScript && (
              <div className="mb-4 rounded-3xl border border-red-500/40 bg-red-950/20 p-4 text-sm text-zinc-100">
                <p className="text-xs uppercase tracking-[0.28em] text-red-300 mb-3">Guion de la escena</p>
                <p className="whitespace-pre-line leading-relaxed">{text}</p>
              </div>
            )}
            {!showSceneScript && (
              <p className={`text-lg md:text-xl font-medium leading-relaxed transition-colors duration-300 ${
                isRecording ? "text-zinc-100" : "text-zinc-400"
              }`}>
                {text}
              </p>
            )}
            </div>
          </div>

          <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/40 flex flex-col items-center gap-4">
            <div className="flex flex-wrap justify-center gap-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={!cameraReady}
                  className="py-3 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-2xl transition-all shadow-sm flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  🔴 Iniciar Grabación
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="py-3 px-6 bg-red-600 hover:bg-red-700 border border-red-500 text-white font-bold text-xs rounded-2xl transition-all flex items-center gap-2 animate-pulse"
                >
                  <span className="h-3 w-3 rounded-full bg-white animate-pulse" />
                  Grabando
                </button>
              )}
            </div>
            {cameraError && (
              <p className="text-sm text-red-300 text-center">{cameraError}</p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}