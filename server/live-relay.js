/**
 * Servidor Bridge / Relay local WebSocket a Facebook Live RTMPS
 * Recibe el flujo WebM/H264 del navegador vía WebSocket y lo retransmite al endpoint RTMPS de Facebook.
 *
 * Para ejecutar:
 * node server/live-relay.js
 */

const { spawn } = require("child_process");
const http = require("http");

// Si el usuario tiene ws instalado lo usa, o crea un servidor HTTP/WebSocket básico
let WebSocketServer;
try {
  WebSocketServer = require("ws").Server;
} catch {
  console.log("Nota: Ejecuta 'npm install ws' para activar el puente WebSocket local a RTMP.");
}

const PORT = process.env.PORT || 8080;

if (WebSocketServer) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "Facebook Live RTMPS Relay" }));
  });

  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    console.log("-> Navegador conectado al Relay de Facebook Live");
    let ffmpegProcess = null;
    let rtmpDestination = null;

    ws.on("message", (message) => {
      // Si es un mensaje de control JSON
      if (typeof message === "string" || (message instanceof Buffer && message[0] === 123)) {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === "start-stream" && data.rtmpUrl) {
            rtmpDestination = data.rtmpUrl;
            console.log(`-> Iniciando puente RTMP hacia: ${rtmpDestination.slice(0, 35)}...`);

            // Argumentos de FFmpeg optimizados para Facebook Live (H.264 + AAC + Keyframe 2s)
            const ffmpegArgs = [
              "-i", "-", // Entrada desde stdin (buffer de video del navegador)
              "-c:v", "libx264",
              "-preset", "veryfast",
              "-tune", "zerolatency",
              "-b:v", `${data.bitrate || 3000}k`,
              "-maxrate", `${data.bitrate || 3000}k`,
              "-bufsize", `${(data.bitrate || 3000) * 2}k`,
              "-pix_fmt", "yuv420p",
              "-g", "60", // Keyframe cada 2 segundos a 30fps
              "-c:a", "aac",
              "-b:a", "128k",
              "-ar", "44100",
              "-f", "flv",
              rtmpDestination,
            ];

            try {
              ffmpegProcess = spawn("ffmpeg", ffmpegArgs);

              ffmpegProcess.stderr.on("data", (data) => {
                console.log(`[FFmpeg] ${data.toString()}`);
              });

              ffmpegProcess.on("close", (code) => {
                console.log(`FFmpeg finalizó con código: ${code}`);
                ffmpegProcess = null;
              });
            } catch (err) {
              console.error("Error al iniciar FFmpeg (¿está instalado FFmpeg en el sistema?):", err.message);
            }
          } else if (data.type === "stop-stream") {
            if (ffmpegProcess) {
              ffmpegProcess.stdin.end();
              ffmpegProcess.kill("SIGINT");
              ffmpegProcess = null;
            }
          }
        } catch { }
        return;
      }

      // Si son fragmentos binarios de video
      if (ffmpegProcess && ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
        ffmpegProcess.stdin.write(message);
      }
    });

    ws.on("close", () => {
      console.log("-> Navegador desconectado");
      if (ffmpegProcess) {
        ffmpegProcess.stdin.end();
        ffmpegProcess.kill("SIGINT");
        ffmpegProcess = null;
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 Facebook Live Relay Server escuchando en http://localhost:${PORT} y ws://localhost:${PORT}`);
  });
} else {
  console.log(`ℹ️ Servidor de retransmisión preparado en server/live-relay.js`);
}
