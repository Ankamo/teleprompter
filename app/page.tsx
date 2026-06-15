"use client";

import { useState, useRef, useEffect } from "react";

type RecordingState = "idle" | "recording" | "paused" | "editing" | "rendering";

interface Scene {
  title: string;
  text: string;
}

// Expandimos la interfaz para guardar la posición (X, Y) y dimensiones de cada capa
interface TimelineElement {
  id: string;
  type: "image" | "audio" | "social";
  name: string;
  src: string;
  startTime: number;
  duration: number;
  extraData?: string;
  // Coordenadas en porcentaje (0 a 100) para que sea responsivo sobre el video
  x: number; 
  y: number;
  width: number;
  height: number;
}

export default function TeleprompterPage() {
  const [script, setScript] = useState(
    `(Inicio)\n"¿Por qué votar por Iván Cepeda? Aquí te doy cinco razones claras y directas."\n\n(Pausa breve)\n"Uno: Su defensa de los derechos humanos. Ha dedicado su vida a proteger a las víctimas y a quienes más han sufrido el conflicto en Colombia."\n"Dos: Su compromiso con la paz. No es solo discurso; es trabajo legislativo constante para lograr una paz real y duradera en nuestros territorios."\n"Tres: El control político. Es un congresista que fiscaliza, denuncia la corrupción y vigila que el dinero de todos se use como debe ser."\n"Cuatro: La justicia social. Su agenda está centrada en las comunidades más vulnerables, buscando siempre reducir la brecha de desigualdad en el país."\n"Cinco: Su coherencia. Durante años, ha mantenido una misma línea ética y política, demostrando que es un servidor público en el que se puede confiar."\n\n(Cierre)\n"Por un Congreso con ética, paz y justicia social. Analiza estas razones y toma tu decisión informada."`
  );
  
  const [status, setStatus] = useState<RecordingState>("idle");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // --- ESTADOS DEL EDITOR ---
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0); 
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [timelineElements, setTimelineElements] = useState<TimelineElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Referencia al contenedor del monitor
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  // Estado auxiliar para el arrastre
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const parseScriptIntoScenes = (rawText: string): Scene[] => {
    const markerRegex = /\(([^)]+)\)/g;
    const parsedScenes: Scene[] = [];
    const blocks = rawText.split(markerRegex);
    let currentTitle = "Escena 1";
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;
      if (i % 2 !== 0) {
        currentTitle = block.toUpperCase();
      } else {
        parsedScenes.push({
          title: currentTitle,
          text: block.replace(/^["']|["']$/g, "")
        });
      }
    }
    return parsedScenes.length > 0 ? parsedScenes : [{ title: "GUION", text: rawText }];
  };

  // CONTROL DE GRABACIÓN
  const startRecording = async () => {
    const detectedScenes = parseScriptIntoScenes(script);
    setScenes(detectedScenes);
    setCurrentSceneIndex(0);
    setRecordedVideoUrl(null);
    setTimelineElements([]);
    setVideoDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });

      if (videoRef.current) videoRef.current.srcObject = stream;
      chunksRef.current = [];

      const options = MediaRecorder.isTypeSupported("video/mp4;codecs=h264")
        ? { mimeType: "video/mp4;codecs=h264" }
        : { mimeType: "video/webm;codecs=vp9" };

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: options.mimeType || "video/webm" });
        setRecordedVideoUrl(URL.createObjectURL(blob));
        setStatus("editing");
      };

      recorder.start(1000);
      setStatus("recording");
    } catch (err) {
      alert("Error al acceder a la cámara.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  // MOTOR DE RENDERIZADO (CANVAS)
  useEffect(() => {
    if (status !== "editing" || !canvasRef.current || !previewVideoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const video = previewVideoRef.current;
    let animationFrameId: number;

    const loadedImages: { [key: string]: HTMLImageElement } = {};
    timelineElements.forEach(el => {
      if ((el.type === "image" || el.type === "social") && !loadedImages[el.id]) {
        const img = new Image();
        img.src = el.src;
        loadedImages[el.id] = img;
      }
    });

    const renderLoop = () => {
      if (ctx && video) {
        setCurrentTime(video.currentTime);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        timelineElements.forEach(el => {
          const isActive = video.currentTime >= el.startTime && video.currentTime <= (el.startTime + el.duration);
          
          if (isActive) {
            // Convertir porcentajes dinámicos a píxeles reales del lienzo
            const renderX = (el.x / 100) * canvas.width;
            const renderY = (el.y / 100) * canvas.height;
            const renderW = (el.width / 100) * canvas.width;
            const renderH = (el.height / 100) * canvas.height;

            if (el.type === "image" && loadedImages[el.id]) {
              ctx.drawImage(loadedImages[el.id], renderX, renderY, renderW, renderH);
            }
            
            if (el.type === "social" && loadedImages[el.id]) {
              // Fondo del banner de red social adaptado a su contenedor móvil
              ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
              ctx.beginPath();
              ctx.roundRect(renderX, renderY, renderW, renderH, 6);
              ctx.fill();

              // Icono de la red social
              const iconSize = renderH * 0.65;
              ctx.drawImage(loadedImages[el.id], renderX + (renderH * 0.2), renderY + (renderH * 0.17), iconSize, iconSize);
              
              // Nombre de usuario
              ctx.fillStyle = "#ffffff";
              ctx.font = `bold ${Math.floor(renderH * 0.4)}px sans-serif`;
              ctx.fillText(el.extraData || "@usuario", renderX + iconSize + (renderH * 0.4), renderY + (renderH * 0.63));
            }

            if (el.type === "audio") {
              const aud = audioElementsRef.current[el.id];
              if (aud && !video.paused && !video.ended && aud.paused) {
                aud.currentTime = video.currentTime - el.startTime;
                aud.play().catch(() => {});
              }
            }
          } else {
            if (el.type === "audio") {
              const aud = audioElementsRef.current[el.id];
              if (aud && !aud.paused) aud.pause();
            }
          }
        });
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    const handlePlay = () => { renderLoop(); };
    const handlePause = () => {
      cancelAnimationFrame(animationFrameId);
      Object.values(audioElementsRef.current).forEach(aud => aud.pause());
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    
    const updateDuration = () => {
      if (video.duration && isFinite(video.duration)) {
        setVideoDuration(video.duration);
      }
    };

    video.addEventListener("loadedmetadata", updateDuration);
    video.addEventListener("durationchange", updateDuration);

    return () => {
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("loadedmetadata", updateDuration);
      video.removeEventListener("durationchange", updateDuration);
    };
  }, [status, timelineElements]);

  const playPreview = () => previewVideoRef.current?.play();
  const pausePreview = () => previewVideoRef.current?.pause();

  // MANEJADORES DE MOVIMIENTO EN PANTALLA (DRAG & DROP)
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    setSelectedElementId(id);
    isDraggingRef.current = true;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !selectedElementId || !containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const targetElement = timelineElements.find(el => el.id === selectedElementId);
    if (!targetElement) return;

    // Calcular desplazamiento delta en píxeles y transformarlo a porcentaje
    const deltaX = ((e.clientX - dragStartPos.current.x) / container.width) * 100;
    const deltaY = ((e.clientY - dragStartPos.current.y) / container.height) * 100;

    // Nuevas posiciones restringidas entre 0 y 100
    const newX = Math.max(0, Math.min(100 - targetElement.width, targetElement.x + deltaX));
    const newY = Math.max(0, Math.min(100 - targetElement.height, targetElement.y + deltaY));

    setTimelineElements(prev => prev.map(item => 
      item.id === selectedElementId ? { ...item, x: newX, y: newY } : item
    ));

    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // ACCIONES DE AGREGAR ELEMENTOS
  const addImageLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newEl: TimelineElement = {
          id: `img-${Date.now()}`,
          type: "image",
          name: file.name,
          src: reader.result as string,
          startTime: Math.floor(currentTime),
          duration: 4,
          x: 10,   // Posición inicial centrada por defecto
          y: 10,
          width: 25, // Tamaño relativo al video (25%)
          height: 25
        };
        setTimelineElements([...timelineElements, newEl]);
        setSelectedElementId(newEl.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const addAudioLayer = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const id = `aud-${Date.now()}`;
      
      const audio = new Audio(url);
      audio.volume = 0.3;
      audioElementsRef.current[id] = audio;

      const newEl: TimelineElement = {
        id: id,
        type: "audio",
        name: file.name,
        src: url,
        startTime: Math.floor(currentTime),
        duration: 5,
        x: 0, y: 0, width: 0, height: 0 // Audio no ocupa espacio visual
      };
      setTimelineElements([...timelineElements, newEl]);
    }
  };

  const addSocialLayer = (platform: "facebook" | "instagram" | "tiktok") => {
    const username = prompt("Ingresa tu nombre de usuario:");
    if (!username) return;

    const placeholderIcons = {
      facebook: "https://cdn-icons-png.flaticon.com/128/733/733547.png",
      instagram: "https://cdn-icons-png.flaticon.com/128/2111/2111463.png",
      tiktok: "https://cdn-icons-png.flaticon.com/128/3046/3046121.png"
    };

    const newEl: TimelineElement = {
      id: `soc-${Date.now()}`,
      type: "social",
      name: `Banner ${platform}`,
      src: placeholderIcons[platform],
      startTime: Math.floor(currentTime),
      duration: 4,
      extraData: username,
      x: 15,
      y: 75,      // Inicialmente abajo para simular el tercio inferior
      width: 45,  // Proporción alargada para banners de texto
      height: 10
    };
    setTimelineElements([...timelineElements, newEl]);
    setSelectedElementId(newEl.id);
  };

  const trimVideo = () => {
    if (!previewVideoRef.current) return;
    const cutPoint = previewVideoRef.current.currentTime;
    if (confirm(`¿Deseas cortar el video a partir del segundo ${cutPoint.toFixed(1)}s?`)) {
      setVideoDuration(cutPoint);
    }
  };

  const removeTimelineElement = (id: string) => {
    setTimelineElements(timelineElements.filter(el => el.id !== id));
    if (audioElementsRef.current[id]) {
      audioElementsRef.current[id].pause();
      delete audioElementsRef.current[id];
    }
    setSelectedElementId(null);
  };

  const exportFinalComposite = () => {
    setStatus("rendering");
    if (!canvasRef.current || !previewVideoRef.current) return;

    const canvas = canvasRef.current;
    const video = previewVideoRef.current;
    const canvasStream = canvas.captureStream(30);
    
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioCtx.createMediaStreamDestination();

    try {
      const videoSrc = audioCtx.createMediaElementSource(video);
      videoSrc.connect(dest);
    } catch(e) {}

    timelineElements.forEach(el => {
      if (el.type === "audio" && audioElementsRef.current[el.id]) {
        try {
          const audSrc = audioCtx.createMediaElementSource(audioElementsRef.current[el.id]);
          audSrc.connect(dest);
        } catch(e) {}
      }
    });

    const combinedTracks = [...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()];
    const compositeStream = new MediaStream(combinedTracks);
    const recorder = new MediaRecorder(compositeStream, { mimeType: "video/webm" });
    const localChunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) localChunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(localChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `video-produccion-${Date.now()}.mp4`;
      a.click();
      setStatus("idle");
      setRecordedVideoUrl(null);
    };

    recorder.start();
    video.currentTime = 0;
    video.play();
    
    const checkEnd = setInterval(() => {
      if (video.currentTime >= videoDuration || video.ended) {
        clearInterval(checkEnd);
        recorder.stop();
        audioCtx.close();
      }
    }, 100);
  };

  const safeTicksLength = isNaN(videoDuration) || !isFinite(videoDuration) || videoDuration <= 0 
    ? 1 
    : Math.ceil(videoDuration);

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 bg-zinc-950 text-white select-none">
      
      {/* VISTA 1: TELEPROMPTER */}
      {status !== "editing" && status !== "rendering" && (
        <>
          <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-35" />
          </div>
          <div className="relative z-10 w-full max-w-2xl h-full flex flex-col justify-between flex-grow">
            <header className="text-center py-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/5">
              <h1 className="text-xl font-bold text-emerald-400 tracking-widest">TELEPROMPTER GO</h1>
            </header>
            <div className="flex-grow my-6 flex flex-col items-center justify-center px-6 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10">
              {status === "idle" ? (
                <textarea value={script} onChange={(e) => setScript(e.target.value)} className="w-full h-72 bg-transparent text-white text-base p-2 focus:outline-none resize-none border border-emerald-500/10 rounded-xl" />
              ) : (
                <div className="w-full text-center py-4">
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded mb-4 inline-block">{scenes[currentSceneIndex]?.title}</span>
                  <div className="w-full text-xl md:text-3xl font-medium leading-relaxed">{scenes[currentSceneIndex]?.text}</div>
                  <div className="flex gap-8 mt-6 justify-center">
                    <button onClick={() => setCurrentSceneIndex(p => Math.max(0, p - 1))} disabled={currentSceneIndex === 0} className="text-sm disabled:opacity-30">◀ Anterior</button>
                    <button onClick={() => setCurrentSceneIndex(p => Math.min(scenes.length - 1, p + 1))} disabled={currentSceneIndex === scenes.length - 1} className="text-sm text-emerald-400 font-bold disabled:opacity-30">Siguiente ▶</button>
                  </div>
                </div>
              )}
            </div>
            <footer className="flex justify-center py-4 px-6 bg-black/60 backdrop-blur-md rounded-xl w-full">
              {status === "idle" ? (
                <button onClick={startRecording} className="px-8 py-3 bg-emerald-500 font-bold rounded-full text-black">Iniciar Grabación</button>
              ) : (
                <button onClick={stopRecording} className="px-6 py-3 bg-red-500 font-bold rounded-full text-white w-full max-w-[240px]">Finalizar grabación</button>
              )}
            </footer>
          </div>
        </>
      )}

      {/* VISTA 2: ESTUDIO DE EDICIÓN AVANZADO */}
      {(status === "editing" || status === "rendering") && recordedVideoUrl && (
        <div className="z-20 w-full max-w-5xl flex flex-col gap-4 py-2">
          
          <div className="flex flex-col md:flex-row gap-4 w-full">
            {/* Monitor con Soporte Drag-and-Drop */}
            <div className="w-full md:w-1/2 bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <span className="text-xs font-bold text-emerald-400 mb-2 uppercase">Monitor Principal</span>
              
              {/* Contenedor relativo para capturar eventos del mouse de manera precisa */}
              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800"
              >
                <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-contain" />
                <video ref={previewVideoRef} src={recordedVideoUrl} className="hidden" crossOrigin="anonymous" />

                {/* Capas interactivas invisibles superpuestas para arrastrar con precisión */}
                {timelineElements.map(el => {
                  const isActive = currentTime >= el.startTime && currentTime <= (el.startTime + el.duration);
                  if (!isActive || el.type === "audio") return null;

                  return (
                    <div
                      key={el.id}
                      onMouseDown={(e) => handleMouseDown(e, el.id)}
                      className={`absolute cursor-move border group ${
                        selectedElementId === el.id 
                          ? "border-emerald-400 bg-emerald-500/10" 
                          : "border-dashed border-white/40 hover:border-white"
                      }`}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                      }}
                    >
                      {/* Marcador táctil visual para identificar el elemento seleccionado */}
                      <span className="absolute -top-4 left-0 bg-zinc-900 text-[9px] px-1 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {el.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-3">
                <button onClick={playPreview} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md">▶ Play</button>
                <button onClick={pausePreview} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md">⏸ Pause</button>
                <button onClick={trimVideo} className="px-4 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs rounded-md border border-red-500/30">✂ Cortar aquí</button>
              </div>
            </div>

            {/* Inyección de Elementos */}
            <div className="w-full md:w-1/2 bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 block mb-3 uppercase border-b border-zinc-800 pb-1">Herramientas de Inserción</span>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🖼️ Añadir Imagen Apoyo (.png / .jpg)</label>
                    <input type="file" accept="image/*" onChange={addImageLayer} className="w-full text-xs cursor-pointer file:py-1 file:px-3 file:rounded file:border-0 file:bg-emerald-500/10 file:text-emerald-400 text-zinc-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🎵 Añadir Efecto o Música (.mp3)</label>
                    <input type="file" accept="audio/*" onChange={addAudioLayer} className="w-full text-xs cursor-pointer file:py-1 file:px-3 file:rounded file:border-0 file:bg-emerald-500/10 file:text-emerald-400 text-zinc-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🚀 Insertar Botón de Redes Sociales</label>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => addSocialLayer("instagram")} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-white/5">📸 Instagram</button>
                      <button onClick={() => addSocialLayer("tiktok")} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-white/5">🎵 TikTok</button>
                      <button onClick={() => addSocialLayer("facebook")} className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-xs rounded border border-white/5">📘 Facebook</button>
                    </div>
                  </div>
                </div>
              </div>

              {selectedElementId && (
                <div className="mt-4 p-2 bg-black/40 rounded border border-white/5">
                  {timelineElements.filter(el => el.id === selectedElementId).map(el => (
                    <div key={el.id} className="flex flex-col gap-2 text-xs">
                      <span className="text-emerald-400 font-semibold truncate">Configurando: {el.name}</span>
                      
                      {/* Control de Escala (Tamaño) */}
                      {el.type !== "audio" && (
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Tamaño del elemento:</label>
                          <input 
                            type="range" 
                            min="5" 
                            max="80" 
                            value={el.width} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setTimelineElements(timelineElements.map(item => 
                                item.id === el.id ? { ...item, width: val, height: el.type === "social" ? val * 0.22 : val } : item
                              ));
                            }} 
                            className="w-full accent-emerald-400" 
                          />
                        </div>
                      )}

                      <div className="flex justify-between mt-1 text-[11px] text-zinc-400">
                        <span>Aparición: {el.startTime}s</span>
                        <span>Duración: {el.duration}s</span>
                      </div>
                      <input type="range" min="0" max={videoDuration || 10} step="1" value={el.startTime} onChange={(e) => {
                        setTimelineElements(timelineElements.map(item => item.id === el.id ? { ...item, startTime: parseInt(e.target.value) } : item));
                      }} className="w-full accent-emerald-400" />
                      <button onClick={() => removeTimelineElement(el.id)} className="mt-1 text-left text-red-400 text-[10px] hover:underline">🗑️ Eliminar de la pista</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Línea de Tiempo */}
          <div className="w-full bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
              <span>⏱️ Línea de Tiempo</span>
              <span className="font-mono text-emerald-400">{currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
            </div>

            <div className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2 min-h-[120px] relative overflow-x-auto space-y-2">
              <div className="w-full h-4 relative border-b border-zinc-800/50 text-[9px] text-zinc-600 font-mono min-w-[500px]">
                {Array.from({ length: safeTicksLength }).map((_, idx) => {
                  const leftPos = videoDuration > 0 ? (idx / videoDuration) * 100 : 0;
                  return (
                    <span key={idx} className="absolute" style={{ left: `${leftPos}%` }}>| {idx}s</span>
                  );
                })}
              </div>

              {timelineElements.length === 0 ? (
                <div className="text-center text-xs text-zinc-600 py-6">No has agregado capas aún. Usa el panel superior.</div>
              ) : (
                timelineElements.map(el => {
                  const leftPercentage = videoDuration > 0 ? (el.startTime / videoDuration) * 100 : 0;
                  const widthPercentage = videoDuration > 0 ? (el.duration / videoDuration) * 100 : 10;
                  
                  return (
                    <div key={el.id} className="w-full h-6 relative bg-zinc-900/30 rounded flex items-center min-w-[500px]">
                      <span className="text-[10px] text-zinc-500 pl-2 uppercase font-bold absolute z-10 pointer-events-none">{el.type}</span>
                      <button
                        onClick={() => setSelectedElementId(el.id)}
                        className={`absolute h-full rounded text-left px-2 text-[10px] font-medium truncate border transition-all flex items-center ${
                          selectedElementId === el.id 
                            ? "bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md" 
                            : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        }`}
                        style={{ left: `${leftPercentage}%`, width: `${widthPercentage}%` }}
                      >
                        {el.name}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-zinc-800/60">
              <button onClick={() => { setStatus("idle"); setRecordedVideoUrl(null); }} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg hover:bg-zinc-700">Descartar todo</button>
              {status === "rendering" ? (
                <button disabled className="px-6 py-2 bg-zinc-800 text-xs text-amber-400 rounded-lg animate-pulse font-medium">Renderizando pistas...</button>
              ) : (
                <button onClick={exportFinalComposite} className="px-6 py-2 bg-emerald-500 text-black font-bold text-xs rounded-lg hover:bg-emerald-600">
                  Exportar Video Final
                </button>
              )}
            </div>
          </div>

        </div>
      )}

    </main>
  );
}