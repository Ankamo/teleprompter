"use client";

import { useState, useRef } from "react";

// Tipos para los estados de la grabación
type RecordingState = "idle" | "recording" | "paused";

export default function TeleprompterPage() {
  const [script, setScript] = useState(
    "¡Hola! Este es tu nuevo teleprompter. Modifica este texto y empieza a grabar tu contenido con total fluidez de manera profesional."
  );
  
  // Estado para controlar el flujo de la app
  const [status, setStatus] = useState<RecordingState>("idle");

  // Referencias para la cámara y la grabación de datos
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 1. INICIAR GRABACIÓN
  const startRecording = async () => {
    try {
      // Solicita permisos de cámara y micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // Asegura cámara frontal en iOS/Android
        audio: true,
      });

      // Muestra el feed en vivo en el elemento <video>
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Limpia fragmentos de grabaciones anteriores
      chunksRef.current = [];

      // Detecta el formato de video soportado (iOS suele preferir video/mp4)
      const options = MediaRecorder.isTypeSupported("video/mp4;codecs=h264")
        ? { mimeType: "video/mp4;codecs=h264" }
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? { mimeType: "video/webm;codecs=vp9" }
        : { mimeType: "video/webm" };

      // Inicializa el MediaRecorder con el flujo de la cámara
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      // Evento que se ejecuta cada vez que hay datos de video disponibles
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Evento que se ejecuta al detener por completo la grabación
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || "video/webm" });
        const url = URL.createObjectURL(blob);
        
        // Descarga automática del archivo grabado
        const a = document.createElement("a");
        a.href = url;
        a.download = `grabacion-teleprompter-${Date.now()}.mp4`;
        a.click();
        
        // Limpieza de memoria
        URL.revokeObjectURL(url);
      };

      // Comienza a grabar en bloques de 1 segundo (1000ms)
      recorder.start(1000);
      setStatus("recording");
    } catch (err) {
      alert("Error al acceder a los dispositivos de grabación. Verifica los permisos.");
      console.error(err);
    }
  };

  // 2. PAUSAR GRABACIÓN
  const pauseRecording = () => {
    if (mediaRecorderRef.current && status === "recording") {
      mediaRecorderRef.current.pause();
      setStatus("paused");
    }
  };

  // 3. REANUDAR GRABACIÓN
  const resumeRecording = () => {
    if (mediaRecorderRef.current && status === "paused") {
      mediaRecorderRef.current.resume();
      setStatus("recording");
    }
  };

  // 4. FINALIZAR Y GUARDAR GRABACIÓN
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Apaga físicamente la cámara y el micrófono (quitar luces de grabación)
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setStatus("idle");
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 overflow-hidden bg-zinc-950 select-none">
      
      {/* CAPA DE LA CÁMARA (Fondo con opacidad baja para leer bien) */}
      <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline // Obligatorio para iOS Safari
          muted       // Evita feedback o eco molesto en altavoces
          className="w-full h-full object-cover opacity-40"
        />
      </div>

      {/* CONTENEDOR DE LA INTERFAZ DE USUARIO */}
      <div className="relative z-10 w-full max-w-2xl h-full flex flex-col justify-between flex-grow">
        
        {/* Cabecera */}
        <header className="text-center py-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/5">
          <h1 className="text-xl font-bold text-emerald-400 tracking-widest">
            TELEPROMPTER GO
          </h1>
        </header>

        {/* ÁREA DEL GUION */}
        <div className="flex-grow my-6 flex items-center justify-center overflow-y-auto px-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 transition-all">
          {status === "idle" ? (
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full h-56 bg-transparent text-white text-lg p-2 focus:outline-none resize-none border border-emerald-500/20 rounded-xl focus:border-emerald-500/50 transition-all text-center"
              placeholder="Escribe tu guion aquí..."
            />
          ) : (
            <div className="w-full text-center text-2xl md:text-4xl font-semibold leading-relaxed max-h-72 overflow-hidden text-emerald-300">
              {/* Aquí controlaremos el movimiento automático en el siguiente paso */}
              <p className={status === "recording" ? "animate-none" : "opacity-60"}>
                {script}
              </p>
            </div>
          )}
        </div>

        {/* PANEL DE CONTROL DINÁMICO */}
        <footer className="flex justify-center gap-4 py-4 px-6 bg-black/60 backdrop-blur-md rounded-xl border border-white/5 w-full">
          {status === "idle" ? (
            // Botón inicial
            <button
              onClick={startRecording}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 font-bold rounded-full transition-all text-black shadow-lg shadow-emerald-500/20 text-base"
            >
              Iniciar Grabación
            </button>
          ) : (
            // Botones activos durante la grabación
            <div className="flex gap-4 w-full justify-center">
              {status === "recording" ? (
                <button
                  onClick={pauseRecording}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 font-bold rounded-full transition-all text-black shadow-md w-1/2 max-w-[200px]"
                >
                  Pausar grabación
                </button>
              ) : (
                <button
                  onClick={resumeRecording}
                  className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 font-bold rounded-full transition-all text-black shadow-md w-1/2 max-w-[200px] animate-pulse"
                >
                  Reanudar
                </button>
              )}

              <button
                onClick={stopRecording}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 active:scale-95 font-bold rounded-full transition-all text-white shadow-md w-1/2 max-w-[200px]"
              >
                Finalizar grabación
              </button>
            </div>
          )}
        </footer>
      </div>
    </main>
  );
}