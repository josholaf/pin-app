// Generates a clear pin (pushpin) app icon as src-tauri/icons/source-icon.png
// Run: node scripts/gen-icon.mjs && npx tauri icon src-tauri/icons/source-icon.png
import { writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

const S = 512;
const raw = Buffer.alloc(S * (S * 4 + 1));
let p = 0;

for (let y = 0; y < S; y++) {
  raw[p++] = 0; // filter: none
  for (let x = 0; x < S; x++) {
    const rCorner = 96;
    const dx = x < rCorner ? rCorner - x : (x >= S - rCorner ? x - (S - rCorner - 1) : 0);
    const dy = y < rCorner ? rCorner - y : (y >= S - rCorner ? y - (S - rCorner - 1) : 0);
    const insideBg = dx * dx + dy * dy <= rCorner * rCorner;

    const cx = S / 2;
    const headCy = S * 0.38;
    const headR = 72;
    const needleW = 22;
    const needleTop = headCy + headR - 8;
    const needleBottom = S * 0.82;
    const tipY = S * 0.88;

    const inHead = Math.hypot(x - cx, y - headCy) <= headR;
    const inHeadHighlight = Math.hypot(x - (cx - 22), y - (headCy - 22)) <= 22;
    const taper = 1 - (y - needleTop) / (needleBottom - needleTop) * 0.4;
    const inNeedle =
      y >= needleTop && y <= needleBottom &&
      Math.abs(x - cx) <= (needleW / 2) * taper;
    const tipH = tipY - needleBottom;
    const tipProgress = (y - needleBottom) / (tipH || 1);
    const inTip =
      y > needleBottom && y <= tipY &&
      Math.abs(x - cx) <= (needleW / 2 * 0.6) * (1 - tipProgress);

    if (!insideBg) {
      raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0;
    } else if (inHeadHighlight) {
      raw[p++] = 255; raw[p++] = 230; raw[p++] = 80; raw[p++] = 255;
    } else if (inHead) {
      raw[p++] = 255; raw[p++] = 196; raw[p++] = 0; raw[p++] = 255;
    } else if (inNeedle || inTip) {
      raw[p++] = 90; raw[p++] = 90; raw[p++] = 100; raw[p++] = 255;
    } else {
      raw[p++] = 79; raw[p++] = 70; raw[p++] = 229; raw[p++] = 255;
    }
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
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0)),
]);
mkdirSync('src-tauri/icons', { recursive: true });
writeFileSync('src-tauri/icons/source-icon.png', png);
console.log('Wrote src-tauri/icons/source-icon.png (' + png.length + ' bytes) — pin icon');
