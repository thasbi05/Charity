import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, colorFn) {
  // RGBA buffer with filter byte per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = colorFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  // CRC32 helper
  function crc32(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c;
    }
    let crc = 0 ^ -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Charity Icon Color generator (Green gradient + Gold emblem + White heart)
function charityIconColor(x, y, w, h, isMaskable = false) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background gradient: Emerald to dark slate
  const t = (x + y) / (w + h);
  let bgR = Math.round(6 + (15 - 6) * t);
  let bgG = Math.round(78 + (23 - 78) * t);
  let bgB = Math.round(59 + (42 - 59) * t);

  // Inner Gold heart shape
  const scale = (isMaskable ? 0.35 : 0.42) * w;
  const nx = dx / scale;
  const ny = (dy - scale * 0.1) / scale;
  
  // Heart formula: (x^2 + y^2 - 1)^3 - x^2 * y^3 <= 0
  const hVal = Math.pow(nx * nx + ny * ny - 1, 3) - (nx * nx) * Math.pow(ny, 3);

  if (hVal <= 0.05) {
    // Inside or border of heart
    if (hVal > -0.15) {
      // Gold border
      return [251, 191, 36, 255]; // Gold #fbbf24
    }
    // White/Emerald relief inner
    const innerDist = Math.sqrt(nx * nx + (ny + 0.2) * (ny + 0.2));
    if (innerDist < 0.35) {
      return [4, 120, 87, 255]; // Deep emerald core
    }
    return [255, 255, 255, 255]; // Crisp white
  }

  // Rounded outer squircle for non-maskable icons
  if (!isMaskable) {
    const cornerRadius = w * 0.22;
    const qx = Math.max(0, Math.abs(dx) - (w / 2 - cornerRadius));
    const qy = Math.max(0, Math.abs(dy) - (h / 2 - cornerRadius));
    const cornerDist = Math.sqrt(qx * qx + qy * qy);
    if (cornerDist > cornerRadius) {
      return [0, 0, 0, 0]; // Transparent outside squircle
    }
  }

  return [bgR, bgG, bgB, 255];
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate 192x192
fs.writeFileSync(
  path.join(publicDir, 'pwa-192x192.png'),
  createPNG(192, 192, (x, y, w, h) => charityIconColor(x, y, w, h, false))
);

// Generate 512x512
fs.writeFileSync(
  path.join(publicDir, 'pwa-512x512.png'),
  createPNG(512, 512, (x, y, w, h) => charityIconColor(x, y, w, h, false))
);

// Generate 512x512 maskable (full-bleed background with safe-zone margin)
fs.writeFileSync(
  path.join(publicDir, 'pwa-maskable-512x512.png'),
  createPNG(512, 512, (x, y, w, h) => charityIconColor(x, y, w, h, true))
);

// Generate 180x180 apple-touch-icon
fs.writeFileSync(
  path.join(publicDir, 'apple-touch-icon.png'),
  createPNG(180, 180, (x, y, w, h) => charityIconColor(x, y, w, h, false))
);

// Generate 32x32 favicon.ico (as PNG)
fs.writeFileSync(
  path.join(publicDir, 'favicon.ico'),
  createPNG(32, 32, (x, y, w, h) => charityIconColor(x, y, w, h, false))
);

console.log('Successfully generated PWA icon assets in /public');
