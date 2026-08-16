/**
 * Generador de Código QR en SVG puro y ligero (Sin dependencias externas)
 * Implementa codificación QR estándar (Modo Byte / Alfanumérico) con corrección de errores.
 */

// Tablas de corrección de errores y polinomios de Galois Field GF(256)
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], GF256_EXP[i]);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLength);
  const res = new Uint8Array(data.length + ecLength);
  res.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// Capacidades de Versión 1 a 6 con Error Correction Nivel L/M
interface QRVersionSpec {
  version: number;
  size: number;
  totalDataBytes: number;
  ecBytes: number;
  dataCapacity: number;
}

const QR_SPECS: QRVersionSpec[] = [
  { version: 1, size: 21, totalDataBytes: 26, ecBytes: 7, dataCapacity: 19 },
  { version: 2, size: 25, totalDataBytes: 44, ecBytes: 10, dataCapacity: 34 },
  { version: 3, size: 29, totalDataBytes: 70, ecBytes: 15, dataCapacity: 55 },
  { version: 4, size: 33, totalDataBytes: 100, ecBytes: 20, dataCapacity: 80 },
  { version: 5, size: 37, totalDataBytes: 134, ecBytes: 26, dataCapacity: 108 },
  { version: 6, size: 41, totalDataBytes: 172, ecBytes: 36, dataCapacity: 136 },
];

function selectVersion(dataLen: number): QRVersionSpec {
  for (const spec of QR_SPECS) {
    if (dataLen + 3 <= spec.dataCapacity) {
      return spec;
    }
  }
  return QR_SPECS[QR_SPECS.length - 1];
}

class BitBuffer {
  private buffer: number[] = [];
  private length = 0;

  put(num: number, length: number) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }

  putBit(bit: boolean) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) {
      this.buffer.push(0);
    }
    if (bit) {
      this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    }
    this.length++;
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  getLength(): number {
    return this.length;
  }
}

export function generateQRCodeMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const utf8Data = encoder.encode(text);
  const spec = selectVersion(utf8Data.length);
  const size = spec.size;

  // 1. Bit Stream (Modo Byte: 0100)
  const bb = new BitBuffer();
  bb.put(0b0100, 4); // Byte mode indicator
  bb.put(utf8Data.length, 8); // Character count indicator (8 bits for v1-9)
  for (let i = 0; i < utf8Data.length; i++) {
    bb.put(utf8Data[i], 8);
  }

  // Terminator
  const totalBits = spec.dataCapacity * 8;
  const rem = totalBits - bb.getLength();
  if (rem > 0) {
    bb.put(0, Math.min(4, rem));
  }
  while (bb.getLength() % 8 !== 0) {
    bb.putBit(false);
  }
  // Padding bytes
  let padToggle = false;
  while (bb.getLength() < totalBits) {
    bb.put(padToggle ? 0x11 : 0xec, 8);
    padToggle = !padToggle;
  }

  const dataBytes = bb.getBytes();
  const ecBytes = rsEncode(dataBytes.slice(0, spec.dataCapacity), spec.ecBytes);

  const fullData = new Uint8Array(spec.totalDataBytes);
  fullData.set(dataBytes.slice(0, spec.dataCapacity), 0);
  fullData.set(ecBytes, spec.dataCapacity);

  // 2. Matriz de Módulos y Máscara de Ocupación
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  // Finder Patterns (Patrones de posición en esquinas)
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          if (r === -1 || r === 7 || c === -1 || c === 7) {
            matrix[nr][nc] = false;
          } else if (r === 0 || r === 6 || c === 0 || c === 6) {
            matrix[nr][nc] = true;
          } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment pattern for version >= 2
  if (spec.version >= 2) {
    const alignPos = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const nr = alignPos + r;
        const nc = alignPos + c;
        if (matrix[nr][nc] === null) {
          matrix[nr][nc] =
            Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        }
      }
    }
  }

  // Timing patterns (Líneas de sincronización)
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8][8] = true;

  // Format info placeholder (Mask 000, EC Level L = 01 -> Format bits = 0x77c4)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  let bitIdx = 0;
  // Top-left
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) matrix[8][i] = formatBits[bitIdx++] === 1;
  }
  for (let i = 7; i >= 0; i--) {
    if (i !== 6) matrix[i][8] = formatBits[bitIdx++] === 1;
  }
  // Bottom-left & Top-right
  bitIdx = 0;
  for (let i = size - 1; i >= size - 7; i--) {
    matrix[8][i] = formatBits[bitIdx++] === 1;
  }
  for (let i = size - 8; i < size; i++) {
    matrix[i][8] = formatBits[bitIdx++] === 1;
  }

  // Colocar datos con Mask 0 ((row + col) % 2 === 0)
  let byteIndex = 0;
  let bitPos = 7;
  let upward = true;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Saltarse la columna de sincronización
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (const c of [col, col - 1]) {
        if (matrix[row][c] === null) {
          let bit = false;
          if (byteIndex < fullData.length) {
            bit = ((fullData[byteIndex] >>> bitPos) & 1) === 1;
            bitPos--;
            if (bitPos < 0) {
              bitPos = 7;
              byteIndex++;
            }
          }
          // Aplicar máscara patrón 0: (row + col) % 2 === 0
          const mask = (row + c) % 2 === 0;
          matrix[row][c] = mask ? !bit : bit;
        }
      }
    }
    upward = !upward;
  }

  return matrix.map((row) => row.map((cell) => cell ?? false));
}

/**
 * Genera un SVG en cadena para renderizar en cualquier elemento sin librerías externas
 */
export function generateQRCodeSVG(text: string, fgColor = "#10b981", bgColor = "transparent", margin = 2): string {
  try {
    const matrix = generateQRCodeMatrix(text);
    const size = matrix.length;
    const viewBoxSize = size + margin * 2;

    let paths = "";
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          paths += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" shape-rendering="crispEdges">
      ${bgColor !== "transparent" ? `<rect width="100%" height="100%" fill="${bgColor}"/>` : ""}
      <path d="${paths}" fill="${fgColor}"/>
    </svg>`;
  } catch (err) {
    console.error("Error generating QR:", err);
    return `<svg viewBox="0 0 100 100"><text x="10" y="50" fill="#fff" font-size="10">QR Error</text></svg>`;
  }
}
