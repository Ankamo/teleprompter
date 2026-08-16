/**
 * Motor de análisis de guiones, acotaciones del director, temas de contraste y métricas de lectura.
 */

export interface ScriptScene {
  id: number;
  title: string;
  rawText: string;
  tokens: ScriptToken[];
  estimatedSeconds: number;
}

export type ScriptTokenType = "text" | "pause" | "cue-emphasis" | "cue-camera" | "cue-smile" | "cue-tone" | "cue-generic";

export interface ScriptToken {
  type: ScriptTokenType;
  content: string;
  durationSeconds?: number;
}

export interface ContrastTheme {
  id: string;
  name: string;
  bgClass: string;
  textColor: string;
  accentColor: string;
  highlightBandColor: string;
  eyeLineColor: string;
  cardBg: string;
}

export const CONTRAST_THEMES: Record<string, ContrastTheme> = {
  "studio-pro": {
    id: "studio-pro",
    name: "Estudio Pro (Blanco / Esmeralda)",
    bgClass: "bg-black",
    textColor: "#ffffff",
    accentColor: "#10b981",
    highlightBandColor: "rgba(16, 185, 129, 0.18)",
    eyeLineColor: "#10b981",
    cardBg: "rgba(24, 24, 27, 0.9)",
  },
  "neon-yellow": {
    id: "neon-yellow",
    name: "Neón Broadcast (Amarillo / Negro)",
    bgClass: "bg-black",
    textColor: "#facc15", // Yellow-400
    accentColor: "#eab308",
    highlightBandColor: "rgba(250, 204, 21, 0.22)",
    eyeLineColor: "#facc15",
    cardBg: "rgba(15, 15, 15, 0.95)",
  },
  "cyber-cyan": {
    id: "cyber-cyan",
    name: "Ciber Cian (Cian / OLED)",
    bgClass: "bg-black",
    textColor: "#38bdf8", // Sky-400
    accentColor: "#06b6d4",
    highlightBandColor: "rgba(56, 189, 248, 0.2)",
    eyeLineColor: "#38bdf8",
    cardBg: "rgba(10, 15, 25, 0.95)",
  },
  "warm-amber": {
    id: "warm-amber",
    name: "Ámbar Cálido (Anti-fatiga visual)",
    bgClass: "bg-stone-950",
    textColor: "#fbbf24", // Amber-400
    accentColor: "#f59e0b",
    highlightBandColor: "rgba(245, 158, 11, 0.2)",
    eyeLineColor: "#f59e0b",
    cardBg: "rgba(28, 25, 23, 0.95)",
  },
};

/**
 * Tokeniza un bloque de texto reconociendo acotaciones [PAUSA Xs], [ÉNFASIS], etc.
 */
export function tokenizeSceneText(text: string): ScriptToken[] {
  const tokens: ScriptToken[] = [];
  const regex = /(\[(?:PAUSA|PAUSE)(?:\s*(\d+(?:\.\d+)?)\s*s?)?\]|\[(?:ÉNFASIS|ENFASIS|EMPHASIS)\]|\[(?:MIRAR A CÁMARA|MIRAR A CAMARA|LOOK AT CAMERA)\]|\[(?:SONREÍR|SONREIR|SMILE)\]|\[(?:CAMBIO DE TONO|TONE CHANGE)\]|\[[A-ZÁÉÍÓÚÑ\s]{3,30}\])/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const normalText = text.substring(lastIndex, match.index);
      if (normalText) {
        tokens.push({ type: "text", content: normalText });
      }
    }

    const fullTag = match[0];
    const upper = fullTag.toUpperCase();

    if (upper.startsWith("[PAUSA") || upper.startsWith("[PAUSE")) {
      const secMatch = match[2] ? parseFloat(match[2]) : 2;
      tokens.push({
        type: "pause",
        content: fullTag,
        durationSeconds: isNaN(secMatch) ? 2 : secMatch,
      });
    } else if (upper.includes("ENFASIS") || upper.includes("ÉNFASIS") || upper.includes("EMPHASIS")) {
      tokens.push({ type: "cue-emphasis", content: fullTag });
    } else if (upper.includes("CAMARA") || upper.includes("CÁMARA") || upper.includes("CAMERA")) {
      tokens.push({ type: "cue-camera", content: fullTag });
    } else if (upper.includes("SONRE") || upper.includes("SMILE")) {
      tokens.push({ type: "cue-smile", content: fullTag });
    } else if (upper.includes("TONO") || upper.includes("TONE")) {
      tokens.push({ type: "cue-tone", content: fullTag });
    } else {
      tokens.push({ type: "cue-generic", content: fullTag });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.substring(lastIndex) });
  }

  return tokens.length ? tokens : [{ type: "text", content: text }];
}

/**
 * Parsea el texto completo del guion y lo divide en escenas estructuradas
 */
export function parseScriptToScenes(fullText: string): ScriptScene[] {
  const blocks = fullText.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  
  if (blocks.length === 0) {
    return [
      {
        id: 1,
        title: "ESCENA 1",
        rawText: fullText || "Escribe tu guion aquí...",
        tokens: tokenizeSceneText(fullText || "Escribe tu guion aquí..."),
        estimatedSeconds: Math.ceil((fullText?.split(/\s+/).filter(Boolean).length || 1) / 2.3),
      },
    ];
  }

  return blocks.map((block, index) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || `ESCENA ${index + 1}`;
    const hasSceneTitle = /^ESCENA\s*\d*|^SCENE\s*\d*/i.test(firstLine);
    
    const title = hasSceneTitle ? firstLine.toUpperCase() : `ESCENA ${index + 1}`;
    const rawText = hasSceneTitle ? lines.slice(1).join("\n") || firstLine : lines.join("\n");
    const words = rawText.split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Math.max(3, Math.ceil(words / 2.33)); // ~140 palabras por minuto

    return {
      id: index + 1,
      title,
      rawText,
      tokens: tokenizeSceneText(rawText),
      estimatedSeconds,
    };
  });
}

/**
 * Genera estadísticas globales del guion
 */
export function getScriptStats(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  const chars = text.length;
  const minutes = (words / 140).toFixed(1);
  const scenes = parseScriptToScenes(text);
  
  return {
    words,
    chars,
    minutes,
    totalScenes: scenes.length,
  };
}
