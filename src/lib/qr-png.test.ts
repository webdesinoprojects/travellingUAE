import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";

import { qrMatrixToPngBase64, qrMatrixToPngBuffer } from "./qr-png.ts";

// Tiny 3x3 checker matrix is enough to validate the encoder structurally.
const MATRIX: boolean[][] = [
  [true, false, true],
  [false, true, false],
  [true, false, true],
];

test("qrMatrixToPngBuffer emits a valid PNG signature + IHDR/IDAT/IEND", () => {
  const png = qrMatrixToPngBuffer(MATRIX, { scale: 4, quietZone: 2 });

  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.includes(Buffer.from("IHDR", "ascii")));
  assert.ok(png.includes(Buffer.from("IDAT", "ascii")));
  assert.ok(png.includes(Buffer.from("IEND", "ascii")));

  // IHDR width/height = (modules + 2*quiet) * scale = (3 + 4) * 4 = 28.
  const ihdrStart = png.indexOf(Buffer.from("IHDR", "ascii")) + 4;
  assert.equal(png.readUInt32BE(ihdrStart), 28); // width
  assert.equal(png.readUInt32BE(ihdrStart + 4), 28); // height
  assert.equal(png[ihdrStart + 8], 8); // bit depth
  assert.equal(png[ihdrStart + 9], 0); // grayscale color type
});

test("qrMatrixToPngBuffer IDAT inflates to the expected scanline size", () => {
  const scale = 4;
  const quiet = 2;
  const size = (3 + quiet * 2) * scale; // 28
  const png = qrMatrixToPngBuffer(MATRIX, { scale, quietZone: quiet });

  // Extract IDAT payload and inflate it.
  const idatTag = png.indexOf(Buffer.from("IDAT", "ascii"));
  const lengthPos = idatTag - 4;
  const idatLen = png.readUInt32BE(lengthPos);
  const idatData = png.subarray(idatTag + 4, idatTag + 4 + idatLen);
  const raw = inflateSync(idatData);

  // Each row = 1 filter byte + `size` grayscale bytes.
  assert.equal(raw.length, (size + 1) * size);
  // Every scanline starts with filter byte 0.
  for (let y = 0; y < size; y += 1) {
    assert.equal(raw[y * (size + 1)], 0);
  }
});

test("qrMatrixToPngBase64 returns base64 and throws on empty matrix", () => {
  const b64 = qrMatrixToPngBase64(MATRIX);
  assert.match(b64, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.throws(() => qrMatrixToPngBuffer([]));
});
