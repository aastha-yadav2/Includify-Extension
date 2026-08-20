const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Minimal PNG generator using standard Node libraries
function createPngBuffer(width, height, r = 79, g = 70, b = 229) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw Image Data (RGB per pixel + filter byte per scanline)
  const scanlineLength = width * 3 + 1;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const offset = y * scanlineLength;
    rawData[offset] = 0; // filter type 0 (none)
    for (let x = 0; x < width; x++) {
      const p = offset + 1 + x * 3;
      // Draw indigo circle in middle
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < width * 0.4) {
        rawData[p] = r;     // R
        rawData[p + 1] = g; // G
        rawData[p + 2] = b; // B
      } else {
        rawData[p] = 248;   // R background
        rawData[p + 1] = 250;
        rawData[p + 2] = 252;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);
  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc, 8 + length);
  return buffer;
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    for (let j = 0; j < 8; j++) {
      let mix = (crc ^ byte) & 1;
      crc = (crc >>> 1) ^ (mix ? 0xedb88320 : 0);
      byte >>>= 1;
    }
  }
  return (crc ^ -1) >>> 0;
}

const assetsDir = path.join(__dirname, '..', 'extension', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

[16, 48, 128].forEach(size => {
  const iconBuffer = createPngBuffer(size, size);
  fs.writeFileSync(path.join(assetsDir, `icon${size}.png`), iconBuffer);
  console.log(`✅ Created extension icon: assets/icon${size}.png`);
});
