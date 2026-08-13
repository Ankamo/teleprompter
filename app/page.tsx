"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Square, RotateCcw, Camera, Mic, FlipHorizontal, FlipVertical,
  ChevronLeft, ChevronRight, Sparkles, Save, Trash2, LayoutTemplate,
  Maximize2, Minimize2, Smartphone, Link2, Unlink, Mic2, Eye
} from "lucide-react";
import Peer, { MediaConnection, DataConnection } from "peerjs";

const SOCIAL_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "🌐" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "x", label: "X", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "threads", label: "Threads", icon: "🧵" },
  { id: "youtube", label: "YouTube", icon: "📺" },
];

type RemoteCamera = { deviceId: string; label: string };

export default function TeleprompterProStudio() {
  // ========== DISPOSITIVOS LOCALES ==========
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");

  // ========== MULTI-DISPOSITIVO (WebRTC + DataChannel) ==========
  const [connectionMode, setConnectionMode] = useState<"local" | "host" | "camera">("local");
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [remoteCameras, setRemoteCameras] = useState<RemoteCamera[]>([]);
  const [selectedRemoteCamera, setSelectedRemoteCamera] = useState("");
  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnectionRef = useRef<DataConnection | null>(null);

  // ========== GRABACIÓN ==========
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);

  // ========== GUIONES ==========
  const [savedScripts, setSavedScripts] = useState<{ id: string; title: string; text: string }[]>([]);
  const [currentScriptId, setCurrentScriptId] = useState("default");
  const [scriptTitle, setScriptTitle] = useState("Mi Primer Guion");
  const [scriptText, setScriptText] = useState(
    `ESCENA 1\n¡Bienvenido a Teleprompter Pro Studio! Ahora con multi-dispositivo, Voice Tracking y PWA.\n\nESCENA 2\nConecta tu teléfono como cámara remota y graba desde el ordenador con el teleprompter.`
  );
  const [scenes, setScenes] = useState<{ id: number; title: string; text: string }[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // ========== TELEPROMPTER ENGINE ==========
  const [isPrompting, setIsPrompting] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(2.8);
  const [fontSize, setFontSize] = useState(34);
  const [contentWidth, setContentWidth] = useState(640);
  const [mirrorH, setMirrorH] = useState(false);
  const [mirrorV, setMirrorV] = useState(false);
  const [textMirrorH, setTextMirrorH] = useState(false);
  const [textMirrorV, setTextMirrorV] = useState(false);
  const [eyeLinePos, setEyeLinePos] = useState(40);
  const [showHighlightBand, setShowHighlightBand] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [voiceTracking, setVoiceTracking] = useState(false);

  // ========== REDES + LOGO ==========
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({
    facebook: "", instagram: "", x: "", tiktok: "", threads: "", youtube: ""
  });
  const [activeSocials, setActiveSocials] = useState<Record<string, boolean>>({});
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState("top-right");
  const [imageSize, setImageSize] = useState(85);

  // ========== REFS ==========
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollTime = useRef(0);
  const recognitionRef = useRef<any>(null);

  // ========== HELPER: Detectar cámaras disponibles ==========
  const getAvailableCameras = async (): Promise<RemoteCamera[]> => {
    try {
      // Pedir permiso para que aparezcan los labels
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === "videoinput")
        .map((cam, i) => ({
          deviceId: cam.deviceId,
          label: cam.label || `Cámara ${i + 1}`
        }));
    } catch {
      return [];
    }
  };

  // ========== HELPER: Cambiar a una cámara concreta (en el iPhone) ==========
  const switchToCamera = async (deviceId: string) => {
    try {
      if (videoRef.current?.srcObject) {
        const old = videoRef.current.srcObject as MediaStream;
        old.getTracks().forEach(t => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Reemplazar el track de video en la llamada activa
      if (callRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = (callRef.current as any).peerConnection
          ?.getSenders()
          ?.find((s: RTCRtpSender) => s.track?.kind === "video");

        if (sender && videoTrack) {
          await sender.replaceTrack(videoTrack);
        }
      }

      setSelectedRemoteCamera(deviceId);
    } catch (err) {
      console.error("Error cambiando cámara:", err);
      setCameraError("No se pudo cambiar de cámara");
    }
  };

  // ========== INICIALIZAR PEERJS ==========
  useEffect(() => {
    if (connectionMode === "local") {
      peerRef.current?.destroy();
      peerRef.current = null;
      return;
    }

    const peer = new Peer({
      debug: 1,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    });

    peer.on("open", (id) => {
      setPeerId(id);
      setConnectionStatus(
        connectionMode === "host"
          ? "Esperando cámara remota..."
          : "Listo para conectar"
      );
    });

    // ===== DataConnection (lista de cámaras + comandos) =====
    peer.on("connection", (conn) => {
      dataConnectionRef.current = conn;

      conn.on("open", async () => {
        if (connectionMode === "camera") {
          // El iPhone envía su lista de cámaras al Host
          const cams = await getAvailableCameras();
          conn.send({ type: "camera-list", cameras: cams });
        }
      });

      conn.on("data", async (data: any) => {
        // Host recibe la lista de cámaras del iPhone
        if (data?.type === "camera-list" && connectionMode === "host") {
          setRemoteCameras(data.cameras || []);
          if (data.cameras?.length > 0) {
            setSelectedRemoteCamera(data.cameras[0].deviceId);
          }
        }

        // iPhone recibe orden de cambiar de cámara
        if (data?.type === "switch-camera" && connectionMode === "camera") {
          await switchToCamera(data.deviceId);
        }
      });
    });

    // ===== MediaConnection (video) =====
    peer.on("call", (call) => {
      // El Host solo recibe el stream, no envía el suyo
      call.answer();

      call.on("stream", (remoteStream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = remoteStream;
          setCameraReady(true);
          setIsConnected(true);
          setConnectionStatus("Cámara remota conectada");
        }
      });

      call.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("Desconectado");
        setRemoteCameras([]);
      });

      callRef.current = call;
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
      peerRef.current = null;
    };
  }, [connectionMode]);

  // ========== CONECTAR COMO CÁMARA (iPhone) ==========
  const connectAsCamera = async () => {
    if (!peerRef.current || !remotePeerId.trim()) return;

    try {
      setCameraError(null);

      // 1. Conexión de datos para enviar lista de cámaras
      const conn = peerRef.current.connect(remotePeerId.trim());
      dataConnectionRef.current = conn;

      conn.on("open", async () => {
        const cams = await getAvailableCameras();
        conn.send({ type: "camera-list", cameras: cams });
      });

      conn.on("data", async (data: any) => {
        if (data?.type === "switch-camera") {
          await switchToCamera(data.deviceId);
        }
      });

      // 2. Empezar con la primera cámara disponible
      const cams = await getAvailableCameras();
      const firstId = cams[0]?.deviceId;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: firstId
          ? { deviceId: { exact: firstId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 3. Llamar al Host con el stream
      const call = peerRef.current.call(remotePeerId.trim(), stream);

      call.on("stream", () => {
        setIsConnected(true);
        setConnectionStatus("Conectado al Host");
      });

      call.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("Desconectado");
      });

      callRef.current = call;
      setCameraReady(true);
      if (firstId) setSelectedRemoteCamera(firstId);
    } catch (err) {
      console.error(err);
      setCameraError("No se pudo acceder a la cámara del dispositivo");
    }
  };

  // ========== HOST: pedir cambio de cámara al iPhone ==========
  const requestRemoteCameraChange = (deviceId: string) => {
    setSelectedRemoteCamera(deviceId);
    if (dataConnectionRef.current?.open) {
      dataConnectionRef.current.send({
        type: "switch-camera",
        deviceId
      });
    }
  };

  // ========== CÁMARA LOCAL ==========
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === "videoinput"));
        setAudioDevices(devices.filter(d => d.kind === "audioinput"));
      } catch {}
    }
    getDevices();
    navigator.mediaDevices?.addEventListener("devicechange", getDevices);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", getDevices);
  }, []);

  const startCamera = useCallback(async () => {
    // Si somos Host y ya tenemos stream remoto, no tocamos la cámara local
    if (connectionMode === "host" && isConnected) return;

    try {
      setCameraError(null);

      if (videoRef.current?.srcObject) {
        const old = videoRef.current.srcObject as MediaStream;
        old.getTracks().forEach(t => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice
          ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraReady(true);

      if ("wakeLock" in navigator) {
        try {
          await (navigator as any).wakeLock.request("screen");
        } catch {}
      }
    } catch {
      setCameraReady(false);
      setCameraError("No se pudo acceder a la cámara");
    }
  }, [selectedVideoDevice, selectedAudioDevice, connectionMode, isConnected]);

  useEffect(() => {
    if (connectionMode === "local") {
      startCamera();
    }
  }, [startCamera, connectionMode]);

  // ========== ESCENAS ==========
  useEffect(() => {
    const blocks = scriptText.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    const newScenes = blocks.map((block, i) => {
      const lines = block.split("\n").map(l => l.trim()).filter(Boolean);
      const first = lines[0] || `ESCENA ${i + 1}`;
      const title = first.toUpperCase().startsWith("ESCENA") ? first.toUpperCase() : `ESCENA ${i + 1}`;
      return { id: i + 1, title, text: lines.slice(1).join(" ") || first };
    });
    setScenes(newScenes.length ? newScenes : [{ id: 1, title: "ESCENA 1", text: scriptText }]);
    setCurrentSceneIndex(0);
  }, [scriptText]);

  // ========== LOCALSTORAGE ==========
  useEffect(() => {
    const saved = localStorage.getItem("teleprompter_scripts");
    if (saved) {
      try {
        setSavedScripts(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const saveCurrentScript = () => {
    const newScript = { id: Date.now().toString(), title: scriptTitle, text: scriptText };
    const updated = [...savedScripts.filter(s => s.id !== currentScriptId), newScript];
    setSavedScripts(updated);
    setCurrentScriptId(newScript.id);
    localStorage.setItem("teleprompter_scripts", JSON.stringify(updated));
    alert("Guion guardado");
  };

  // ========== SCROLL SUAVE ==========
  const scrollStep = useCallback((timestamp: number) => {
    if (!isPrompting || !scrollContainerRef.current) return;
    if (!lastScrollTime.current) lastScrollTime.current = timestamp;
    const delta = timestamp - lastScrollTime.current;

    if (delta > 16) {
      const el = scrollContainerRef.current;
      el.scrollTop += scrollSpeed * 0.52;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
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
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPrompting, scrollStep]);

  useEffect(() => {
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [currentSceneIndex]);

  const togglePrompting = () => {
    if (!isPrompting && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setIsPrompting(p => !p);
  };

  // ========== VOICE TRACKING ==========
  useEffect(() => {
    if (!voiceTracking) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Tu navegador no soporta Voice Tracking");
      setVoiceTracking(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-ES";

    recognition.onresult = () => {
      if (isPrompting) {
        setScrollSpeed(prev => Math.min(prev + 0.15, 8));
      } else {
        setIsPrompting(true);
      }
    };

    recognition.onerror = () => {};
    recognition.start();
    recognitionRef.current = recognition;

    return () => recognition.stop();
  }, [voiceTracking, isPrompting]);

  // ========== ATAJOS ==========
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePrompting();
      }
      if (e.code === "ArrowUp") setScrollSpeed(p => Math.min(p + 0.5, 10));
      if (e.code === "ArrowDown") setScrollSpeed(p => Math.max(p - 0.5, 0.5));
      if (e.code === "ArrowRight") setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1));
      if (e.code === "ArrowLeft") setCurrentSceneIndex(p => Math.max(p - 1, 0));
      if (e.code === "KeyR" && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
      if (e.code === "KeyF") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scenes.length]);

  // ========== FULLSCREEN ==========
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // ========== GRABACIÓN CANVAS ==========
  const startRecordingWithCountdown = () => {
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(iv);
          startRecordingProcess();
          return null;
        }
        return prev! - 1;
      });
    }, 1000);
  };

  const startRecordingProcess = () => {
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!videoEl || !canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

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

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      const vW = videoEl.videoWidth || 1280;
      const vH = videoEl.videoHeight || 720;
      const cW = canvasEl.width;
      const cH = canvasEl.height;
      const vRatio = vW / vH;
      const cRatio = cW / cH;
      let dW = cW,
        dH = cH,
        dX = 0,
        dY = 0;
      if (vRatio > cRatio) {
        dH = cH;
        dW = cH * vRatio;
        dX = (cW - dW) / 2;
      } else {
        dW = cW;
        dH = cW / vRatio;
        dY = (cH - dH) / 2;
      }

      ctx.save();
      if (mirrorH || mirrorV) {
        ctx.translate(mirrorH ? cW : 0, mirrorV ? cH : 0);
        ctx.scale(mirrorH ? -1 : 1, mirrorV ? -1 : 1);
      }
      ctx.drawImage(videoEl, dX, dY, dW, dH);
      ctx.restore();

      if (logoImg?.complete) {
        const size = imageSize * (cW / 800);
        let x = cW - size - 30,
          y = 30;
        if (imagePosition.includes("left")) x = 30;
        if (imagePosition.includes("bottom")) y = cH - size - 30;
        ctx.drawImage(logoImg, x, y, size, size);
      }

      const active = SOCIAL_PLATFORMS.filter(p => activeSocials[p.id] && socialInputs[p.id]);
      active.forEach((p, i) => {
        const text = `${p.icon} ${socialInputs[p.id]}`;
        ctx.font = "bold 20px system-ui";
        const w = ctx.measureText(text).width + 28;
        const y = cH - 50 - (active.length - 1 - i) * 38;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.beginPath();
        ctx.roundRect(24, y, w, 32, 8);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, 38, y + 22);
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvasEl.captureStream(30);
    const videoStream = videoEl.srcObject as MediaStream;
    videoStream?.getAudioTracks().forEach(t => canvasStream.addTrack(t));

    chunksRef.current = [];
    const recorder = new MediaRecorder(canvasStream, {
      mimeType: "video/webm;codecs=vp9,opus"
    });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      cancelAnimationFrame(animId);
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teleprompter-${Date.now()}.webm`;
      a.click();
    };
    recorder.start(200);
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ========== RENDER ==========
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 font-sans">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-white flex items-center gap-2">
                Teleprompter Pro Studio
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                  v3.1 Multi-Cam
                </span>
              </h1>
              <p className="text-xs text-zinc-400">
                PWA • Multi-dispositivo • Selección de cámaras remotas
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={toggleFullscreen} className="p-2 bg-zinc-800 rounded-xl border border-zinc-700">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={saveCurrentScript}
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 rounded-xl text-xs border border-zinc-700"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          </div>
        </header>

        {/* ========== MULTI-DEVICE PANEL ========== */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Vinculación Multi-Dispositivo
          </h3>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={connectionMode}
              onChange={e => {
                setConnectionMode(e.target.value as any);
                setIsConnected(false);
                setRemoteCameras([]);
                setConnectionStatus("");
              }}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs"
            >
              <option value="local">Solo este dispositivo</option>
              <option value="host">Host (Recibe cámara remota)</option>
              <option value="camera">Cámara remota (Envía video)</option>
            </select>

            {connectionMode !== "local" && (
              <>
                <div className="text-xs bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-700">
                  Tu ID:{" "}
                  <span className="font-mono text-emerald-400">
                    {peerId || "generando..."}
                  </span>
                </div>

                {connectionMode === "camera" && (
                  <>
                    <input
                      value={remotePeerId}
                      onChange={e => setRemotePeerId(e.target.value)}
                      placeholder="ID del Host"
                      className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs w-48"
                    />
                    <button
                      onClick={connectAsCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold transition"
                    >
                      {isConnected ? "Reconectar" : "Conectar"}
                    </button>
                  </>
                )}

                <span
                  className={`text-xs ${
                    isConnected ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {connectionStatus || (isConnected ? "Conectado" : "Desconectado")}
                </span>
              </>
            )}
          </div>

          {/* Lista de cámaras del dispositivo remoto (solo en Host) */}
          {connectionMode === "host" && remoteCameras.length > 0 && (
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">
                Cámaras disponibles en el dispositivo remoto
              </p>
              <div className="flex flex-wrap gap-2">
                {remoteCameras.map(cam => {
                  const isFront =
                    /front|frontal|user|face/i.test(cam.label);
                  const isBack =
                    /back|rear|trasera|environment|world/i.test(cam.label);

                  return (
                    <button
                      key={cam.deviceId}
                      onClick={() => requestRemoteCameraChange(cam.deviceId)}
                      className={`px-3 py-2 text-xs rounded-xl border transition flex items-center gap-1.5 ${
                        selectedRemoteCamera === cam.deviceId
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                          : "bg-zinc-950 text-zinc-300 border-zinc-700 hover:bg-zinc-900"
                      }`}
                    >
                      <span>{isFront ? "🤳" : isBack ? "📷" : "📹"}</span>
                      <span className="truncate max-w-[160px]">{cam.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {cameraError && (
            <p className="text-xs text-red-400">{cameraError}</p>
          )}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* VISOR */}
          <div className="lg:col-span-2">
            <div
              className={`bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden ${
                aspectRatio === "9:16" ? "max-w-sm mx-auto" : ""
              }`}
            >
              <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center text-xs">
                <span className="font-mono">
                  {scenes[currentSceneIndex]?.title || "EN VIVO"}
                </span>
                {isRecording && (
                  <span className="text-red-400 font-bold">
                    REC {formatTime(recordingTime)}
                  </span>
                )}
              </div>

              <div
                className={`relative bg-black ${
                  aspectRatio === "16:9"
                    ? "aspect-video"
                    : aspectRatio === "9:16"
                    ? "aspect-[9/16]"
                    : "aspect-square"
                }`}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={connectionMode !== "camera"}
                  className={`w-full h-full object-cover ${
                    mirrorH ? "-scale-x-100" : ""
                  } ${mirrorV ? "-scale-y-100" : ""}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {overlayImage && (
                  <img
                    src={overlayImage}
                    className={`absolute object-contain pointer-events-none ${
                      imagePosition.includes("top") ? "top-4" : "bottom-4"
                    } ${imagePosition.includes("left") ? "left-4" : "right-4"}`}
                    style={{ width: imageSize, height: imageSize }}
                    alt="Logo"
                  />
                )}

                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <span className="text-8xl font-black text-emerald-400">
                      {countdown}
                    </span>
                  </div>
                )}

                {(isPrompting || isRecording) && (
                  <div className="absolute inset-0 bg-black/50 z-30 flex flex-col">
                    {showHighlightBand && (
                      <div
                        className="absolute left-0 right-0 bg-emerald-500/15 border-y border-emerald-500/40 pointer-events-none"
                        style={{
                          top: `calc(${eyeLinePos}% - 45px)`,
                          height: "90px"
                        }}
                      />
                    )}

                    <div
                      className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_12px_#10b981]"
                      style={{ top: `${eyeLinePos}%` }}
                    />

                    <div
                      ref={scrollContainerRef}
                      className="flex-1 overflow-y-auto no-scrollbar py-32 px-4 flex justify-center"
                      style={{ maxWidth: contentWidth, margin: "0 auto" }}
                    >
                      <p
                        className="text-white font-bold text-center leading-relaxed drop-shadow-lg whitespace-pre-line"
                        style={{
                          fontSize,
                          transform: `scaleX(${textMirrorH ? -1 : 1}) scaleY(${
                            textMirrorV ? -1 : 1
                          })`
                        }}
                      >
                        {scenes[currentSceneIndex]?.text}
                      </p>
                    </div>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700 rounded-2xl px-4 py-2 flex items-center gap-3">
                      <button
                        onClick={togglePrompting}
                        className="p-2 bg-emerald-600 rounded-xl"
                      >
                        {isPrompting ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={scrollSpeed}
                        onChange={e => setScrollSpeed(+e.target.value)}
                        className="w-24 accent-emerald-400"
                      />
                      <span className="text-xs font-mono text-emerald-400">
                        {scrollSpeed}x
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* CONTROLES VISOR */}
              <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex flex-wrap justify-between gap-2">
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setCurrentSceneIndex(p => Math.max(0, p - 1))
                    }
                    className="p-2 bg-zinc-900 rounded-xl border border-zinc-800"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentSceneIndex(p =>
                        Math.min(scenes.length - 1, p + 1)
                      )
                    }
                    className="p-2 bg-zinc-900 rounded-xl border border-zinc-800"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePrompting}
                    className={`px-3 py-2 rounded-xl text-xs border ${
                      isPrompting
                        ? "bg-amber-600/20 text-amber-400 border-amber-600/40"
                        : "bg-zinc-900 border-zinc-800"
                    }`}
                  >
                    {isPrompting ? "Pausar" : "Prompter"}
                  </button>
                </div>

                {!isRecording ? (
                  <button
                    onClick={startRecordingWithCountdown}
                    disabled={!cameraReady}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-bold uppercase disabled:opacity-40"
                  >
                    🔴 Grabar
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-5 py-2.5 bg-white text-black rounded-xl text-xs font-bold uppercase"
                  >
                    Detener
                  </button>
                )}

                <div className="flex gap-1">
                  <button
                    onClick={() => setMirrorH(!mirrorH)}
                    className={`p-2 rounded-xl border ${
                      mirrorH
                        ? "text-emerald-400 border-emerald-600/40"
                        : "border-zinc-800"
                    }`}
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMirrorV(!mirrorV)}
                    className={`p-2 rounded-xl border ${
                      mirrorV
                        ? "text-emerald-400 border-emerald-600/40"
                        : "border-zinc-800"
                    }`}
                  >
                    <FlipVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono text-zinc-400 uppercase">
                Funciones Avanzadas
              </h3>
              <label className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Mic2 className="w-4 h-4" /> Voice Tracking
                </span>
                <input
                  type="checkbox"
                  checked={voiceTracking}
                  onChange={e => setVoiceTracking(e.target.checked)}
                  className="accent-emerald-500"
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Highlight Band
                </span>
                <input
                  type="checkbox"
                  checked={showHighlightBand}
                  onChange={e => setShowHighlightBand(e.target.checked)}
                  className="accent-emerald-500"
                />
              </label>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-mono text-zinc-400 uppercase">
                Lectura
              </h3>
              <div>
                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                  <span>Fuente</span>
                  <span>{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="70"
                  value={fontSize}
                  onChange={e => setFontSize(+e.target.value)}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                  <span>Ancho</span>
                  <span>{contentWidth}px</span>
                </div>
                <input
                  type="range"
                  min="360"
                  max="900"
                  step="20"
                  value={contentWidth}
                  onChange={e => setContentWidth(+e.target.value)}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                  <span>Línea enfoque</span>
                  <span>{eyeLinePos}%</span>
                </div>
                <input
                  type="range"
                  min="25"
                  max="70"
                  value={eyeLinePos}
                  onChange={e => setEyeLinePos(+e.target.value)}
                  className="w-full accent-emerald-400"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setTextMirrorH(!textMirrorH)}
                  className={`flex-1 py-2 text-xs rounded-xl border ${
                    textMirrorH
                      ? "text-emerald-400 border-emerald-600/40"
                      : "border-zinc-700"
                  }`}
                >
                  Texto H
                </button>
                <button
                  onClick={() => setTextMirrorV(!textMirrorV)}
                  className={`flex-1 py-2 text-xs rounded-xl border ${
                    textMirrorV
                      ? "text-emerald-400 border-emerald-600/40"
                      : "border-zinc-700"
                  }`}
                >
                  Texto V
                </button>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h3 className="text-xs font-mono text-zinc-400 uppercase mb-3">
                Formato
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(["16:9", "9:16", "1:1"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`py-2 text-xs rounded-xl border ${
                      aspectRatio === r
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                        : "border-zinc-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* EDITOR */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-mono text-zinc-400 uppercase">
              Editor de Guion
            </h3>
            <input
              value={scriptTitle}
              onChange={e => setScriptTitle(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs w-48"
            />
          </div>
          <textarea
            value={scriptText}
            onChange={e => setScriptText(e.target.value)}
            rows={5}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-sm"
            placeholder="ESCENA 1&#10;Texto...&#10;&#10;ESCENA 2&#10;Más texto..."
          />
          <div className="text-xs text-zinc-500">
            {scriptText.split(/\s+/).filter(Boolean).length} palabras ≈{" "}
            {Math.ceil(
              scriptText.split(/\s+/).filter(Boolean).length / 140
            )}{" "}
            min
          </div>
        </div>

        {/* REDES + LOGO */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-mono text-zinc-400 uppercase">
              Redes (se graban en el video)
            </h3>
            {SOCIAL_PLATFORMS.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!activeSocials[p.id]}
                  onChange={e =>
                    setActiveSocials(prev => ({
                      ...prev,
                      [p.id]: e.target.checked
                    }))
                  }
                  className="accent-emerald-500"
                />
                <span className="text-xs w-20">
                  {p.icon} {p.label}
                </span>
                <input
                  value={socialInputs[p.id]}
                  onChange={e =>
                    setSocialInputs(prev => ({
                      ...prev,
                      [p.id]: e.target.value
                    }))
                  }
                  placeholder="@usuario"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs"
                />
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-mono text-zinc-400 uppercase">
              Logo / Marca de agua
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () =>
                    setOverlayImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
              className="text-xs"
            />
            {overlayImage && (
              <>
                <select
                  value={imagePosition}
                  onChange={e => setImagePosition(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-xs"
                >
                  <option value="top-right">Arriba Derecha</option>
                  <option value="top-left">Arriba Izquierda</option>
                  <option value="bottom-right">Abajo Derecha</option>
                  <option value="bottom-left">Abajo Izquierda</option>
                </select>
                <input
                  type="range"
                  min="40"
                  max="180"
                  value={imageSize}
                  onChange={e => setImageSize(+e.target.value)}
                  className="w-full accent-emerald-400"
                />
                <button
                  onClick={() => setOverlayImage(null)}
                  className="text-xs text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Quitar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}