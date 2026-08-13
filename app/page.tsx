"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Square, RotateCcw, Settings, Sliders, Camera, Mic,
  FlipHorizontal, FlipVertical, Maximize2, Minimize2, ChevronLeft,
  ChevronRight, Sparkles, Download, Trash2, Plus, Save, FolderOpen,
  Volume2, RefreshCw, Smartphone, Monitor, Eye, EyeOff, LayoutTemplate
} from "lucide-react";

// Redes sociales soportadas
const SOCIAL_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "🌐" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "x", label: "X (Twitter)", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "threads", label: "Threads", icon: "🧵" },
  { id: "youtube", label: "YouTube", icon: "📺" },
];

export default function TeleprompterProStudio() {
  // ========== ESTADO DE CÁMARA Y DISPOSITIVOS ==========
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");

  // ========== GRABACIÓN ==========
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // ========== GUIONES ==========
  const [savedScripts, setSavedScripts] = useState<{ id: string; title: string; text: string }[]>([]);
  const [currentScriptId, setCurrentScriptId] = useState<string>("default");
  const [scriptTitle, setScriptTitle] = useState("Mi Primer Guion");
  const [scriptText, setScriptText] = useState(
    `ESCENA 1\n¡Bienvenido al mejor Teleprompter Profesional! Configura tu velocidad de lectura, tamaño de fuente y aspecto visual abajo.\n\nESCENA 2\nPuedes grabar directamente con tu cámara, superponer tu logo y tus redes sociales quemadas en el video final.`
  );
  const [scenes, setScenes] = useState<{ id: number; title: string; text: string }[]>([
    { id: 1, title: "ESCENA 1", text: "¡Bienvenido al mejor Teleprompter Profesional! Configura tu velocidad de lectura..." }
  ]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // ========== MOTOR DE TELEPROMPTER ==========
  const [isPrompting, setIsPrompting] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2.5); // 0.5 a 10
  const [fontSize, setFontSize] = useState(32);
  const [contentWidth, setContentWidth] = useState(680);
  const [mirrorH, setMirrorH] = useState(false);      // Espejo del video
  const [mirrorV, setMirrorV] = useState(false);
  const [textMirrorH, setTextMirrorH] = useState(false); // Espejo del TEXTO del prompter
  const [textMirrorV, setTextMirrorV] = useState(false);
  const [eyeLinePos, setEyeLinePos] = useState(42);   // % de altura

  // ========== REDES Y LOGO ==========
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({
    facebook: "", instagram: "", x: "", tiktok: "", threads: "", youtube: ""
  });
  const [activeSocials, setActiveSocials] = useState<Record<string, boolean>>({});
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState("top-right");
  const [imageSize, setImageSize] = useState(80);

  // ========== REFS ==========
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollTime = useRef<number>(0);

  // ========== 1. CARGAR DISPOSITIVOS ==========
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const vDevices = devices.filter(d => d.kind === "videoinput");
        const aDevices = devices.filter(d => d.kind === "audioinput");
        setVideoDevices(vDevices);
        setAudioDevices(aDevices);
        if (vDevices.length > 0 && !selectedVideoDevice) setSelectedVideoDevice(vDevices[0].deviceId);
        if (aDevices.length > 0 && !selectedAudioDevice) setSelectedAudioDevice(aDevices[0].deviceId);
      } catch (err) {
        console.error("Error enumerating devices:", err);
      }
    }
    getDevices();
    navigator.mediaDevices.addEventListener("devicechange", getDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", getDevices);
  }, []);

  // ========== 2. INICIAR CÁMARA ==========
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice
          ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: 1280, height: 720 },
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraReady(true);

      // Wake Lock
      if ("wakeLock" in navigator) {
        try {
          await (navigator as any).wakeLock.request("screen");
        } catch (e) {
          console.log("Wake Lock error:", e);
        }
      }
    } catch (err) {
      setCameraReady(false);
      setCameraError("No se pudo acceder a la cámara o micrófono. Revisa los permisos.");
    }
  }, [selectedVideoDevice, selectedAudioDevice]);

  useEffect(() => {
    startCamera();
  }, [startCamera]);

  // ========== 3. GENERAR ESCENAS ==========
  const generateScenes = useCallback(() => {
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
  }, [scriptText]);

  useEffect(() => {
    generateScenes();
  }, [generateScenes]);

  // ========== 4. GUIONES EN LOCALSTORAGE ==========
  useEffect(() => {
    const local = localStorage.getItem("teleprompter_scripts");
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (parsed.length > 0) setSavedScripts(parsed);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveCurrentScript = () => {
    const newScript = { id: Date.now().toString(), title: scriptTitle, text: scriptText };
    const updated = [...savedScripts.filter(s => s.id !== currentScriptId), newScript];
    setSavedScripts(updated);
    setCurrentScriptId(newScript.id);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(updated));
    alert("¡Guion guardado correctamente!");
  };

  const loadScript = (id: string) => {
    const found = savedScripts.find(s => s.id === id);
    if (found) {
      setCurrentScriptId(found.id);
      setScriptTitle(found.title);
      setScriptText(found.text);
    }
  };

  // ========== 5. MOTOR DE SCROLL SUAVE (requestAnimationFrame) ==========
  const scrollStep = useCallback((timestamp: number) => {
    if (!isPrompting || !scrollContainerRef.current) return;

    if (!lastScrollTime.current) lastScrollTime.current = timestamp;
    const delta = timestamp - lastScrollTime.current;

    // Control de velocidad más natural (aprox 60fps)
    if (delta > 16) {
      const container = scrollContainerRef.current;
      const speedFactor = scrollSpeed * 0.55; // Ajuste fino de velocidad

      container.scrollTop += speedFactor;

      // Detectar final del texto
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 8) {
        setIsPrompting(false);
        return;
      }

      lastScrollTime.current = timestamp;
    }

    animationFrameRef.current = requestAnimationFrame(scrollStep);
  }, [isPrompting, scrollSpeed]);

  useEffect(() => {
    if (isPrompting) {
      lastScrollTime.current = 0;
      animationFrameRef.current = requestAnimationFrame(scrollStep);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPrompting, scrollStep]);

  // Reiniciar scroll al cambiar de escena
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentSceneIndex]);

  // Reiniciar scroll al iniciar el prompter
  const togglePrompting = () => {
    if (!isPrompting && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setIsPrompting(prev => !prev);
  };

  // ========== 6. ATAJOS DE TECLADO ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePrompting();
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        setScrollSpeed(prev => Math.min(prev + 0.5, 10));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setScrollSpeed(prev => Math.max(prev - 0.5, 0.5));
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        setCurrentSceneIndex(prev => Math.min(prev + 1, scenes.length - 1));
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        setCurrentSceneIndex(prev => Math.max(prev - 1, 0));
      } else if (e.code === "KeyR") {
        // R = Reset scroll
        e.preventDefault();
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scenes.length, isPrompting]);

  // ========== 7. SUBIDA DE LOGO ==========
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setOverlayImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // ========== 8. GRABACIÓN CON CANVAS COMPOSITING ==========
  const startRecordingWithCountdown = () => {
    setCountdown(3);
    const countInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countInterval);
          startRecordingProcess();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecordingProcess = () => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    // Tamaño según aspect ratio
    if (aspectRatio === "16:9") {
      canvasEl.width = 1280;
      canvasEl.height = 720;
    } else if (aspectRatio === "9:16") {
      canvasEl.width = 720;
      canvasEl.height = 1280;
    } else {
      canvasEl.width = 1080;
      canvasEl.height = 1080;
    }

    let logoImg: HTMLImageElement | null = null;
    if (overlayImage) {
      logoImg = new Image();
      logoImg.src = overlayImage;
    }

    let animationId: number;

    const drawCanvas = () => {
      if (!videoEl) return;

      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

      const vW = videoEl.videoWidth || 1280;
      const vH = videoEl.videoHeight || 720;
      const cW = canvasEl.width;
      const cH = canvasEl.height;

      // Cover logic
      const vRatio = vW / vH;
      const cRatio = cW / cH;
      let dW = cW, dH = cH, dX = 0, dY = 0;

      if (vRatio > cRatio) {
        dH = cH;
        dW = cH * vRatio;
        dX = (cW - dW) / 2;
      } else {
        dW = cW;
        dH = cW / vRatio;
        dY = (cH - dH) / 2;
      }

      // Dibujar video con espejo
      ctx.save();
      if (mirrorH || mirrorV) {
        ctx.translate(mirrorH ? cW : 0, mirrorV ? cH : 0);
        ctx.scale(mirrorH ? -1 : 1, mirrorV ? -1 : 1);
      }
      ctx.drawImage(videoEl, dX, dY, dW, dH);
      ctx.restore();

      // Logo
      if (logoImg && logoImg.complete) {
        const lSize = imageSize * (cW / 800);
        let lX = cW - lSize - 30;
        let lY = 30;
        if (imagePosition === "top-left") lX = 30;
        if (imagePosition === "bottom-left") {
          lX = 30;
          lY = cH - lSize - 30;
        }
        if (imagePosition === "bottom-right") {
          lY = cH - lSize - 30;
        }
        ctx.drawImage(logoImg, lX, lY, lSize, lSize);
      }

      // Redes sociales
      const activeList = SOCIAL_PLATFORMS.filter(p => activeSocials[p.id] && socialInputs[p.id]);
      if (activeList.length > 0) {
        ctx.save();
        ctx.font = "bold 20px system-ui, sans-serif";
        
        let startY = cH - 40 - (activeList.length * 36);
        activeList.forEach((p, idx) => {
          const text = `${p.icon}  ${socialInputs[p.id]}`;
          const metrics = ctx.measureText(text);
          const boxW = metrics.width + 28;
          const boxH = 32;
          const boxX = 24;
          const boxY = startY + (idx * 36);

          // Fondo
          ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, boxW, boxH, 8);
          ctx.fill();

          // Texto
          ctx.fillStyle = "#ffffff";
          ctx.fillText(text, boxX + 14, boxY + 22);
        });
        ctx.restore();
      }

      animationId = requestAnimationFrame(drawCanvas);
    };

    drawCanvas();

    // Capturar stream del canvas + audio
    const canvasStream = canvasEl.captureStream(30);
    const videoStream = videoEl.srcObject as MediaStream;
    const audioTracks = videoStream?.getAudioTracks() || [];
    audioTracks.forEach(track => canvasStream.addTrack(track));

    chunksRef.current = [];
    let options: MediaRecorderOptions = { mimeType: "video/webm;codecs=vp9,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
      options = { mimeType: "video/webm" };
    }

    const recorder = new MediaRecorder(canvasStream, options);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      cancelAnimationFrame(animationId);
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teleprompter-pro-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };

    recorder.start(200);
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const getPreviewPositionClass = () => {
    switch (imagePosition) {
      case "top-left": return "top-4 left-4";
      case "top-right": return "top-4 right-4";
      case "bottom-left": return "bottom-4 left-4";
      case "bottom-right": return "bottom-4 right-4";
      default: return "top-4 right-4";
    }
  };

  // ========== RENDER ==========
  return (
    <main className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-5xl flex flex-col gap-6">

        {/* ========== HEADER ========== */}
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-zinc-800 rounded-xl text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Teleprompter Pro Studio
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-mono">
                  v2.1 Improved
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                Scroll suave • Espejo de texto • Canvas compositing • Atajos de teclado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={currentScriptId}
              onChange={(e) => loadScript(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 outline-none flex-1 sm:flex-initial"
            >
              <option value="default">📁 Mis Guiones Guardados</option>
              {savedScripts.map(s => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            <button
              onClick={saveCurrentScript}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-xl border border-zinc-700 transition"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </header>

        {/* ========== LAYOUT PRINCIPAL ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ===== COLUMNA IZQUIERDA: VISOR ===== */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className={`w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col ${
              aspectRatio === "9:16" ? "max-w-sm mx-auto" : "w-full"
            }`}>

              {/* Barra de estado */}
              <div className="px-4 py-3 border-b border-zinc-800/60 flex justify-between items-center bg-zinc-900/80 z-20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-300 uppercase tracking-wider">
                    {scenes[currentSceneIndex]?.title || "ESTUDIO EN VIVO"}
                  </span>
                  {scenes.length > 1 && (
                    <span className="text-[11px] text-zinc-500 font-mono">
                      ({currentSceneIndex + 1}/{scenes.length})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {isRecording && (
                    <span className="text-xs font-mono text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/30">
                      🔴 REC {formatTime(recordingTime)}
                    </span>
                  )}
                  <span className={`h-2.5 w-2.5 rounded-full ${isRecording ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                </div>
              </div>

              {/* Visor de video */}
              <div className={`w-full relative bg-black flex items-center justify-center overflow-hidden ${
                aspectRatio === "16:9" ? "aspect-video" : aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-square"
              }`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-transform duration-300 ${
                    mirrorH ? "-scale-x-100" : ""
                  } ${mirrorV ? "-scale-y-100" : ""}`}
                />

                <canvas ref={canvasRef} className="hidden" />

                {/* Logo preview */}
                {overlayImage && (
                  <img
                    src={overlayImage}
                    alt="Logo"
                    className={`absolute ${getPreviewPositionClass()} object-contain rounded-lg border border-white/10 shadow-lg pointer-events-none`}
                    style={{ width: `${imageSize}px`, height: `${imageSize}px` }}
                  />
                )}

                {/* Redes preview */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 bg-black/40 p-2.5 rounded-xl backdrop-blur-sm border border-zinc-800/50 max-w-[240px] pointer-events-none">
                  {SOCIAL_PLATFORMS.map(p => {
                    if (!activeSocials[p.id] || !socialInputs[p.id]) return null;
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-white text-xs font-medium drop-shadow-md">
                        <span className="text-sm bg-zinc-900/80 p-1 rounded-md">{p.icon}</span>
                        <span className="truncate">{socialInputs[p.id]}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Countdown */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-md">
                    <span className="text-7xl font-black text-emerald-400 animate-bounce">{countdown}</span>
                  </div>
                )}

                {/* ===== TELEPROMPTER OVERLAY ===== */}
                {(isPrompting || isRecording) && (
                  <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center p-4 sm:p-8 backdrop-blur-[1px] z-30">

                    {/* Eye-line */}
                    <div
                      className="absolute left-0 right-0 h-[2px] bg-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.9)] pointer-events-none flex items-center justify-between px-4"
                      style={{ top: `${eyeLinePos}%` }}
                    >
                      <span className="text-[10px] font-mono text-emerald-400 bg-black/80 px-1.5 py-0.5 rounded">
                        LENTE
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-black/80 px-1.5 py-0.5 rounded">
                        MIRAR AQUÍ
                      </span>
                    </div>

                    {/* Contenedor de texto con scroll */}
                    <div
                      ref={scrollContainerRef}
                      className="w-full h-full overflow-y-auto no-scrollbar py-28 px-3 text-center select-none flex flex-col items-center"
                      style={{ maxWidth: `${contentWidth}px` }}
                    >
                      <p
                        className="text-white font-bold leading-relaxed drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] whitespace-pre-line transition-transform duration-200"
                        style={{
                          fontSize: `${fontSize}px`,
                          transform: `scaleX(${textMirrorH ? -1 : 1}) scaleY(${textMirrorV ? -1 : 1})`
                        }}
                      >
                        {scenes[currentSceneIndex]?.text || scriptText}
                      </p>
                    </div>

                    {/* Controles flotantes */}
                    <div className="absolute bottom-4 bg-zinc-900/95 border border-zinc-700 px-4 py-2.5 rounded-2xl flex items-center gap-4 backdrop-blur-md z-40 shadow-xl">
                      <button
                        onClick={togglePrompting}
                        className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition"
                      >
                        {isPrompting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">Vel:</span>
                        <input
                          type="range"
                          min="0.5"
                          max="8"
                          step="0.5"
                          value={scrollSpeed}
                          onChange={(e) => setScrollSpeed(Number(e.target.value))}
                          className="w-24 accent-emerald-400"
                        />
                        <span className="font-mono text-emerald-400 w-8">{scrollSpeed}x</span>
                      </div>

                      <button
                        onClick={() => {
                          if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
                        }}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-lg"
                        title="Reiniciar scroll (R)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setIsPrompting(false)}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1 bg-zinc-800 rounded-lg"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                )}

                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 text-xs text-zinc-400 text-center p-4">
                    {cameraError || "Accediendo a la cámara y micrófono..."}
                  </div>
                )}
              </div>

              {/* Botonera inferior del visor */}
              <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap items-center justify-between gap-3 z-20">
                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentSceneIndex === 0}
                    onClick={() => setCurrentSceneIndex(p => Math.max(p - 1, 0))}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl disabled:opacity-30 border border-zinc-800 transition"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={currentSceneIndex === scenes.length - 1}
                    onClick={() => setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1))}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl disabled:opacity-30 border border-zinc-800 transition"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={togglePrompting}
                    className={`px-3 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
                      isPrompting
                        ? "bg-amber-600/20 text-amber-400 border-amber-600/40"
                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border-zinc-800"
                    }`}
                  >
                    {isPrompting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {isPrompting ? "Pausar" : "Iniciar Prompter"}
                  </button>
                </div>

                {!isRecording ? (
                  <button
                    onClick={startRecordingWithCountdown}
                    disabled={!cameraReady}
                    className="py-2.5 px-5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 flex items-center gap-2 shadow-lg shadow-red-600/20"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    Iniciar Grabación
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="py-2.5 px-5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Detener y Descargar
                  </button>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMirrorH(!mirrorH)}
                    className={`p-2 rounded-xl border transition ${
                      mirrorH
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                    }`}
                    title="Espejo Horizontal (Video)"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMirrorV(!mirrorV)}
                    className={`p-2 rounded-xl border transition ${
                      mirrorV
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                        : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800"
                    }`}
                    title="Espejo Vertical (Video)"
                  >
                    <FlipVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===== COLUMNA DERECHA: CONTROLES ===== */}
          <div className="flex flex-col gap-4">

            {/* Dispositivos */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Dispositivos y Formato</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Cámara, micrófono y relación de aspecto</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                    <Camera className="w-3 h-3" /> Cámara
                  </label>
                  <select
                    value={selectedVideoDevice}
                    onChange={(e) => setSelectedVideoDevice(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 outline-none"
                  >
                    {videoDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Cámara ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                    <Mic className="w-3 h-3" /> Micrófono
                  </label>
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => setSelectedAudioDevice(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-xs text-zinc-300 outline-none"
                  >
                    {audioDevices.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Micrófono ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-1">
                    <LayoutTemplate className="w-3 h-3" /> Formato
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["16:9", "9:16", "1:1"] as const).map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={`py-2 text-xs rounded-xl border font-medium transition ${
                          aspectRatio === ratio
                            ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                            : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                        }`}
                      >
                        {ratio === "16:9" ? "16:9 HD" : ratio === "9:16" ? "9:16 Reel" : "1:1"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Ajustes de Lectura */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Ajustes de Lectura</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Tipografía, ancho y línea de enfoque</p>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                    <span>Tamaño Fuente</span>
                    <span>{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="18"
                    max="64"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="accent-emerald-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                    <span>Ancho de Lectura</span>
                    <span>{contentWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="380"
                    max="900"
                    step="20"
                    value={contentWidth}
                    onChange={(e) => setContentWidth(Number(e.target.value))}
                    className="accent-emerald-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                    <span>Línea de Enfoque</span>
                    <span>{eyeLinePos}%</span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="75"
                    value={eyeLinePos}
                    onChange={(e) => setEyeLinePos(Number(e.target.value))}
                    className="accent-emerald-400"
                  />
                </div>

                {/* Espejo del TEXTO */}
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">Espejo del Texto (Beam-splitter)</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTextMirrorH(!textMirrorH)}
                      className={`flex-1 py-2 text-xs rounded-xl border font-medium transition flex items-center justify-center gap-1.5 ${
                        textMirrorH
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                          : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                      }`}
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" /> Horizontal
                    </button>
                    <button
                      onClick={() => setTextMirrorV(!textMirrorV)}
                      className={`flex-1 py-2 text-xs rounded-xl border font-medium transition flex items-center justify-center gap-1.5 ${
                        textMirrorV
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                          : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:bg-zinc-900"
                      }`}
                    >
                      <FlipVertical className="w-3.5 h-3.5" /> Vertical
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========== EDITOR DE GUION ========== */}
        <div className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Editor de Guion y Escenas</h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Doble salto de línea = nueva escena. Atajos: Espacio (Play/Pausa) • ↑↓ Velocidad • ←→ Escenas • R Reiniciar
              </p>
            </div>
            <input
              type="text"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              placeholder="Título del guion..."
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 outline-none w-full sm:w-60"
            />
          </div>

          <textarea
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            rows={5}
            placeholder={`ESCENA 1\nTu texto aquí...\n\nESCENA 2\nSiguiente texto...`}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-700 font-sans leading-relaxed"
          />

          <div className="flex justify-between items-center">
            <span className="text-xs text-zinc-500 font-mono">
              {scriptText.split(/\s+/).filter(Boolean).length} palabras ≈{" "}
              {Math.ceil(scriptText.split(/\s+/).filter(Boolean).length / 140)} min
            </span>
            <button
              onClick={generateScenes}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" /> Actualizar Escenas
            </button>
          </div>
        </div>

        {/* ========== REDES + LOGO ========== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          {/* Redes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-4 shadow-lg">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Redes Sociales en Pantalla</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Se graban directamente en el video final (burn-in)</p>
            </div>

            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
              {SOCIAL_PLATFORMS.map(platform => (
                <div key={platform.id} className="flex items-center gap-3 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                  <input
                    type="checkbox"
                    checked={!!activeSocials[platform.id]}
                    onChange={(e) =>
                      setActiveSocials(prev => ({ ...prev, [platform.id]: e.target.checked }))
                    }
                    className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs w-24 flex items-center gap-1 text-zinc-300 font-medium">
                    <span>{platform.icon}</span> {platform.label}
                  </span>
                  <input
                    type="text"
                    placeholder="@usuario"
                    value={socialInputs[platform.id]}
                    onChange={(e) =>
                      setSocialInputs(prev => ({ ...prev, [platform.id]: e.target.value }))
                    }
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-700"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Logo */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-lg">
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-400">Logo / Marca de Agua</h3>
                <p className="text-xs text-zinc-500 mt-0.5">PNG transparente recomendado</p>
              </div>

              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />

              {overlayImage && (
                <div className="grid grid-cols-2 gap-3 mt-1 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">Posición</label>
                    <select
                      value={imagePosition}
                      onChange={(e) => setImagePosition(e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-1.5 text-xs text-zinc-300 outline-none"
                    >
                      <option value="top-left">Arriba Izquierda</option>
                      <option value="top-right">Arriba Derecha</option>
                      <option value="bottom-left">Abajo Izquierda</option>
                      <option value="bottom-right">Abajo Derecha</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono text-zinc-500 uppercase">
                      Tamaño ({imageSize}px)
                    </label>
                    <input
                      type="range"
                      min="40"
                      max="180"
                      value={imageSize}
                      onChange={(e) => setImageSize(Number(e.target.value))}
                      className="w-full accent-emerald-400 mt-2"
                    />
                  </div>
                </div>
              )}
            </div>

            {overlayImage && (
              <button
                onClick={() => setOverlayImage(null)}
                className="text-left text-[11px] text-red-400 hover:underline self-start flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Quitar imagen
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}