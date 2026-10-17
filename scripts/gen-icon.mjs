// Generates a placeholder app icon (rounded square with a pin) as src-tauri/icons/source-icon.png
// Used by CI before `npx tauri icon` when real icons are not committed to the repo.
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

const S = 512;
const raw = Buffer.alloc(S * (S * 4 + 1));
let p = 0;
for (let y = 0; y < S; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < S; x++) {
    const r = 96;
    const dx = x < r ? r - x : (x >= S - r ? x - (S - r - 1) : 0);
    const dy = y < r ? r - y : (y >= S - r ? y - (S - r - 1) : 0);
    const inside = dx * dx + dy * dy <= r * r;
    const cx = S / 2, cy = S / 2, dist = Math.hypot(x - cx, y - cy);
    if (!inside) { raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; }
    else if (dist < 110) { raw[p++] = 255; raw[p++] = 214; raw[p++] = 10; raw[p++] = 255; }
    else if (dist < 150) { raw[p++] = 70; raw[p++] = 70; raw[p++] = 80; raw[p++] = 255; }
    else { raw[p++] = 99; raw[p++] = 102; raw[p++] = 241; raw[p++] = 255; }
  }
}
const idat = zlib.deflateSync(raw.subarray(0, p));
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  let c = 0xffffffff;
  for (const byte of crcBuf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  const crc = Buffer.alloc(4); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, t, data, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('src-tauri/icons', { recursive: true });
writeFileSync('src-tauri/icons/source-icon.png', png);
console.log('Wrote src-tauri/icons/source-icon.png (' + png.length + ' bytes)');
