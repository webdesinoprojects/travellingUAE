type QrVersionConfig = {
  version: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  dataBlocks: number[];
};

export type QrMatrix = boolean[][];

const QR_VERSION_CONFIGS: QrVersionConfig[] = [
  { version: 1, dataCodewords: 19, ecCodewordsPerBlock: 7, dataBlocks: [19] },
  { version: 2, dataCodewords: 34, ecCodewordsPerBlock: 10, dataBlocks: [34] },
  { version: 3, dataCodewords: 55, ecCodewordsPerBlock: 15, dataBlocks: [55] },
  { version: 4, dataCodewords: 80, ecCodewordsPerBlock: 20, dataBlocks: [80] },
  { version: 5, dataCodewords: 108, ecCodewordsPerBlock: 26, dataBlocks: [108] },
  { version: 6, dataCodewords: 136, ecCodewordsPerBlock: 18, dataBlocks: [68, 68] },
];

const MASK_PATTERNS: Array<(x: number, y: number) => boolean> = [
  (x: number, y: number) => (x + y) % 2 === 0,
  (x: number, y: number) => y % 2 === 0,
  (x: number) => x % 3 === 0,
  (x: number, y: number) => (x + y) % 3 === 0,
  (x: number, y: number) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x: number, y: number) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x: number, y: number) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x: number, y: number) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

export function createQrMatrix(value: string): QrMatrix | null {
  const bytes = Array.from(new TextEncoder().encode(value));
  const config = QR_VERSION_CONFIGS.find((candidate) =>
    canFitBytes(candidate, bytes.length),
  );
  if (!config) {
    return null;
  }

  const dataCodewords = buildDataCodewords(bytes, config);
  const finalCodewords = buildFinalCodewords(dataCodewords, config);
  const dataBits = codewordsToBits(finalCodewords);
  const base = buildFunctionPattern(config.version);

  let bestMatrix: QrMatrix | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  MASK_PATTERNS.forEach((mask, maskIndex) => {
    const candidate = cloneMatrix(base.modules);
    placeDataBits(candidate, base.reserved, dataBits, mask);
    placeFormatBits(candidate, maskIndex);
    const penalty = scorePenalty(candidate);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMatrix = candidate;
    }
  });

  return bestMatrix;
}

function canFitBytes(config: QrVersionConfig, byteLength: number) {
  const bitLength = 4 + 8 + byteLength * 8;
  return bitLength <= config.dataCodewords * 8;
}

function buildDataCodewords(bytes: number[], config: QrVersionConfig) {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = config.dataCodewords * 8;
  appendBits(bits, 0, Math.min(4, capacity - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = bitsToCodewords(bits);
  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (codewords.length < config.dataCodewords) {
    codewords.push(pads[padIndex % pads.length]);
    padIndex += 1;
  }

  return codewords;
}

function buildFinalCodewords(dataCodewords: number[], config: QrVersionConfig) {
  const blocks: number[][] = [];
  let offset = 0;
  for (const length of config.dataBlocks) {
    blocks.push(dataCodewords.slice(offset, offset + length));
    offset += length;
  }

  const ecBlocks = blocks.map((block) =>
    reedSolomonRemainder(block, config.ecCodewordsPerBlock),
  );
  const output: number[] = [];
  const maxDataLength = Math.max(...blocks.map((block) => block.length));

  for (let index = 0; index < maxDataLength; index += 1) {
    for (const block of blocks) {
      if (index < block.length) output.push(block[index]);
    }
  }

  for (let index = 0; index < config.ecCodewordsPerBlock; index += 1) {
    for (const block of ecBlocks) {
      output.push(block[index]);
    }
  }

  return output;
}

function buildFunctionPattern(version: number) {
  const size = getQrSize(version);
  const modules = createMatrix(size, false);
  const reserved = createMatrix(size, false);

  placeFinder(modules, reserved, 0, 0);
  placeFinder(modules, reserved, size - 7, 0);
  placeFinder(modules, reserved, 0, size - 7);
  placeTiming(modules, reserved);
  placeAlignmentPatterns(modules, reserved, version);
  reserveFormatAreas(reserved);

  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;

  return { modules, reserved };
}

function getQrSize(version: number) {
  return 21 + (version - 1) * 4;
}

function placeFinder(
  modules: QrMatrix,
  reserved: QrMatrix,
  left: number,
  top: number,
) {
  const size = modules.length;
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const xx = left + x;
      const yy = top + y;
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;

      const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
      const dark =
        inFinder &&
        (x === 0 ||
          x === 6 ||
          y === 0 ||
          y === 6 ||
          (x >= 2 && x <= 4 && y >= 2 && y <= 4));

      modules[yy][xx] = dark;
      reserved[yy][xx] = true;
    }
  }
}

function placeTiming(modules: QrMatrix, reserved: QrMatrix) {
  const size = modules.length;
  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0;
    modules[6][index] = dark;
    modules[index][6] = dark;
    reserved[6][index] = true;
    reserved[index][6] = true;
  }
}

function placeAlignmentPatterns(
  modules: QrMatrix,
  reserved: QrMatrix,
  version: number,
) {
  if (version === 1) return;
  const positions = [6, getQrSize(version) - 7];

  for (const y of positions) {
    for (const x of positions) {
      if (reserved[y][x]) continue;
      placeAlignment(modules, reserved, x, y);
    }
  }
}

function placeAlignment(
  modules: QrMatrix,
  reserved: QrMatrix,
  centerX: number,
  centerY: number,
) {
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const xx = centerX + x;
      const yy = centerY + y;
      const dark = Math.max(Math.abs(x), Math.abs(y)) !== 1;
      modules[yy][xx] = dark;
      reserved[yy][xx] = true;
    }
  }
}

function reserveFormatAreas(reserved: QrMatrix) {
  const size = reserved.length;
  for (let index = 0; index <= 8; index += 1) {
    reserved[8][index] = true;
    reserved[index][8] = true;
  }
  for (let index = 0; index < 8; index += 1) {
    reserved[8][size - 1 - index] = true;
    reserved[size - 1 - index][8] = true;
  }
}

function placeDataBits(
  modules: QrMatrix,
  reserved: QrMatrix,
  bits: number[],
  mask: (x: number, y: number) => boolean,
) {
  const size = modules.length;
  let bitIndex = 0;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < size; vertical += 1) {
      const y = upward ? size - 1 - vertical : vertical;

      for (let dx = 0; dx < 2; dx += 1) {
        const x = right - dx;
        if (reserved[y][x]) continue;

        let dark = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        if (mask(x, y)) dark = !dark;
        modules[y][x] = dark;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
}

function placeFormatBits(modules: QrMatrix, maskIndex: number) {
  const size = modules.length;
  const bits = getFormatBits(maskIndex);

  for (let index = 0; index <= 5; index += 1) {
    modules[index][8] = bitAt(bits, index);
  }
  modules[7][8] = bitAt(bits, 6);
  modules[8][8] = bitAt(bits, 7);
  modules[8][7] = bitAt(bits, 8);
  for (let index = 9; index < 15; index += 1) {
    modules[8][14 - index] = bitAt(bits, index);
  }

  for (let index = 0; index < 8; index += 1) {
    modules[8][size - 1 - index] = bitAt(bits, index);
  }
  for (let index = 8; index < 15; index += 1) {
    modules[size - 15 + index][8] = bitAt(bits, index);
  }
  modules[size - 8][8] = true;
}

function getFormatBits(maskIndex: number) {
  const data = (0b01 << 3) | maskIndex;
  let value = data << 10;
  const generator = 0x537;

  for (let bit = 14; bit >= 10; bit -= 1) {
    if (((value >>> bit) & 1) !== 0) {
      value ^= generator << (bit - 10);
    }
  }

  return ((data << 10) | value) ^ 0x5412;
}

function bitAt(value: number, index: number) {
  return ((value >>> index) & 1) !== 0;
}

function scorePenalty(matrix: QrMatrix) {
  return (
    scoreRuns(matrix) +
    scoreBlocks(matrix) +
    scoreFinderLikePatterns(matrix) +
    scoreDarkRatio(matrix)
  );
}

function scoreRuns(matrix: QrMatrix) {
  let penalty = 0;
  const size = matrix.length;

  for (let y = 0; y < size; y += 1) {
    penalty += scoreLineRuns(matrix[y]);
  }
  for (let x = 0; x < size; x += 1) {
    const column = matrix.map((row) => row[x]);
    penalty += scoreLineRuns(column);
  }

  return penalty;
}

function scoreLineRuns(line: boolean[]) {
  let penalty = 0;
  let runColor = line[0];
  let runLength = 1;

  for (let index = 1; index < line.length; index += 1) {
    if (line[index] === runColor) {
      runLength += 1;
    } else {
      if (runLength >= 5) penalty += 3 + (runLength - 5);
      runColor = line[index];
      runLength = 1;
    }
  }
  if (runLength >= 5) penalty += 3 + (runLength - 5);
  return penalty;
}

function scoreBlocks(matrix: QrMatrix) {
  let penalty = 0;
  const size = matrix.length;
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = matrix[y][x];
      if (
        matrix[y][x + 1] === color &&
        matrix[y + 1][x] === color &&
        matrix[y + 1][x + 1] === color
      ) {
        penalty += 3;
      }
    }
  }
  return penalty;
}

function scoreFinderLikePatterns(matrix: QrMatrix) {
  let penalty = 0;
  const size = matrix.length;

  for (let y = 0; y < size; y += 1) {
    penalty += scoreFinderLikeLine(matrix[y]);
  }
  for (let x = 0; x < size; x += 1) {
    penalty += scoreFinderLikeLine(matrix.map((row) => row[x]));
  }

  return penalty;
}

function scoreFinderLikeLine(line: boolean[]) {
  let penalty = 0;
  const patterns = ["10111010000", "00001011101"];
  const text = line.map((value) => (value ? "1" : "0")).join("");

  for (const pattern of patterns) {
    let index = text.indexOf(pattern);
    while (index !== -1) {
      penalty += 40;
      index = text.indexOf(pattern, index + 1);
    }
  }

  return penalty;
}

function scoreDarkRatio(matrix: QrMatrix) {
  const size = matrix.length;
  const total = size * size;
  const dark = matrix.reduce(
    (sum, row) => sum + row.filter(Boolean).length,
    0,
  );
  return Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let shift = length - 1; shift >= 0; shift -= 1) {
    bits.push((value >>> shift) & 1);
  }
}

function bitsToCodewords(bits: number[]) {
  const output: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let value = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      value = (value << 1) | (bits[index + offset] ?? 0);
    }
    output.push(value);
  }
  return output;
}

function codewordsToBits(codewords: number[]) {
  const bits: number[] = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));
  return bits;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const remainder = Array(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);
    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }

  return remainder;
}

function reedSolomonGenerator(degree: number) {
  let polynomial = [1];
  for (let index = 0; index < degree; index += 1) {
    polynomial = multiplyPolynomials(polynomial, [1, gfPow(index)]);
  }
  return polynomial;
}

function multiplyPolynomials(a: number[], b: number[]) {
  const output = Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      output[i + j] ^= gfMultiply(a[i], b[j]);
    }
  }
  return output;
}

const GF_EXP: number[] = [];
const GF_LOG: number[] = [];
initializeGaloisTables();

function initializeGaloisTables() {
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    GF_EXP[index] = value;
    GF_LOG[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) {
    GF_EXP[index] = GF_EXP[index - 255];
  }
}

function gfPow(power: number) {
  return GF_EXP[power];
}

function gfMultiply(a: number, b: number) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function createMatrix(size: number, value: boolean): QrMatrix {
  return Array.from({ length: size }, () => Array(size).fill(value));
}

function cloneMatrix(matrix: QrMatrix): QrMatrix {
  return matrix.map((row) => [...row]);
}
