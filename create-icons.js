const fs = require('fs');
const path = require('path');

// Simple function to create a minimal PNG with colored rectangle and text
function createIcon(size, outputPath) {
  // Create a simple 1x1 PNG that Chrome will accept as placeholder
  // In production, you should use proper icon files
  
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // Create IHDR chunk
  const width = size;
  const height = size;
  const bitDepth = 8;
  const colorType = 6; // RGBA
  const compression = 0;
  const filter = 0;
  const interlace = 0;
  
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(bitDepth, 8);
  ihdrData.writeUInt8(colorType, 9);
  ihdrData.writeUInt8(compression, 10);
  ihdrData.writeUInt8(filter, 11);
  ihdrData.writeUInt8(interlace, 12);
  
  const ihdr = createChunk('IHDR', ihdrData);
  
  // Create IDAT chunk with simple colored square
  const rawData = Buffer.alloc(size * size * 4 + size);
  let pos = 0;
  
  for (let y = 0; y < size; y++) {
    rawData[pos++] = 0; // Filter byte
    for (let x = 0; x < size; x++) {
      // Purple color: #6C63FF
      rawData[pos++] = 108; // R
      rawData[pos++] = 99;  // G
      rawData[pos++] = 255; // B
      rawData[pos++] = 255; // A
    }
  }
  
  // Simple deflate compression (not efficient but works)
  const compressed = require('zlib').deflateSync(rawData);
  const idat = createChunk('IDAT', compressed);
  
  // Create IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  // Combine all chunks
  const png = Buffer.concat([signature, ihdr, idat, iend]);
  fs.writeFileSync(outputPath, png);
  console.log(`Created ${outputPath}`);
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const crc = require('zlib').crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// Create icons
const iconsDir = path.join(__dirname, 'dist', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

createIcon(16, path.join(iconsDir, 'icon16.png'));
createIcon(48, path.join(iconsDir, 'icon48.png'));
createIcon(128, path.join(iconsDir, 'icon128.png'));

console.log('All icons created successfully!');
