/**
 * Rasterize a QR module matrix (boolean[][], dark = true) to a grayscale PNG.
 *
 * Pure Node (Buffer + node:zlib), no third-party dependency - it reuses the
 * repo's dependency-free createQrMatrix output. Used server-side to embed/attach
 * the activation QR in the delivery email (email clients can't run JS to draw a
 * canvas). The customer page download uses a client canvas instead.
 */

import { deflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

export type QrPngOptions = {
  /** Pixels per QR module. */
  scale?: number;
  /** Quiet-zone width in modules (QR spec recommends 4). */
  quietZone?: number;
};

export function qrMatrixToPngBuffer(matrix: boolean[][], options: QrPngOptions = {}): Buffer {
  const scale = Math.max(1, Math.floor(options.scale ?? 8));
  const quiet = Math.max(0, Math.floor(options.quietZone ?? 4));

  const modules = matrix.length;
  if (modules === 0) {
    throw new Error("qrMatrixToPngBuffer: empty matrix");
  }
  const dimModules = modules + quiet * 2;
  const size = dimModules * scale;

  // Grayscale (color type 0), 8-bit: 1 byte per pixel, white=255 / black=0.
  // Each scanline is prefixed with a filter byte (0 = None).
  const rowBytes = size + 1;
  const raw = Buffer.alloc(rowBytes * size, 0xff);
  for (let y = 0; y < size; y += 1) {
    raw[y * rowBytes] = 0; // filter type for this scanline
  }

  for (let my = 0; my < modules; my += 1) {
    const row = matrix[my];
    for (let mx = 0; mx < modules; mx += 1) {
      if (!row[mx]) continue;
      const px0 = (mx + quiet) * scale;
      const py0 = (my + quiet) * scale;
      for (let dy = 0; dy < scale; dy += 1) {
        const rowStart = (py0 + dy) * rowBytes + 1; // +1 skips the filter byte
        raw.fill(0x00, rowStart + px0, rowStart + px0 + scale);
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // color type: grayscale
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function qrMatrixToPngBase64(matrix: boolean[][], options?: QrPngOptions): string {
  return qrMatrixToPngBuffer(matrix, options).toString("base64");
}

export function qrMatrixToPngDataUri(matrix: boolean[][], options?: QrPngOptions): string {
  return `data:image/png;base64,${qrMatrixToPngBase64(matrix, options)}`;
}
