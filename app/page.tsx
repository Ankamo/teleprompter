"use client";

import { useState, useRef, useEffect } from "react";

// Estructura para las redes sociales soportadas
const SOCIAL_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "🌐" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "x", label: "X (Twitter)", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "threads", label: "Threads", icon: "🧵" },
  { id: "youtube", label: "YouTube", icon: "📺" },
];

export default function TeleprompterEstudioProfesional() {
  const [isRecording, setIsRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Gestión de guion y escenas
  const [scenes, setScenes] = useState([
    { id: 1, title: "ESCENA 1", text: "Este es el texto de tu teleprompter. Configura tus redes e imágenes abajo antes de iniciar." }
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [scriptText, setScriptText] = useState(
    `ESCENA 1\nEste es el texto de tu teleprompter. Configura tus redes e imágenes abajo antes de iniciar.\n\nESCENA 2\n¡Perfecto! Todo lo que agregues en pantalla se mantendrá visible mientras lees tu guion.`
  );

  // Estado de Redes Sociales
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({
    facebook: "",
    instagram: "",
    x: "",
    tiktok: "",
    threads: "",
    youtube: "",
  });
  const [activeSocials, setActiveSocials] = useState<Record<string, boolean>>({});

  // Estado de Imágenes Superpuestas (Logos)
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState("top-right");
  const [imageSize, setImageSize] = useState(80); // tamaño en px

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

  // Manejo de carga de imagen local
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setOverlayImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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
      a.download = `grabacion-estudio-${Date.now()}.webm`;
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

  // Helper para posicionar la imagen del logo en el visor
  const getPositionClass = () => {
    switch (imagePosition) {
      case "top-left": return "top-4 left-4";
      case "top-right": return "top-4 right-4";
      case "bottom-left": return "bottom-4 left-4";
      case "bottom-right": return "bottom-4 right-4";
      default: return "top-4 right-4";
    }
  };

  return (
    <main className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-4xl flex flex-col gap-6">
        
        {/* 1. VISOR DE LA CÁMARA (HORIZONTAL 16:9) */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative">
          <div className="px-5 py-3 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
                {scenes[currentSceneIndex]?.title || "ESTUDIO EN VIVO"}
              </span>
              {scenes.length > 1 && (
                <span className="text-[11px] text-zinc-500 font-mono">
                  ({currentSceneIndex + 1}/{scenes.length})
                </span>
              )}
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
          </div>

          <div className="w-full aspect-video bg-black relative flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            
            {/* CAPA 1: IMAGEN / LOGO SUPERPUESTO (Siempre visible si está cargado) */}
            {overlayImage && (
              <img 
                src={overlayImage} 
                alt="Overlay" 
                className={`absolute ${getPositionClass()} object-contain rounded-lg border border-white/10 shadow-lg`}
                style={{ width: `${imageSize}px`, height: `${imageSize}px` }}
              />
            )}

            {/* CAPA 2: REDES SOCIALES ACTIVAS (Siempre visibles en la esquina inferior izquierda) */}
            <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 bg-black/40 p-2.5 rounded-xl backdrop-blur-sm border border-zinc-800/50 max-w-[240px]">
              {SOCIAL_PLATFORMS.map(p => {
                if (!activeSocials[p.id] || !socialInputs[p.id]) return null;
                return (
                  <div key={p.id} className="flex items-center gap-2 text-white text-xs font-medium drop-shadow-md">
                    <span className="text-sm bg-zinc-900/80 p-1 rounded-md">{p.icon}</span>
                    <span className="truncate">{socialInputs[p.id]}</span>
                  </div>
                );
              })}
              {Object.values(activeSocials).filter(Boolean).length === 0 && (
                <span className="text-[10px] text-zinc-500 font-mono">Sin redes activas</span>
              )}
            </div>

            {/* CAPA 3: EL GUION (Aparece flotando en el centro únicamente al grabar) */}
            {isRecording && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-6 sm:p-10 backdrop-blur-[1px]">
                <div className="max-w-xl text-center select-none">
                  <p className="text-white text-lg sm:text-2xl font-bold leading-relaxed drop-shadow-[0_4px_16px_rgba(0,0,0,1)]">
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

          {/* Controles del visor */}
          <div className="p-3 bg-zinc-950/80 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            {scenes.length > 1 ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentSceneIndex === 0}
                  onClick={() => setCurrentSceneIndex(p => Math.max(p - 1, 0))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-lg disabled:opacity-30 border border-zinc-800 transition"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  disabled={currentSceneIndex === scenes.length - 1}
                  onClick={() => setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-lg disabled:opacity-30 border border-zinc-800 transition"
                >
                  Siguiente →
                </button>
              </div>
            ) : (
              <div className="hidden sm:block w-20" />
            )}

            {!isRecording ? (
              <button 
                onClick={startRecording} 
                disabled={!cameraReady} 
                className="w-full sm:w-auto py-2.5 px-6 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40"
              >
                🔴 Iniciar Grabación
              </button>
            ) : (
              <button 
                onClick={stopRecording} 
                className="w-full sm:w-auto py-2.5 px-6 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all animate-pulse"
              >
                ⏹️ Detener y Guardar
              </button>
            )}

            <div className="hidden sm:block w-20" />
          </div>
        </div>

        {/* 2. BARRA DE TEXTO PARA AGREGAR EL GUION */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col gap-3">
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Editor de Guion</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Escribe el contenido de tu video. Salta una línea para separar las escenas.</p>
          </div>

          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={4}
            placeholder="Pega o escribe tu guion completo aquí..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-700 font-sans leading-relaxed"
          />

          <div className="flex justify-between items-center mt-1">
            <button 
              onClick={generateScenes} 
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-zinc-700 transition"
            >
              ✨ Cargar Guion al Prompter
            </button>
          </div>
        </div>

        {/* 3. PANEL DE CONFIGURACIÓN DE ESCENA (REDES E IMÁGENES) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Configuración de Redes Sociales */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Tus Redes Sociales</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Activa las casillas e introduce tu usuario para mostrarlas en el video.</p>
            </div>

            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
              {SOCIAL_PLATFORMS.map(platform => (
                <div key={platform.id} className="flex items-center gap-3 bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                  <input 
                    type="checkbox"
                    checked={!!activeSocials[platform.id]}
                    onChange={(e) => setActiveSocials(prev => ({ ...prev, [platform.id]: e.target.checked }))}
                    className="rounded border-zinc-700 bg-zinc-900 text-zinc-100 focus:ring-0 w-4 h-4"
                  />
                  <span className="text-xs w-20 flex items-center gap-1">
                    <span>{platform.icon}</span> {platform.label}
                  </span>
                  <input 
                    type="text"
                    placeholder={`@tu_usuario`}
                    value={socialInputs[platform.id]}
                    onChange={(e) => setSocialInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Configuración de Imagen / Logo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Logo o Imagen Superpuesta</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Sube un archivo PNG/JPG para fijarlo como marca de agua en la pantalla.</p>
              </div>

              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />

              {overlayImage && (
                <div className="grid grid-cols-2 gap-3 mt-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Posición</label>
                    <select 
                      value={imagePosition} 
                      onChange={(e) => setImagePosition(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs text-zinc-300 outline-none"
                    >
                      <option value="top-left">Arriba Izquierda</option>
                      <option value="top-right">Arriba Derecha</option>
                      <option value="bottom-left">Abajo Izquierda</option>
                      <option value="bottom-right">Abajo Derecha</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Tamaño ({imageSize}px)</label>
                    <input 
                      type="range" 
                      min="40" 
                      max="160" 
                      value={imageSize} 
                      onChange={(e) => setImageSize(Number(e.target.value))}
                      className="w-full accent-zinc-400 mt-2"
                    />
                  </div>
                </div>
              )}
            </div>

            {overlayImage && (
              <button 
                onClick={() => setOverlayImage(null)} 
                className="text-left text-[11px] text-red-400 hover:underline self-start"
              >
                🗑️ Quitar imagen actual
              </button>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}
