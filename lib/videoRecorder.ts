/**
 * Utilidades de grabación de video multi-códec y generador de subtítulos .SRT / .VTT
 */

export interface RecordedSceneEvent {
  sceneTitle: string;
  text: string;
  startTime: number; // en segundos desde el inicio de la grabación
  endTime: number;   // en segundos
}

/**
 * Encuentra el mejor formato y códec de video soportado por el navegador
 */
export function getSupportedMimeType(): { mimeType: string; extension: string } {
  if (typeof MediaRecorder === "undefined") {
    return { mimeType: "video/webm", extension: "webm" };
  }

  const candidateTypes = [
    // WebM con VP9/VP8 (Chrome, Edge, Firefox, Android)
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=h264,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
    
    // MP4 con AVC/H.264 (Safari, macOS, iOS)
    { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
  ];

  for (const item of candidateTypes) {
    try {
      if (MediaRecorder.isTypeSupported(item.mimeType)) {
        return item;
      }
    } catch {
      // Ignorar excepciones en navegadores con implementaciones parciales
    }
  }

  return { mimeType: "", extension: "webm" };
}

/**
 * Formatea segundos a formato de subtítulos SRT: HH:MM:SS,mmm
 */
function formatSRTTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
}

/**
 * Genera el archivo .SRT a partir del timeline de escenas grabadas
 */
export function generateSRT(events: RecordedSceneEvent[]): string {
  if (!events.length) return "";

  return events
    .map((ev, index) => {
      const cleanText = ev.text.replace(/\[.*?\]/g, "").trim();
      const start = formatSRTTime(ev.startTime);
      const end = formatSRTTime(Math.max(ev.startTime + 1, ev.endTime));

      return `${index + 1}\n${start} --> ${end}\n${cleanText}\n`;
    })
    .join("\n");
}

/**
 * Genera el archivo .VTT (Web Video Text Tracks)
 */
export function generateVTT(events: RecordedSceneEvent[]): string {
  const srtBody = generateSRT(events);
  return `WEBVTT - Teleprompter Pro Studio Subtitles\n\n${srtBody.replace(/,/g, ".")}`;
}

/**
 * Descarga cualquier string como archivo en el navegador
 */
export function downloadTextFile(content: string, filename: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
