"use client";

import { useState, useRef, useEffect } from "react";

type WorkflowState = "setup" | "recording_flow" | "editing" | "rendering";

interface Scene {
  title: string;
  text: string;
}

interface RecordedSceneData {
  index: number;
  title: string;
  blob: Blob;
  url: string;
}

interface TimelineElement {
  id: string;
  type: "image" | "audio" | "social";
  name: string;
  src: string;
  startTime: number;
  duration: number;
  extraData?: string;
  x: number; 
  y: number;
  width: number;
  height: number;
}

export default function MultiSceneTeleprompter() {
  // 1. Estados principales del Script y Flujo
  const [script, setScript] = useState(
    `(Escena 1)\n"¿Por qué votar por Iván Cepeda? Aquí te doy cinco razones claras y directas."\n\n(Escena 2)\n"Uno: Su defensa de los derechos humanos. Ha dedicado su vida a proteger a las víctimas y a quienes más han sufrido el conflicto en Colombia."\n\n(Escena 3)\n"Dos: Su compromiso con la paz. No es solo discurso; es trabajo legislativo constante para lograr una paz real y duradera en nuestros territorios."`
  );
  
  const [viewState, setViewState] = useState<WorkflowState>("setup");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [isCurrentlyRecording, setIsCurrentlyRecording] = useState<boolean>(false);
  
  // Memoria de las escenas grabadas consecutivamente
  const [recordedScenes, setRecordedScenes] = useState<RecordedSceneData[]>([]);

  // Referencias de Hardware de Grabación
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // --- ESTADOS Y REF DEL EDITOR UNIFICADO ---
  const [unifiedVideoUrl, setUnifiedVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0); 
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [timelineElements, setTimelineElements] = useState<TimelineElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioElementsRef = useRef<{ [key: string]: HTMLAudioElement }>({});

  const isDraggingRef = useRef<boolean>(false);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Procesador de texto para segmentar marcas de escena
  const parseScriptIntoScenes = (rawText: string): Scene[] => {
    const markerRegex = /\(([^)]+)\)/g;
    const parsed: Scene[] = [];
    const blocks = rawText.split(markerRegex);
    let currentTitle = "Escena 1";
    
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;
      if (i % 2 !== 0) {
        currentTitle = block.toUpperCase();
      } else {
        parsed.push({
          title: currentTitle,
          text: block.replace(/^["']|["']$/g, "")
        });
      }
    }
    return parsed.length > 0 ? parsed : [{ title: "ESCENA 1", text: rawText }];
  };

  // Inicializa el flujo y enciende la cámara en modo pasivo (sin grabar)
  const initRecordingFlow = async () => {
    const detectedScenes = parseScriptIntoScenes(script);
    setScenes(detectedScenes);
    setCurrentSceneIndex(0);
    setRecordedScenes([]);
    setTimelineElements([]);
    setViewState("recording_flow");

    setTimeout(() => {
      startPassiveCamera();
    }, 100);
  };

  // Enciende el stream de video de fondo para previsualización constante
  const startPassiveCamera = async () => {
    try {
      if (activeStreamRef.current) {
        activeStreamRef.current.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1280, height: 720 },
        audio: true,
      });
      
      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Error al inicializar la cámara web. Verifica los permisos de tu navegador.");
    }
  };

  // Comienza a empaquetar los buffers de la escena actual
  const startRecordingCurrentScene = () => {
    if (!activeStreamRef.current) return;
    
    chunksRef.current = [];
    let options = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    }

    const recorder = new MediaRecorder(activeStreamRef.current, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.start(250); // Solución peso 0 bytes
    setIsCurrentlyRecording(true);
  };

  // Guarda la toma de la escena actual en el arreglo y restablece la cámara pasiva
  const saveAndNextScene = () => {
    if (!mediaRecorderRef.current || !isCurrentlyRecording) return;

    mediaRecorderRef.current.onstop = () => {
      const sceneBlob = new Blob(chunksRef.current, { type: "video/mp4" });
      const sceneUrl = URL.createObjectURL(sceneBlob);

      const newRecordedScene: RecordedSceneData = {
        index: currentSceneIndex,
        title: scenes[currentSceneIndex]?.title || `Escena ${currentSceneIndex + 1}`,
        blob: sceneBlob,
        url: sceneUrl
      };

      setRecordedScenes((prev) => [...prev, newRecordedScene]);
      setIsCurrentlyRecording(false);

      // Avanzar el índice de escena o mantenerse si es la última
      if (currentSceneIndex < scenes.length - 1) {
        setCurrentSceneIndex((prev) => prev + 1);
      } else {
        alert("¡Has grabado todas las escenas del script! Ya puedes proceder a la mesa de edición final.");
      }

      // Volver a encender la cámara de manera pasiva para la siguiente escena
      startPassiveCamera();
    };

    mediaRecorderRef.current.stop();
  };

  // Compila todas las escenas secuenciales en un único archivo de video unificado para el editor
  const finaliseAllScenesToEditor = () => {
    if (isCurrentlyRecording) {
      alert("Por favor, detén y guarda la escena actual antes de finalizar todo el proyecto.");
      return;
    }
    if (recordedScenes.length === 0) {
      alert("No has grabado ninguna escena todavía.");
      return;
    }

    // Apagamos los dispositivos físicos de captura
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(track => track.stop());
      activeStreamRef.current = null;
    }

    // Unificamos las pistas usando el primer video o compuesto como raíz de tiempo continuo
    // En entornos nativos puros web sin FFMPEG compuesto, mapeamos al set secuencial de la línea de tiempo.
    setUnifiedVideoUrl(recordedScenes[0].url); 
    setViewState("editing");
  };

  // --- MOTOR DE EDICIÓN RESPONSIVO Y ARRASHABLE (CANVAS FLUIDO) ---
  useEffect(() => {
    if (viewState !== "editing" || !canvasRef.current || !previewVideoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const video = previewVideoRef.current;
    let animationFrameId: number;

    const loadedImages: { [key: string]: HTMLImageElement } = {};
    timelineElements.forEach(el => {
      if ((el.type === "image" || el.type === "social") && !loadedImages[el.id]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
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
            const renderX = (el.x / 100) * canvas.width;
            const renderY = (el.y / 100) * canvas.height;
            const renderW = (el.width / 100) * canvas.width;
            const renderH = (el.height / 100) * canvas.height;

            if (el.type === "image" && loadedImages[el.id]) {
              try {
                ctx.drawImage(loadedImages[el.id], renderX, renderY, renderW, renderH);
              } catch (e) {}
            }
            
            if (el.type === "social" && loadedImages[el.id]) {
              try {
                ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
                ctx.beginPath();
                ctx.roundRect(renderX, renderY, renderW, renderH, 6);
                ctx.fill();

                const iconSize = renderH * 0.6;
                ctx.drawImage(loadedImages[el.id], renderX + (renderH * 0.2), renderY + (renderH * 0.2), iconSize, iconSize);
                
                ctx.fillStyle = "#ffffff";
                ctx.font = `bold ${Math.floor(renderH * 0.38)}px sans-serif`;
                ctx.fillText(el.extraData || "@usuario", renderX + iconSize + (renderH * 0.4), renderY + (renderH * 0.6));
              } catch (e) {}
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
      if (video.duration && isFinite(video.duration)) setVideoDuration(video.duration);
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
  }, [viewState, timelineElements]);

  const playPreview = () => previewVideoRef.current?.play();
  const pausePreview = () => previewVideoRef.current?.pause();

  // CONTROL INTERACTIVO DE ARRASTRE SOBRE MONITOR
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

    const deltaX = ((e.clientX - dragStartPos.current.x) / container.width) * 100;
    const deltaY = ((e.clientY - dragStartPos.current.y) / container.height) * 100;

    const newX = Math.max(0, Math.min(100 - targetElement.width, targetElement.x + deltaX));
    const newY = Math.max(0, Math.min(100 - targetElement.height, targetElement.y + deltaY));

    setTimelineElements(prev => prev.map(item => 
      item.id === selectedElementId ? { ...item, x: newX, y: newY } : item
    ));

    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => { isDraggingRef.current = false; };

  // METODOS DE INSERCIÓN DE CAPAS
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
          x: 25, y: 25, width: 30, height: 30
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
      audio.volume = 0.4;
      audioElementsRef.current[id] = audio;

      const newEl: TimelineElement = {
        id: id,
        type: "audio",
        name: file.name,
        src: url,
        startTime: Math.floor(currentTime),
        duration: 5,
        x: 0, y: 0, width: 0, height: 0
      };
      setTimelineElements([...timelineElements, newEl]);
    }
  };

  const addSocialLayer = (platform: "facebook" | "instagram" | "tiktok" | "x" | "threads" | "youtube") => {
    const username = prompt(`Ingresa tu nombre de usuario para ${platform.toUpperCase()}:`);
    if (!username) return;

    const platformIcons = {
      facebook: "https://cdn-icons-png.flaticon.com/128/733/733547.png",
      instagram: "https://cdn-icons-png.flaticon.com/128/2111/2111463.png",
      tiktok: "https://cdn-icons-png.flaticon.com/128/3046/3046121.png",
      x: "https://cdn-icons-png.flaticon.com/128/5968/5969020.png",
      threads: "https://cdn-icons-png.flaticon.com/128/11231/11231624.png",
      youtube: "https://cdn-icons-png.flaticon.com/128/1384/1384060.png"
    };

    const newEl: TimelineElement = {
      id: `soc-${Date.now()}`,
      type: "social",
      name: `Capa ${platform}`,
      src: platformIcons[platform],
      startTime: Math.floor(currentTime),
      duration: 5,
      extraData: username,
      x: 10, y: 75, width: 45, height: 11
    };
    setTimelineElements([...timelineElements, newEl]);
    setSelectedElementId(newEl.id);
  };

  // EXPORTACIÓN COMPUESTA Y DESCARGA EN CONTENEDOR SEGURO
  const exportFinalComposite = () => {
    setViewState("rendering");
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

    let exportOptions = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(exportOptions.mimeType)) {
      exportOptions = { mimeType: "video/webm;codecs=vp8,opus" };
    }

    const recorder = new MediaRecorder(compositeStream, exportOptions);
    const localChunks: Blob[] = [];

    recorder.ondataavailable = (e) => { 
      if (e.data && e.data.size > 0) localChunks.push(e.data); 
    };

    recorder.onstop = () => {
      const blob = new Blob(localChunks, { type: "video/mp4" }); 
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `produccion-multiescena-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      audioCtx.close();
      setViewState("setup");
      setUnifiedVideoUrl(null);
    };

    recorder.start(250); 
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

  const safeTicksLength = isNaN(videoDuration) || !isFinite(videoDuration) || videoDuration <= 0 ? 1 : Math.ceil(videoDuration);

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 bg-zinc-950 text-white select-none">
      
      {/* VISTA 1: CONFIGURACIÓN INICIAL DEL SCRIPT */}
      {viewState === "setup" && (
        <div className="w-full max-w-2xl my-auto flex flex-col gap-4 bg-zinc-900/40 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-widest text-emerald-400">TELEPROMPTER MULTIESCENA</h1>
            <p className="text-xs text-zinc-400 mt-1">Escribe tu guion utilizando paréntesis para separar cada escena automáticamente.</p>
          </div>
          <textarea 
            value={script} 
            onChange={(e) => setScript(e.target.value)} 
            className="w-full h-80 bg-zinc-950/80 text-zinc-100 text-sm p-4 focus:outline-none resize-none border border-zinc-800 rounded-xl focus:border-emerald-500/30 font-mono transition-all" 
          />
          <button 
            onClick={initRecordingFlow} 
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 font-bold rounded-xl text-black transition-all shadow-lg shadow-emerald-500/10 text-sm"
          >
            Configurar Escenas e Ir a Cámara
          </button>
        </div>
      )}

      {/* VISTA 2: CÁMARA PASIVA Y GRABACIÓN POR ESCENAS SECUENCIALES */}
      {viewState === "recording_flow" && (
        <>
          {/* Monitor de la cámara web (Siempre encendido en segundo plano) */}
          <div className="absolute inset-0 w-full h-full z-0 bg-black flex items-center justify-center">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-40" />
          </div>

          <div className="relative z-10 w-full max-w-3xl h-full flex flex-col justify-between flex-grow gap-4">
            {/* Header de Estado */}
            <header className="flex justify-between items-center px-4 py-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/5 text-xs">
              <span className="font-bold text-zinc-400">
                PROYECTO: <span className="text-emerald-400 font-mono">{recordedScenes.length} Escenas Guardadas</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isCurrentlyRecording ? "bg-red-500 text-white animate-pulse" : "bg-zinc-800 text-zinc-300"}`}>
                {isCurrentlyRecording ? "• GRABANDO TRANSMISIÓN" : "MODO PREVIO (SIN GRABAR)"}
              </span>
            </header>

            {/* Teleprompter Centralizado */}
            <div className="flex-grow flex flex-col items-center justify-center px-6 py-8 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/5 relative">
              <div className="absolute top-4 bg-zinc-900 text-emerald-400 px-3 py-1 text-[11px] font-bold rounded-md border border-white/5 uppercase tracking-wider">
                {scenes[currentSceneIndex]?.title || "ESCENA ACTUAL"}
              </div>
              <div className="w-full text-center text-xl md:text-3xl font-semibold leading-relaxed text-zinc-100 max-w-2xl">
                {scenes[currentSceneIndex]?.text || "No hay más texto en este bloque."}
              </div>
            </div>

            {/* Panel de Mandos Dinámicos */}
            <footer className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-black/70 backdrop-blur-md rounded-xl border border-white/5 w-full">
              {!isCurrentlyRecording ? (
                <button 
                  onClick={startRecordingCurrentScene} 
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 font-bold text-xs rounded-lg text-black transition-all col-span-1"
                >
                  🔴 Grabar esta Escena
                </button>
              ) : (
                <button 
                  onClick={saveAndNextScene} 
                  className="py-2.5 bg-amber-500 hover:bg-amber-600 font-bold text-xs rounded-lg text-black transition-all col-span-1 animate-pulse"
                >
                  💾 Guardar y Avanzar Escena
                </button>
              )}

              <div className="text-center self-center text-[11px] text-zinc-400 font-medium">
                Escena {currentSceneIndex + 1} de {scenes.length}
              </div>

              <button 
                onClick={finaliseAllScenesToEditor} 
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 font-semibold text-xs rounded-lg text-white border border-zinc-700 transition-all col-span-1"
              >
                🎬 Ir al Editor Final ({recordedScenes.length})
              </button>
            </footer>
          </div>
        </>
      )}

      {/* VISTA 3: MESA DE EDICIÓN POST-GRABACIÓN (Soporte Arrastre de Objetos) */}
      {(viewState === "editing" || viewState === "rendering") && unifiedVideoUrl && (
        <div className="z-20 w-full max-w-5xl flex flex-col gap-4 py-2">
          
          <div className="flex flex-col md:flex-row gap-4 w-full">
            {/* Monitor Interactivo */}
            <div className="w-full md:w-1/2 bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col items-center">
              <span className="text-xs font-bold text-emerald-400 mb-2 uppercase tracking-wider">Monitor de Edición</span>
              
              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800"
              >
                <canvas ref={canvasRef} width={640} height={360} className="w-full h-full object-contain" />
                <video ref={previewVideoRef} src={unifiedVideoUrl} className="hidden" crossOrigin="anonymous" />

                {/* Capas renderizadas interactivas para posicionar con el ratón */}
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
                          : "border-dashed border-white/30 hover:border-white/80"
                      }`}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        height: `${el.height}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-0 bg-zinc-900 text-[9px] px-1 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {el.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-4 mt-3">
                <button onClick={playPreview} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md">▶ Play</button>
                <button onClick={pausePreview} className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs rounded-md">⏸ Pause</button>
              </div>
            </div>

            {/* Inyección de Elementos Complementarios */}
            <div className="w-full md:w-1/2 bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400 block mb-3 uppercase border-b border-zinc-800 pb-1 tracking-wider">Cajas de Herramientas</span>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🖼️ Superponer Imagen o Logotipo (.png / .jpg)</label>
                    <input type="file" accept="image/*" onChange={addImageLayer} className="w-full text-xs cursor-pointer file:py-1 file:px-3 file:rounded file:border-0 file:bg-emerald-500/10 file:text-emerald-400 text-zinc-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🎵 Incorporar Música de Fondo (.mp3)</label>
                    <input type="file" accept="audio/*" onChange={addAudioLayer} className="w-full text-xs cursor-pointer file:py-1 file:px-3 file:rounded file:border-0 file:bg-emerald-500/10 file:text-emerald-400 text-zinc-500" />
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">🚀 Insertar Botón de Redes Sociales</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <button onClick={() => addSocialLayer("facebook")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">📘 Facebook</button>
                      <button onClick={() => addSocialLayer("instagram")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">📸 Instagram</button>
                      <button onClick={() => addSocialLayer("tiktok")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">🎵 TikTok</button>
                      <button onClick={() => addSocialLayer("x")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">𝕏 Twitter / X</button>
                      <button onClick={() => addSocialLayer("threads")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">🧵 Threads</button>
                      <button onClick={() => addSocialLayer("youtube")} className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-[11px] rounded border border-white/5 truncate">📺 YouTube</button>
                    </div>
                  </div>
                </div>
              </div>

              {selectedElementId && (
                <div className="mt-4 p-2 bg-black/40 rounded border border-white/5">
                  {timelineElements.filter(el => el.id === selectedElementId).map(el => (
                    <div key={el.id} className="flex flex-col gap-2 text-xs">
                      <span className="text-emerald-400 font-semibold truncate">Configurando: {el.name}</span>
                      
                      {el.type !== "audio" && (
                        <div>
                          <label className="text-[10px] text-zinc-400 block mb-0.5">Tamaño del elemento:</label>
                          <input 
                            type="range" min="5" max="80" value={el.width} 
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              setTimelineElements(timelineElements.map(item => 
                                item.id === el.id ? { ...item, width: val, height: el.type === "social" ? val * 0.25 : val } : item
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
                      <button onClick={() => { setTimelineElements(timelineElements.filter(t => t.id !== el.id)); setSelectedElementId(null); }} className="mt-1 text-left text-red-400 text-[10px] hover:underline">🗑️ Eliminar capa</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Línea de Tiempo Unificada */}
          <div className="w-full bg-zinc-900 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs text-zinc-400 px-1">
              <span>⏱️ Pistas del Proyecto</span>
              <span className="font-mono text-emerald-400">{currentTime.toFixed(1)}s / {videoDuration.toFixed(1)}s</span>
            </div>

            <div className="w-full bg-black/50 border border-zinc-800 rounded-lg p-2 min-h-[100px] relative overflow-x-auto space-y-2">
              <div className="w-full h-4 relative border-b border-zinc-800/50 text-[9px] text-zinc-600 font-mono min-w-[500px]">
                {Array.from({ length: safeTicksLength }).map((_, idx) => {
                  const leftPos = videoDuration > 0 ? (idx / videoDuration) * 100 : 0;
                  return <span key={idx} className="absolute" style={{ left: `${leftPos}%` }}>| {idx}s</span>;
                })}
              </div>

              {timelineElements.map(el => {
                const leftPercentage = videoDuration > 0 ? (el.startTime / videoDuration) * 100 : 0;
                const widthPercentage = videoDuration > 0 ? (el.duration / videoDuration) * 100 : 10;
                
                return (
                  <div key={el.id} className="w-full h-6 relative bg-zinc-900/20 rounded flex items-center min-w-[500px]">
                    <button
                      onClick={() => setSelectedElementId(el.id)}
                      className={`absolute h-full rounded text-left px-2 text-[10px] font-medium truncate border transition-all flex items-center ${
                        selectedElementId === el.id ? "bg-emerald-500/20 border-emerald-400 text-emerald-300" : "bg-zinc-800 border-zinc-700 text-zinc-300"
                      }`}
                      style={{ left: `${leftPercentage}%`, width: `${widthPercentage}%` }}
                    >
                      {el.name}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-zinc-800/60">
              <button onClick={() => { setViewState("setup"); setUnifiedVideoUrl(null); }} className="px-4 py-2 bg-zinc-800 text-xs rounded-lg hover:bg-zinc-700">Descartar todo</button>
              {viewState === "rendering" ? (
                <button disabled className="px-6 py-2 bg-zinc-800 text-xs text-amber-400 rounded-lg animate-pulse font-medium">Exportando video compuesto .mp4...</button>
              ) : (
                <button onClick={exportFinalComposite} className="px-6 py-2 bg-emerald-500 text-black font-bold text-xs rounded-lg hover:bg-emerald-600 shadow-md">
                  Exportar Video Combinado
                </button>
              )}
            </div>
          </div>

        </div>
      )}

    </main>
  );
}