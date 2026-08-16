/**
 * Motor de Transmisión en Tiempo Real para Facebook Live
 * Captura el canvas del teleprompter con audio, mide bitrates y gestiona el flujo de emisión.
 */

export interface LiveStreamConfig {
  serverUrl: string;
  streamKey: string;
  resolution: string;
  bitrate: number;
}

export interface LiveStreamStats {
  isStreaming: boolean;
  durationSeconds: number;
  currentBitrateKbps: number;
  chunksSent: number;
}

export class FacebookLiveStreamer {
  private mediaRecorder: MediaRecorder | null = null;
  private socket: WebSocket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private startTime = 0;
  private totalBytesSent = 0;
  private lastByteCheckTime = 0;
  private lastBytesCount = 0;
  private chunksCount = 0;
  private currentBitrate = 0;
  private onStatsCallback?: (stats: LiveStreamStats) => void;

  constructor(onStats?: (stats: LiveStreamStats) => void) {
    this.onStatsCallback = onStats;
  }

  public start(
    stream: MediaStream,
    config: LiveStreamConfig,
    relayWsUrl = "ws://localhost:8080"
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        this.stop();

        this.startTime = Date.now();
        this.lastByteCheckTime = Date.now();
        this.totalBytesSent = 0;
        this.lastBytesCount = 0;
        this.chunksCount = 0;
        this.currentBitrate = config.bitrate;

        // Intentar conectar con el servidor relay WebSocket si está disponible
        try {
          const ws = new WebSocket(relayWsUrl);
          this.socket = ws;

          ws.onopen = () => {
            console.log("Conectado al bridge de Facebook Live RTMPS");
            ws.send(
              JSON.stringify({
                type: "start-stream",
                rtmpUrl: `${config.serverUrl.replace(/\/$/, "")}/${config.streamKey}`,
                bitrate: config.bitrate,
              })
            );
          };

          ws.onerror = (err) => {
            console.warn("Relay local no disponible, operando en modo simulación/directo:", err);
          };
        } catch (e) {
          console.warn("WebSocket relay no disponible:", e);
        }

        // Configurar MediaRecorder para generar fragmentos continuos
        const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=h264,opus")
          ? "video/webm;codecs=h264,opus"
          : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: config.bitrate * 1000,
        });

        this.mediaRecorder = recorder;

        recorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 0) {
            this.chunksCount++;
            this.totalBytesSent += e.data.size;

            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              const buffer = await e.data.arrayBuffer();
              this.socket.send(buffer);
            }
          }
        };

        recorder.start(1000); // Enviar fragmentos cada 1 segundo

        // Cronómetro de métricas
        this.timer = setInterval(() => {
          const now = Date.now();
          const duration = Math.floor((now - this.startTime) / 1000);
          const timeDiff = (now - this.lastByteCheckTime) / 1000;

          if (timeDiff >= 1) {
            const bytesInPeriod = this.totalBytesSent - this.lastBytesCount;
            const calculatedKbps = Math.round((bytesInPeriod * 8) / (timeDiff * 1000));
            this.currentBitrate = calculatedKbps > 0 ? calculatedKbps : config.bitrate;
            this.lastBytesCount = this.totalBytesSent;
            this.lastByteCheckTime = now;
          }

          if (this.onStatsCallback) {
            this.onStatsCallback({
              isStreaming: true,
              durationSeconds: duration,
              currentBitrateKbps: this.currentBitrate,
              chunksSent: this.chunksCount,
            });
          }
        }, 1000);

        resolve(true);
      } catch (err) {
        console.error("Error al iniciar emisión:", err);
        resolve(false);
      }
    });
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch { }
      this.mediaRecorder = null;
    }

    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "stop-stream" }));
        this.socket.close();
      }
      this.socket = null;
    }

    if (this.onStatsCallback) {
      this.onStatsCallback({
        isStreaming: false,
        durationSeconds: 0,
        currentBitrateKbps: 0,
        chunksSent: 0,
      });
    }
  }
}
