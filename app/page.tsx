"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Square, RotateCcw, Camera, Mic, FlipHorizontal, FlipVertical,
  ChevronLeft, ChevronRight, Sparkles, Save, Trash2, LayoutTemplate,
  Maximize2, Minimize2, Smartphone, Link2, Unlink, Mic2, Eye, QrCode,
  Tv, Volume2, FileText, Download, Upload, Plus, Copy, Check, Settings2,
  Film, Layers, HelpCircle, Palette
} from "lucide-react";
import Peer, { MediaConnection, DataConnection } from "peerjs";

import { generateQRCodeSVG } from "@/lib/qrGenerator";
import {
  CONTRAST_THEMES,
  ContrastTheme,
  parseScriptToScenes,
  getScriptStats,
  tokenizeSceneText,
  ScriptScene
} from "@/lib/scriptParser";
import {
  getSupportedMimeType,
  generateSRT,
  generateVTT,
  downloadTextFile,
  RecordedSceneEvent
} from "@/lib/videoRecorder";
import AudioVUMeter from "@/components/AudioVUMeter";
import RemoteController from "@/components/RemoteController";
import FloatingPrompterWindow from "@/components/FloatingPrompter";
import QRModal from "@/components/QRModal";

const SOCIAL_PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: "🌐" },
  { id: "instagram", label: "Instagram", icon: "📸" },
  { id: "x", label: "X", icon: "🐦" },
  { id: "tiktok", label: "TikTok", icon: "🎵" },
  { id: "threads", label: "Threads", icon: "🧵" },
  { id: "youtube", label: "YouTube", icon: "📺" },
];

type RemoteCamera = {
  deviceId: string;
  label: string;
  facingMode?: "user" | "environment";
};

type ConnectionMode = "local" | "host" | "camera" | "controller";

interface SavedScript {
  id: string;
  title: string;
  text: string;
  updatedAt: number;
}

/** Genera un código de 6 caracteres sin caracteres ambiguos */
function generateShortId(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default function TeleprompterProStudio() {
  // Dispositivos y Cámara
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState("");
  const [selectedAudioDevice, setSelectedAudioDevice] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("9:16");

  // Conectividad PeerJS / WebRTC
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("local");
  const [peerId, setPeerId] = useState("");
  const [remotePeerId, setRemotePeerId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("");
  const [remoteCameras, setRemoteCameras] = useState<RemoteCamera[]>([]);
  const [selectedRemoteCamera, setSelectedRemoteCamera] = useState("");
  const [showQRModal, setShowQRModal] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const dataConnectionsRef = useRef<DataConnection[]>([]);

  // Estado sincronizado para el mando a distancia
  const [hostSyncState, setHostSyncState] = useState({
    isPrompting: false,
    isRecording: false,
    scrollSpeed: 2.8,
    currentSceneIndex: 0,
    totalScenes: 1,
    sceneTitle: "ESCENA 1",
    scriptTitle: "Mi Primer Guion",
  });

  // Grabación & Subtítulos
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recordedEvents, setRecordedEvents] = useState<RecordedSceneEvent[]>([]);
  const [lastRecordedSubtitles, setLastRecordedSubtitles] = useState<string | null>(null);
  const recordingStartTimeRef = useRef(0);
  const currentSceneStartTimeRef = useRef(0);

  // Guiones y Escenas
  const defaultInitialScript = `ESCENA 1: INTRODUCCIÓN\n¡Bienvenido a Teleprompter Pro Studio de última generación! [ÉNFASIS]\n\nESCENA 2: CONTROL REMOTO\nPuedes conectar tu smartphone con el código QR para usarlo como mando a distancia o como cámara remota en alta definición.\n\nESCENA 3: DIRECCIÓN INTELIGENTE\nEl sistema soporta pausas automáticas [PAUSA 2s] y acotaciones visuales [MIRAR A CÁMARA] para una locución impecable.`;

  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([]);
  const [currentScriptId, setCurrentScriptId] = useState("default");
  const [scriptTitle, setScriptTitle] = useState("Mi Primer Guion");
  const [scriptText, setScriptText] = useState(defaultInitialScript);
  const [scenes, setScenes] = useState<ScriptScene[]>([]);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  // Parámetros de Lectura del Prompter
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
  const [activeThemeId, setActiveThemeId] = useState<string>("studio-pro");
  const [showFloatingPiP, setShowFloatingPiP] = useState(false);

  // Pausa Automática del Director
  const [activeDirectorPause, setActiveDirectorPause] = useState<{ duration: number; remaining: number } | null>(null);

  // Redes Sociales y Logo
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({
    facebook: "", instagram: "", x: "", tiktok: "", threads: "", youtube: ""
  });
  const [activeSocials, setActiveSocials] = useState<Record<string, boolean>>({});
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [imagePosition, setImagePosition] = useState("top-right");
  const [imageSize, setImageSize] = useState(85);

  // Referencias DOM
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastScrollTime = useRef(0);
  const recognitionRef = useRef<any>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const activeTheme: ContrastTheme = CONTRAST_THEMES[activeThemeId] || CONTRAST_THEMES["studio-pro"];

  // ==========================================
  // PARSEO DE GUIONES Y CARGA DE LOCALSTORAGE
  // ==========================================
  useEffect(() => {
    const parsed = parseScriptToScenes(scriptText);
    setScenes(parsed);
    if (currentSceneIndex >= parsed.length) {
      setCurrentSceneIndex(Math.max(0, parsed.length - 1));
    }
  }, [scriptText, currentSceneIndex]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("teleprompter_pro_scripts");
      if (saved) {
        const list: SavedScript[] = JSON.parse(saved);
        setSavedScripts(list);
      }
    } catch { }
  }, []);

  const saveCurrentScript = () => {
    const newScript: SavedScript = {
      id: currentScriptId === "default" ? Date.now().toString() : currentScriptId,
      title: scriptTitle || "Guion sin título",
      text: scriptText,
      updatedAt: Date.now(),
    };
    const updated = [newScript, ...savedScripts.filter(s => s.id !== newScript.id)];
    setSavedScripts(updated);
    setCurrentScriptId(newScript.id);
    localStorage.setItem("teleprompter_pro_scripts", JSON.stringify(updated));
    alert("✓ Guion guardado correctamente en la biblioteca local.");
  };

  const createNewScript = () => {
    const newId = Date.now().toString();
    const newTitle = `Nuevo Guion ${savedScripts.length + 1}`;
    const newText = `ESCENA 1\nEscribe aquí tu contenido...`;
    const newScript: SavedScript = { id: newId, title: newTitle, text: newText, updatedAt: Date.now() };
    const updated = [newScript, ...savedScripts];
    setSavedScripts(updated);
    setCurrentScriptId(newId);
    setScriptTitle(newTitle);
    setScriptText(newText);
    localStorage.setItem("teleprompter_pro_scripts", JSON.stringify(updated));
  };

  const loadScript = (s: SavedScript) => {
    setCurrentScriptId(s.id);
    setScriptTitle(s.title);
    setScriptText(s.text);
    setCurrentSceneIndex(0);
  };

  const deleteScript = (id: string) => {
    if (!confirm("¿Eliminar este guion?")) return;
    const updated = savedScripts.filter(s => s.id !== id);
    setSavedScripts(updated);
    localStorage.setItem("teleprompter_pro_scripts", JSON.stringify(updated));
    if (currentScriptId === id) {
      setCurrentScriptId("default");
      setScriptTitle("Mi Primer Guion");
      setScriptText(defaultInitialScript);
    }
  };

  const handleImportText = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result as string;
      setScriptText(content);
      setScriptTitle(file.name.replace(/\.[^/.]+$/, ""));
      alert("✓ Guion importado con éxito");
    };
    reader.readAsText(file);
  };

  // ==========================================
  // URL PARAMS / AUTO-CONEXIÓN DESDE QR
  // ==========================================
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get("code") || window.location.hash.replace("#connect=", "").trim();
    const modeParam = params.get("mode") as ConnectionMode;

    if (codeParam) {
      const cleanCode = codeParam.toUpperCase().slice(0, 8);
      setRemotePeerId(cleanCode);
      if (modeParam === "controller" || modeParam === "camera") {
        setConnectionMode(modeParam);
      }
    }
  }, []);

  // ==========================================
  // SINCRONIZACIÓN CON MANDOS REMOTOS
  // ==========================================
  const broadcastHostState = useCallback(() => {
    if (connectionMode !== "host") return;
    const currentScene = scenes[currentSceneIndex];
    const payload = {
      isPrompting,
      isRecording,
      scrollSpeed,
      currentSceneIndex,
      totalScenes: scenes.length,
      sceneTitle: currentScene?.title || `Escena ${currentSceneIndex + 1}`,
      scriptTitle,
    };
    dataConnectionsRef.current.forEach(conn => {
      if (conn.open) {
        conn.send({ type: "host-state-update", payload });
      }
    });
  }, [connectionMode, isPrompting, isRecording, scrollSpeed, currentSceneIndex, scenes, scriptTitle]);

  useEffect(() => {
    broadcastHostState();
  }, [broadcastHostState]);

  // ==========================================
  // WEBRTC / PEERJS P2P MULTI-DISPOSITIVO
  // ==========================================
  const getAvailableCameras = async (): Promise<RemoteCamera[]> => {
    try {
      const temp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      temp.getTracks().forEach(t => t.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === "videoinput");

      const list: RemoteCamera[] = [
        { deviceId: "facing-user", label: "Cámara Frontal", facingMode: "user" },
        { deviceId: "facing-environment", label: "Cámara Trasera", facingMode: "environment" }
      ];

      videoInputs.forEach((cam, i) => {
        const label = cam.label || `Cámara ${i + 1}`;
        if (!list.some(c => c.deviceId === cam.deviceId)) {
          list.push({ deviceId: cam.deviceId, label });
        }
      });
      return list;
    } catch {
      return [
        { deviceId: "facing-user", label: "Cámara Frontal", facingMode: "user" },
        { deviceId: "facing-environment", label: "Cámara Trasera", facingMode: "environment" }
      ];
    }
  };

  const switchToCamera = async (deviceId: string, facingMode?: "user" | "environment") => {
    try {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }

      let videoConstraints: MediaTrackConstraints;
      if (facingMode === "user" || deviceId === "facing-user") {
        videoConstraints = { facingMode: { ideal: "user" }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      } else if (facingMode === "environment" || deviceId === "facing-environment") {
        videoConstraints = { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      } else {
        videoConstraints = { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } };
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      activeStreamRef.current = stream;

      if (callRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const pc = (callRef.current as any).peerConnection as RTCPeerConnection | undefined;
        const sender = pc?.getSenders()?.find(s => s.track?.kind === "video");
        if (sender && videoTrack) await sender.replaceTrack(videoTrack);
      }

      setSelectedRemoteCamera(deviceId);
      setCameraError(null);
    } catch (err) {
      console.error(err);
      setCameraError("No se pudo cambiar a la cámara seleccionada");
    }
  };

  const handleRemoteControlAction = useCallback((action: string, payload?: any) => {
    switch (action) {
      case "toggle-prompting":
        setIsPrompting(p => !p);
        break;
      case "speed-up":
        setScrollSpeed(p => Math.min(8, +(p + 0.5).toFixed(1)));
        break;
      case "speed-down":
        setScrollSpeed(p => Math.max(0.5, +(p - 0.5).toFixed(1)));
        break;
      case "set-speed":
        if (typeof payload === "number") setScrollSpeed(payload);
        break;
      case "prev-scene":
        setCurrentSceneIndex(p => Math.max(0, p - 1));
        break;
      case "next-scene":
        setCurrentSceneIndex(p => Math.min(scenes.length - 1, p + 1));
        break;
      case "restart-scroll":
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        break;
      case "toggle-recording":
        if (!isRecording) {
          startRecordingWithCountdown();
        } else {
          stopRecording();
        }
        break;
      case "toggle-text-mirror-h":
        setTextMirrorH(m => !m);
        break;
      case "toggle-text-mirror-v":
        setTextMirrorV(m => !m);
        break;
    }
  }, [scenes.length, isRecording]);

  useEffect(() => {
    if (connectionMode === "local") {
      peerRef.current?.destroy();
      peerRef.current = null;
      setPeerId("");
      dataConnectionsRef.current = [];
      return;
    }

    const peerOptions = {
      debug: 1 as const,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:global.stun.twilio.com:3478" }
        ]
      }
    };

    const customId = connectionMode === "host" ? generateShortId(6) : undefined;

    const createPeer = (id?: string): Peer => {
      const p = id ? new Peer(id, peerOptions) : new Peer(peerOptions);

      p.on("open", (openId) => {
        setPeerId(openId);
        setConnectionStatus(
          connectionMode === "host"
            ? "Listo. Comparte el código o escanea el QR."
            : "Listo para conectar."
        );
      });

      p.on("error", (err: any) => {
        console.error("Peer error:", err);
        if (err?.type === "unavailable-id" && connectionMode === "host") {
          p.destroy();
          const retry = createPeer(generateShortId(6));
          peerRef.current = retry;
        } else {
          setConnectionStatus("Error de conexión. Reintenta.");
        }
      });

      p.on("connection", (conn) => {
        dataConnectionsRef.current.push(conn);

        conn.on("open", async () => {
          setIsConnected(true);
          if (connectionMode === "camera") {
            const cams = await getAvailableCameras();
            conn.send({ type: "camera-list", cameras: cams });
          }
          if (connectionMode === "host") {
            broadcastHostState();
          }
        });

        conn.on("data", async (data: any) => {
          if (data?.type === "camera-list" && connectionMode === "host") {
            setRemoteCameras(data.cameras || []);
            if (data.cameras?.length > 0) setSelectedRemoteCamera(data.cameras[0].deviceId);
          }
          if (data?.type === "switch-camera" && connectionMode === "camera") {
            await switchToCamera(data.deviceId, data.facingMode);
          }
          if (data?.type === "remote-control-action" && connectionMode === "host") {
            handleRemoteControlAction(data.action, data.payload);
          }
          if (data?.type === "host-state-update" && connectionMode === "controller") {
            setHostSyncState(data.payload);
          }
        });

        conn.on("close", () => {
          dataConnectionsRef.current = dataConnectionsRef.current.filter(c => c !== conn);
          if (dataConnectionsRef.current.length === 0) {
            setIsConnected(false);
          }
        });
      });

      p.on("call", (call) => {
        call.answer();
        call.on("stream", (remoteStream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = remoteStream;
            activeStreamRef.current = remoteStream;
            setCameraReady(true);
            setIsConnected(true);
            setConnectionStatus("Cámara remota conectada en vivo");
          }
        });
        call.on("close", () => {
          setIsConnected(false);
          setConnectionStatus("Cámara desconectada");
          setRemoteCameras([]);
        });
        callRef.current = call;
      });

      return p;
    };

    const peer = createPeer(customId);
    peerRef.current = peer;

    return () => {
      peer.destroy();
      peerRef.current = null;
      dataConnectionsRef.current = [];
    };
  }, [connectionMode, handleRemoteControlAction, broadcastHostState]);

  // Conexión como Cámara
  const connectAsCamera = async () => {
    const hostId = remotePeerId.trim().toUpperCase();
    if (!peerRef.current || !hostId) return;

    try {
      setCameraError(null);
      const conn = peerRef.current.connect(hostId);
      dataConnectionsRef.current = [conn];

      conn.on("open", async () => {
        const cams = await getAvailableCameras();
        conn.send({ type: "camera-list", cameras: cams });
      });

      conn.on("data", async (data: any) => {
        if (data?.type === "switch-camera") {
          await switchToCamera(data.deviceId, data.facingMode);
        }
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true
      });

      if (videoRef.current) videoRef.current.srcObject = stream;
      activeStreamRef.current = stream;

      const call = peerRef.current.call(hostId, stream);
      call.on("stream", () => {
        setIsConnected(true);
        setConnectionStatus("Transmitiendo cámara al Host");
      });
      call.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("Desconectado");
      });

      callRef.current = call;
      setCameraReady(true);
      setSelectedRemoteCamera("facing-environment");
    } catch (err) {
      console.error(err);
      setCameraError("No se pudo conectar. Verifica el código de 6 caracteres.");
    }
  };

  // Conexión como Mando a Distancia
  const connectAsController = async () => {
    const hostId = remotePeerId.trim().toUpperCase();
    if (!peerRef.current || !hostId) return;

    try {
      setCameraError(null);
      const conn = peerRef.current.connect(hostId);
      dataConnectionsRef.current = [conn];

      conn.on("open", () => {
        setIsConnected(true);
        setConnectionStatus("Vinculado como Mando Remoto");
      });

      conn.on("data", (data: any) => {
        if (data?.type === "host-state-update") {
          setHostSyncState(data.payload);
        }
      });

      conn.on("close", () => {
        setIsConnected(false);
        setConnectionStatus("Desconectado del Host");
      });
    } catch (err) {
      console.error(err);
      setCameraError("Error al vincular el mando a distancia.");
    }
  };

  // ==========================================
  // CÁMARA LOCAL Y DISPOSITIVOS
  // ==========================================
  useEffect(() => {
    async function getDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setVideoDevices(devices.filter(d => d.kind === "videoinput"));
        setAudioDevices(devices.filter(d => d.kind === "audioinput"));
      } catch { }
    }
    getDevices();
    navigator.mediaDevices?.addEventListener("devicechange", getDevices);
    return () => navigator.mediaDevices?.removeEventListener("devicechange", getDevices);
  }, []);

  const startLocalCamera = useCallback(async () => {
    if (connectionMode === "host" && isConnected) return;
    if (connectionMode === "controller") return;

    try {
      setCameraError(null);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      const constraints: MediaStreamConstraints = {
        video: selectedVideoDevice
          ? { deviceId: { exact: selectedVideoDevice }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : true,
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) videoRef.current.srcObject = stream;
      activeStreamRef.current = stream;
      setCameraReady(true);

      if ("wakeLock" in navigator) {
        try { await (navigator as any).wakeLock.request("screen"); } catch { }
      }
    } catch {
      setCameraReady(false);
      setCameraError("No se pudo acceder a la cámara o micrófono local");
    }
  }, [selectedVideoDevice, selectedAudioDevice, connectionMode, isConnected]);

  useEffect(() => {
    if (connectionMode === "local") startLocalCamera();
  }, [startLocalCamera, connectionMode]);

  // ==========================================
  // BUCLE DE SCROLL SUAVE DEL TELEPROMPTER
  // ==========================================
  const scrollStep = useCallback((timestamp: number) => {
    if (!isPrompting || !scrollContainerRef.current) return;
    if (!lastScrollTime.current) lastScrollTime.current = timestamp;
    const delta = timestamp - lastScrollTime.current;

    if (delta > 16) {
      const el = scrollContainerRef.current;
      el.scrollTop += scrollSpeed * 0.52;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
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
    if (!isPrompting && scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
      scrollContainerRef.current.scrollTop = 0;
    }
    setIsPrompting(p => !p);
  };

  // ==========================================
  // VOICE TRACKING (RECONOCIMIENTO DE VOZ)
  // ==========================================
  useEffect(() => {
    if (!voiceTracking) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Tu navegador no soporta la API de Speech Recognition");
      setVoiceTracking(false);
      return;
    }
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-ES";
    recognition.onresult = () => {
      if (!isPrompting) setIsPrompting(true);
    };
    recognition.onerror = () => { };
    recognition.start();
    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, [voiceTracking, isPrompting]);

  // ==========================================
  // ATAJOS DE TECLADO GLOBALES
  // ==========================================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePrompting(); }
      if (e.code === "ArrowUp") setScrollSpeed(p => Math.min(8, +(p + 0.5).toFixed(1)));
      if (e.code === "ArrowDown") setScrollSpeed(p => Math.max(0.5, +(p - 0.5).toFixed(1)));
      if (e.code === "ArrowRight") setCurrentSceneIndex(p => Math.min(p + 1, scenes.length - 1));
      if (e.code === "ArrowLeft") setCurrentSceneIndex(p => Math.max(p - 1, 0));
      if (e.code === "KeyR" && scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
      if (e.code === "KeyF") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scenes.length, isPrompting]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // ==========================================
  // GRABACIÓN DE VIDEO Y SUBTÍTULOS (.SRT)
  // ==========================================
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

    if (aspectRatio === "16:9") { canvasEl.width = 1920; canvasEl.height = 1080; }
    else if (aspectRatio === "9:16") { canvasEl.width = 1080; canvasEl.height = 1920; }
    else { canvasEl.width = 1080; canvasEl.height = 1080; }

    let logoImg: HTMLImageElement | null = null;
    if (overlayImage) {
      logoImg = new Image();
      logoImg.src = overlayImage;
    }

    let animId: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      const vW = videoEl.videoWidth || 1920;
      const vH = videoEl.videoHeight || 1080;
      const cW = canvasEl.width;
      const cH = canvasEl.height;
      const vRatio = vW / vH;
      const cRatio = cW / cH;
      let dW = cW, dH = cH, dX = 0, dY = 0;
      if (vRatio > cRatio) { dH = cH; dW = cH * vRatio; dX = (cW - dW) / 2; }
      else { dW = cW; dH = cW / vRatio; dY = (cH - dH) / 2; }

      ctx.save();
      if (mirrorH || mirrorV) {
        ctx.translate(mirrorH ? cW : 0, mirrorV ? cH : 0);
        ctx.scale(mirrorH ? -1 : 1, mirrorV ? -1 : 1);
      }
      ctx.drawImage(videoEl, dX, dY, dW, dH);
      ctx.restore();

      if (logoImg?.complete) {
        const size = imageSize * (cW / 800);
        let x = cW - size - 30, y = 30;
        if (imagePosition.includes("left")) x = 30;
        if (imagePosition.includes("bottom")) y = cH - size - 30;
        ctx.drawImage(logoImg, x, y, size, size);
      }

      const active = SOCIAL_PLATFORMS.filter(p => activeSocials[p.id] && socialInputs[p.id]);
      active.forEach((p, i) => {
        const text = `${p.icon} ${socialInputs[p.id]}`;
        ctx.font = "bold 28px system-ui";
        const w = ctx.measureText(text).width + 36;
        const y = cH - 70 - (active.length - 1 - i) * 50;
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.beginPath();
        ctx.roundRect(36, y, w, 44, 12);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText(text, 54, y + 31);
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const canvasStream = canvasEl.captureStream(30);
    const streamSource = activeStreamRef.current || (videoEl.srcObject as MediaStream);
    streamSource?.getAudioTracks().forEach(t => canvasStream.addTrack(t));

    const codecInfo = getSupportedMimeType();
    chunksRef.current = [];
    
    let recorder: MediaRecorder;
    try {
      recorder = codecInfo.mimeType
        ? new MediaRecorder(canvasStream, { mimeType: codecInfo.mimeType })
        : new MediaRecorder(canvasStream);
    } catch {
      recorder = new MediaRecorder(canvasStream);
    }

    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = e => e.data.size && chunksRef.current.push(e.data);
    
    recorder.onstop = () => {
      cancelAnimationFrame(animId);
      const blob = new Blob(chunksRef.current, { type: codecInfo.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teleprompter-${Date.now()}.${codecInfo.extension}`;
      a.click();

      // Guardar subtítulos generados
      const srt = generateSRT(recordedEvents);
      if (srt) setLastRecordedSubtitles(srt);
    };

    recorder.start(200);
    setIsRecording(true);
    setRecordingTime(0);
    recordingStartTimeRef.current = Date.now();
    currentSceneStartTimeRef.current = 0;
    setRecordedEvents([
      {
        sceneTitle: scenes[currentSceneIndex]?.title || "Escena 1",
        text: scenes[currentSceneIndex]?.rawText || "",
        startTime: 0,
        endTime: 0,
      }
    ]);

    timerRef.current = setInterval(() => {
      setRecordingTime(t => t + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Registrar fin de la última escena
      const finalSec = recordingTime;
      setRecordedEvents(prev => {
        if (!prev.length) return prev;
        const last = { ...prev[prev.length - 1], endTime: finalSec };
        return [...prev.slice(0, -1), last];
      });
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Registrar cambio de escena durante grabación para los subtítulos .SRT
  useEffect(() => {
    if (isRecording) {
      const currentSec = recordingTime;
      setRecordedEvents(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1].endTime = currentSec;
        }
        updated.push({
          sceneTitle: scenes[currentSceneIndex]?.title || `Escena ${currentSceneIndex + 1}`,
          text: scenes[currentSceneIndex]?.rawText || "",
          startTime: currentSec,
          endTime: currentSec + 5,
        });
        return updated;
      });
    }
  }, [currentSceneIndex, isRecording]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // ==========================================
  // RENDER: SI ESTÁ EN MODO CONTROLADOR TÁCTIL
  // ==========================================
  if (connectionMode === "controller") {
    return (
      <RemoteController
        hostId={remotePeerId}
        dataConnection={dataConnectionsRef.current[0] || null}
        isConnected={isConnected}
        onDisconnect={() => setConnectionMode("local")}
        hostState={hostSyncState}
      />
    );
  }

  const scriptStats = getScriptStats(scriptText);
  const currentScene = scenes[currentSceneIndex] || scenes[0];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-6 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col gap-5">

        {/* HEADER PRINCIPAL */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/90 border border-zinc-800/90 p-4 rounded-3xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg sm:text-xl text-white">Teleprompter Pro Studio</h1>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  v4.0 Pro Suite
                </span>
              </div>
              <p className="text-xs text-zinc-400">Mando inalámbrico · Vúmetro en vivo · Document PiP · Subtítulos SRT</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Monitor VU en Vivo */}
            <AudioVUMeter stream={activeStreamRef.current} className="hidden md:flex" />

            {/* Selector de Tema de Alto Contraste */}
            <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-2 py-1">
              <Palette className="w-3.5 h-3.5 text-zinc-400 ml-1" />
              <select
                value={activeThemeId}
                onChange={e => setActiveThemeId(e.target.value)}
                className="bg-transparent text-xs text-zinc-300 py-1 px-1.5 focus:outline-none cursor-pointer"
              >
                {Object.values(CONTRAST_THEMES).map(t => (
                  <option key={t.id} value={t.id} className="bg-zinc-900 text-white">{t.name}</option>
                ))}
              </select>
            </div>

            {/* Botón Prompter Flotante (PiP) */}
            <button
              onClick={() => setShowFloatingPiP(p => !p)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition ${
                showFloatingPiP
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/40"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
              }`}
              title="Abrir ventana flotante siempre visible para Zoom / Meet / OBS"
            >
              <Tv className="w-3.5 h-3.5" /> Flotante
            </button>

            {/* Pantalla Completa */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl border border-zinc-700 transition"
              title="Pantalla completa"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* MODAL QR SI ESTÁ ACTIVO */}
        {showQRModal && peerId && (
          <QRModal code={peerId} onClose={() => setShowQRModal(false)} />
        )}

        {/* VENTANA FLOTANTE (PiP) */}
        {showFloatingPiP && (
          <FloatingPrompterWindow
            text={currentScene?.rawText || scriptText}
            isPrompting={isPrompting}
            onTogglePrompting={togglePrompting}
            scrollSpeed={scrollSpeed}
            onSpeedChange={setScrollSpeed}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            eyeLinePos={eyeLinePos}
            theme={activeTheme}
            textMirrorH={textMirrorH}
            textMirrorV={textMirrorV}
            onClose={() => setShowFloatingPiP(false)}
          />
        )}

        {/* PANEL MULTI-DISPOSITIVO & VINCULACIÓN */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
              <Link2 className="w-4 h-4 text-emerald-400" /> Vinculación Inalámbrica Multi-Dispositivo
            </h3>

            {connectionMode === "host" && peerId && (
              <button
                onClick={() => setShowQRModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold transition"
              >
                <QrCode className="w-4 h-4" /> Ver Código QR para Móvil
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={connectionMode}
              onChange={e => {
                setConnectionMode(e.target.value as any);
                setIsConnected(false);
                setRemoteCameras([]);
                setConnectionStatus("");
                setPeerId("");
              }}
              className="bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2.5 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
            >
              <option value="local">Modo Local (Solo este dispositivo)</option>
              <option value="host">Host Principal (Recibe cámara / mando)</option>
              <option value="camera">Cámara Remota (Transmite video)</option>
              <option value="controller">Mando a Distancia Táctil</option>
            </select>

            {connectionMode !== "local" && (
              <>
                <div className="text-xs bg-zinc-950 px-3.5 py-2 rounded-2xl border border-zinc-700 flex items-center gap-2">
                  <span className="text-zinc-500">
                    {connectionMode === "host" ? "Código:" : "Sesión:"}
                  </span>
                  <span className="font-mono text-emerald-400 text-base tracking-[0.25em] font-bold">
                    {peerId || "......"}
                  </span>
                  {connectionMode === "host" && peerId && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(peerId)}
                      className="text-[10px] text-zinc-400 hover:text-white underline ml-1"
                    >
                      Copiar
                    </button>
                  )}
                </div>

                {connectionMode === "camera" && (
                  <div className="flex items-center gap-2">
                    <input
                      value={remotePeerId}
                      onChange={e =>
                        setRemotePeerId(
                          e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
                        )
                      }
                      placeholder="Código Host (6)"
                      maxLength={8}
                      className="bg-zinc-950 border border-zinc-700 rounded-2xl px-3.5 py-2 text-sm w-36 font-mono tracking-widest uppercase"
                    />
                    <button
                      onClick={connectAsCamera}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-xs font-bold transition shadow-lg shadow-emerald-900/30"
                    >
                      {isConnected ? "Reconectar" : "Conectar"}
                    </button>
                  </div>
                )}

                <span className={`text-xs font-medium ${isConnected ? "text-emerald-400" : "text-amber-400"}`}>
                  {connectionStatus || (isConnected ? "Conectado" : "Desconectado")}
                </span>
              </>
            )}
          </div>

          {/* Selector de Cámaras Remotas para el Host */}
          {connectionMode === "host" && remoteCameras.length > 0 && (
            <div className="pt-3 border-t border-zinc-800">
              <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">
                Cámaras Detectadas en Dispositivo Remoto
              </p>
              <div className="flex flex-wrap gap-2">
                {remoteCameras.map(cam => (
                  <button
                    key={cam.deviceId}
                    onClick={() => {
                      setSelectedRemoteCamera(cam.deviceId);
                      dataConnectionsRef.current.forEach(c => {
                        if (c.open) c.send({ type: "switch-camera", deviceId: cam.deviceId, facingMode: cam.facingMode });
                      });
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xl border transition flex items-center gap-1.5 ${
                      selectedRemoteCamera === cam.deviceId
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
                        : "bg-zinc-950 text-zinc-300 border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <span>{cam.facingMode === "user" ? "🤳 Frontal" : "📷 Trasera"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cameraError && <p className="text-xs text-red-400">{cameraError}</p>}
        </div>

        {/* VISOR PRINCIPAL DEL TELEPROMPTER & CONTROLES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* COLUMNA 1 & 2: PANTALLA Y PROMPTER */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl ${aspectRatio === "9:16" ? "max-w-md mx-auto" : ""}`}>
              {/* Barra superior de la escena */}
              <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono font-bold text-zinc-300">
                    {currentScene?.title || `ESCENA ${currentSceneIndex + 1}`}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({currentSceneIndex + 1}/{scenes.length})
                  </span>
                </div>
                {isRecording && (
                  <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/40 px-2.5 py-0.5 rounded-full text-red-400 font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    REC {formatTime(recordingTime)}
                  </div>
                )}
              </div>

              {/* Contenedor de Video & Teleprompter Superpuesto */}
              <div className={`relative bg-black overflow-hidden ${
                aspectRatio === "16:9" ? "aspect-video" : aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-square"
              }`}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={connectionMode !== "camera"}
                  className={`w-full h-full object-cover ${mirrorH ? "-scale-x-100" : ""} ${mirrorV ? "-scale-y-100" : ""}`}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Logo Superpuesto */}
                {overlayImage && (
                  <img
                    src={overlayImage}
                    alt="Logo"
                    className={`absolute object-contain pointer-events-none z-20 ${
                      imagePosition.includes("top") ? "top-4" : "bottom-4"
                    } ${imagePosition.includes("left") ? "left-4" : "right-4"}`}
                    style={{ width: imageSize, height: imageSize }}
                  />
                )}

                {/* Cuenta Regresiva de Grabación */}
                {countdown !== null && (
                  <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 animate-in fade-in">
                    <span className="text-9xl font-black text-emerald-400 animate-bounce">{countdown}</span>
                  </div>
                )}

                {/* CAPA DE TEXTO DEL PROMPTER */}
                {(isPrompting || isRecording) && (
                  <div className="absolute inset-0 bg-black/55 z-30 flex flex-col backdrop-blur-[2px]">
                    {/* Franja de Resaltado Opcional */}
                    {showHighlightBand && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none transition-all"
                        style={{
                          top: `calc(${eyeLinePos}% - 50px)`,
                          height: "100px",
                          backgroundColor: activeTheme.highlightBandColor,
                          borderTop: `1px solid ${activeTheme.accentColor}40`,
                          borderBottom: `1px solid ${activeTheme.accentColor}40`,
                        }}
                      />
                    )}

                    {/* Línea de Enfoque Visual (Eye-line) */}
                    <div
                      className="absolute left-0 right-0 h-0.5 shadow-lg pointer-events-none"
                      style={{
                        top: `${eyeLinePos}%`,
                        backgroundColor: activeTheme.eyeLineColor,
                        boxShadow: `0 0 12px ${activeTheme.eyeLineColor}`,
                      }}
                    />

                    {/* Contenedor con Scroll de Texto */}
                    <div
                      ref={scrollContainerRef}
                      className="flex-1 overflow-y-auto no-scrollbar py-36 px-4 flex justify-center"
                      style={{ maxWidth: contentWidth, margin: "0 auto" }}
                    >
                      <div
                        className="font-bold text-center leading-relaxed drop-shadow-xl whitespace-pre-line space-y-3"
                        style={{
                          fontSize: `${fontSize}px`,
                          color: activeTheme.textColor,
                          transform: `scaleX(${textMirrorH ? -1 : 1}) scaleY(${textMirrorV ? -1 : 1})`,
                        }}
                      >
                        {currentScene?.tokens.map((token, idx) => {
                          if (token.type === "pause") {
                            return (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/50 px-2 py-0.5 rounded-full mx-1 align-middle"
                              >
                                ⏳ {token.content}
                              </span>
                            );
                          }
                          if (token.type === "cue-emphasis") {
                            return (
                              <span key={idx} className="bg-yellow-500/20 text-yellow-300 px-1 rounded font-black">
                                {token.content}
                              </span>
                            );
                          }
                          if (token.type === "cue-camera") {
                            return (
                              <span key={idx} className="inline-flex text-xs font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full mx-1 align-middle">
                                👁️ {token.content}
                              </span>
                            );
                          }
                          return <span key={idx}>{token.content}</span>;
                        })}
                      </div>
                    </div>

                    {/* Controles flotantes en visor */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-zinc-700/80 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-2xl backdrop-blur-md">
                      <button
                        onClick={togglePrompting}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition shadow"
                      >
                        {isPrompting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                      </button>
                      <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={scrollSpeed}
                        onChange={e => setScrollSpeed(+e.target.value)}
                        className="w-24 accent-emerald-400 h-1.5 bg-zinc-800 rounded cursor-pointer"
                      />
                      <span className="text-xs font-mono font-bold text-emerald-400">{scrollSpeed}x</span>
                    </div>
                  </div>
                )}
              </div>

              {/* BARRA DE HERRAMIENTAS INFERIOR DEL VISOR */}
              <div className="p-3.5 bg-zinc-950 border-t border-zinc-800 flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentSceneIndex(p => Math.max(0, p - 1))}
                    disabled={currentSceneIndex === 0}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 rounded-xl border border-zinc-800 transition"
                    title="Escena anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentSceneIndex(p => Math.min(scenes.length - 1, p + 1))}
                    disabled={currentSceneIndex === scenes.length - 1}
                    className="p-2.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 rounded-xl border border-zinc-800 transition"
                    title="Escena siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePrompting}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      isPrompting
                        ? "bg-amber-600/20 text-amber-400 border-amber-600/40"
                        : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white"
                    }`}
                  >
                    {isPrompting ? "Pausar" : "Prompter"}
                  </button>
                </div>

                {/* BOTÓN PRINCIPAL DE GRABACIÓN */}
                {!isRecording ? (
                  <button
                    onClick={startRecordingWithCountdown}
                    disabled={!cameraReady}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-red-900/30 disabled:opacity-40 transition active:scale-95"
                  >
                    🔴 Iniciar Grabación
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="px-6 py-2.5 bg-white hover:bg-zinc-200 text-black rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition active:scale-95 animate-pulse"
                  >
                    ⏹ Detener
                  </button>
                )}

                {/* BOTONES DE ESPEJO */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMirrorH(!mirrorH)}
                    className={`p-2.5 rounded-xl border transition ${
                      mirrorH ? "text-emerald-400 border-emerald-600/40 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                    }`}
                    title="Espejo Cámara H"
                  >
                    <FlipHorizontal className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMirrorV(!mirrorV)}
                    className={`p-2.5 rounded-xl border transition ${
                      mirrorV ? "text-emerald-400 border-emerald-600/40 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900"
                    }`}
                    title="Espejo Cámara V"
                  >
                    <FlipVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* AVISO DE SUBTÍTULOS LISTOS */}
            {lastRecordedSubtitles && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300 font-medium">
                  <FileText className="w-4 h-4" />
                  <span>Subtítulos sincronizados (.SRT) generados con la última toma.</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTextFile(lastRecordedSubtitles, `subtitles-${Date.now()}.srt`)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
                  >
                    Descargar .SRT
                  </button>
                  <button
                    onClick={() => downloadTextFile(generateVTT(recordedEvents), `subtitles-${Date.now()}.vtt`)}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs transition"
                  >
                    Descargar .VTT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* COLUMNA 3: PANEL LATERAL DE CONFIGURACIÓN */}
          <div className="space-y-4">
            {/* AJUSTES AVANZADOS DE PROMPTER */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" /> Funciones Inteligentes
              </h3>

              <label className="flex items-center justify-between text-xs hover:text-white cursor-pointer">
                <span className="flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-zinc-400" /> Voice Tracking (Voz a Scroll)
                </span>
                <input
                  type="checkbox"
                  checked={voiceTracking}
                  onChange={e => setVoiceTracking(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs hover:text-white cursor-pointer">
                <span className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-zinc-400" /> Franja de Enfoque (Highlight)
                </span>
                <input
                  type="checkbox"
                  checked={showHighlightBand}
                  onChange={e => setShowHighlightBand(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
              </label>
            </div>

            {/* CONTROLES DE TIPOGRAFÍA Y FORMATO */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-4">
              <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-emerald-400" /> Ajustes de Lectura
              </h3>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Tamaño de Letra</span>
                  <span className="font-mono font-bold text-emerald-400">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="70"
                  value={fontSize}
                  onChange={e => setFontSize(+e.target.value)}
                  className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Ancho de Lectura</span>
                  <span className="font-mono font-bold text-emerald-400">{contentWidth}px</span>
                </div>
                <input
                  type="range"
                  min="360"
                  max="900"
                  step="20"
                  value={contentWidth}
                  onChange={e => setContentWidth(+e.target.value)}
                  className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-zinc-400 mb-1">
                  <span>Posición Línea Ocular</span>
                  <span className="font-mono font-bold text-emerald-400">{eyeLinePos}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="70"
                  value={eyeLinePos}
                  onChange={e => setEyeLinePos(+e.target.value)}
                  className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded cursor-pointer"
                />
              </div>

              {/* Espejo para Cristales de Teleprompter */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setTextMirrorH(!textMirrorH)}
                  className={`py-2 text-xs rounded-xl border transition ${
                    textMirrorH ? "text-emerald-400 border-emerald-600/40 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  Texto Espejo H
                </button>
                <button
                  onClick={() => setTextMirrorV(!textMirrorV)}
                  className={`py-2 text-xs rounded-xl border transition ${
                    textMirrorV ? "text-emerald-400 border-emerald-600/40 bg-emerald-500/10" : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  Texto Espejo V
                </button>
              </div>
            </div>

            {/* FORMATO / RELACIÓN DE ASPECTO */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5">
              <h3 className="text-xs font-mono text-zinc-400 uppercase mb-3 flex items-center gap-2">
                <Film className="w-4 h-4 text-emerald-400" /> Formato de Video
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {(["16:9", "9:16", "1:1"] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setAspectRatio(r)}
                    className={`py-2.5 text-xs font-bold rounded-2xl border transition ${
                      aspectRatio === r
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40 shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* EDITOR DE GUIONES Y BIBLIOTECA */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editor de Guion y Escenas</h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={scriptTitle}
                onChange={e => setScriptTitle(e.target.value)}
                placeholder="Título del Guion"
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs w-48 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={saveCurrentScript}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
              >
                <Save className="w-3.5 h-3.5" /> Guardar
              </button>
              <button
                onClick={createNewScript}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo
              </button>

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs transition cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Importar .TXT
                <input type="file" accept=".txt,.md" onChange={handleImportText} className="hidden" />
              </label>

              <button
                onClick={() => downloadTextFile(scriptText, `${scriptTitle || "guion"}.txt`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs transition"
              >
                <Download className="w-3.5 h-3.5" /> Exportar .TXT
              </button>
            </div>
          </div>

          {/* Área de Texto */}
          <textarea
            value={scriptText}
            onChange={e => setScriptText(e.target.value)}
            rows={7}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-2xl p-4 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans leading-relaxed resize-y"
            placeholder="Escribe tu guion aquí. Separa con dos saltos de línea para crear escenas..."
          />

          {/* Barra de Estadísticas y Directivas */}
          <div className="flex flex-wrap justify-between items-center text-xs text-zinc-400 gap-3 pt-1 border-t border-zinc-800">
            <div className="flex gap-4 font-mono">
              <span>Palabras: <b className="text-emerald-400">{scriptStats.words}</b></span>
              <span>Tiempo Estimado: <b className="text-emerald-400">~{scriptStats.minutes} min</b></span>
              <span>Escenas: <b className="text-emerald-400">{scriptStats.totalScenes}</b></span>
            </div>

            <div className="text-[11px] text-zinc-500">
              💡 <b>Tip:</b> Usa etiquetas como <code className="bg-zinc-950 px-1 py-0.5 rounded text-emerald-400">[PAUSA 2s]</code> o <code className="bg-zinc-950 px-1 py-0.5 rounded text-yellow-400">[ÉNFASIS]</code> para acotaciones automáticas.
            </div>
          </div>

          {/* BIBLIOTECA DE GUIONES GUARDADOS */}
          {savedScripts.length > 0 && (
            <div className="pt-3 border-t border-zinc-800 space-y-2">
              <h4 className="text-[11px] font-mono text-zinc-500 uppercase">Biblioteca de Guiones Guardados</h4>
              <div className="flex flex-wrap gap-2">
                {savedScripts.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition ${
                      currentScriptId === s.id
                        ? "bg-emerald-600/20 text-emerald-300 border-emerald-600/50 font-bold"
                        : "bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <button onClick={() => loadScript(s)} className="truncate max-w-[150px]">
                      {s.title}
                    </button>
                    <button
                      onClick={() => deleteScript(s.id)}
                      className="text-zinc-500 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* OVERLAYS: REDES SOCIALES Y LOGO */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
            <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
              🌐 Rótulos de Redes Sociales (Lower Thirds)
            </h3>
            {SOCIAL_PLATFORMS.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!activeSocials[p.id]}
                  onChange={e => setActiveSocials(prev => ({ ...prev, [p.id]: e.target.checked }))}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-xs w-24 flex items-center gap-1.5">{p.icon} {p.label}</span>
                <input
                  value={socialInputs[p.id]}
                  onChange={e => setSocialInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                  placeholder="@tuusuario"
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 space-y-3">
            <h3 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-2">
              🖼️ Logo de Marca en Pantalla
            </h3>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setOverlayImage(reader.result as string);
                  reader.readAsDataURL(file);
                }
              }}
              className="text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
            />
            {overlayImage && (
              <div className="space-y-3 pt-2">
                <select
                  value={imagePosition}
                  onChange={e => setImagePosition(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-2 text-xs text-white"
                >
                  <option value="top-right">Arriba Derecha</option>
                  <option value="top-left">Arriba Izquierda</option>
                  <option value="bottom-right">Abajo Derecha</option>
                  <option value="bottom-left">Abajo Izquierda</option>
                </select>
                <div>
                  <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
                    <span>Tamaño del Logo</span>
                    <span>{imageSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="220"
                    value={imageSize}
                    onChange={e => setImageSize(+e.target.value)}
                    className="w-full accent-emerald-400 h-1.5 bg-zinc-800 rounded"
                  />
                </div>
                <button
                  onClick={() => setOverlayImage(null)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Quitar Logo
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}