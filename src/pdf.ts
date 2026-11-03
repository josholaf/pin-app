/**
 * v0.1.31: dependency-free PDF export (issue #68).
 *
 * Renders a note to a real PDF file (A4, Helvetica/Courier base-14 fonts,
 * page numbers) without pulling in any npm package. Covers the subset of
 * markdown the editor supports: # headings, bullet and numbered lists,
 * task checkboxes, fenced code blocks and plain paragraphs. Inline
 * emphasis markers (**bold**, *italic*, ==highlight==, `code`, ~~strike~~)
 * are stripped — the PDF keeps the text, not the styling noise.
 *
 * Base-14 fonts encode text in WinAnsi, so characters outside Latin-1 are
 * transliterated (smart quotes, dashes, ellipsis) or replaced with "?".
 */

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_X = 56;
const TOP_Y = 796;
const BOTTOM_Y = 56;

// Helvetica AFM widths for chars 32..126, /1000 em.
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// Helvetica-Bold AFM widths for chars 32..126.
const HELV_B = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** WinAnsi-friendly transliteration for common non-Latin-1 punctuation. */
const WIN_ANSI_MAP: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201A": ",", "\u201C": '"', "\u201D": '"',
  "\u2013": "-", "\u2014": "--", "\u2026": "...", "\u00A0": " ",
  "\u2022": "-", "\u2192": "->", "\u00D7": "x", "\t": "    ",
};

function toWinAnsi(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0) || 63;
    if (cp >= 32 && cp <= 255) out += ch;
    else out += WIN_ANSI_MAP[ch] !== undefined ? WIN_ANSI_MAP[ch] : "?";
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Width of a string in points at the given font/size. */
function textWidth(s: string, size: number, bold: boolean, mono: boolean): number {
  if (mono) return s.length * 0.6 * size;
  const table = bold ? HELV_B : HELV;
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    total += c >= 32 && c <= 126 ? table[c - 32] : 556;
  }
  return (total / 1000) * size;
}

/** Wrap one logical line into pieces that fit the printable width. */
function wrap(s: string, size: number, bold: boolean, mono: boolean, width: number): string[] {
  if (!s) return [""];
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const attempt = cur ? cur + " " + w : w;
    if (textWidth(attempt, size, bold, mono) <= width) cur = attempt;
    else {
      if (cur) lines.push(cur);
      // A single word longer than the line gets hard-split at the margin.
      if (textWidth(w, size, bold, mono) > width) {
        let piece = "";
        for (const ch of w) {
          if (textWidth(piece + ch, size, bold, mono) > width && piece) {
            lines.push(piece);
            piece = ch;
          } else piece += ch;
        }
        cur = piece;
      } else cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Strip inline markdown emphasis so the PDF shows clean text. */
function stripInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/==([^=]+)==/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]*)`/g, "$1");
}

type Segment = { kind: "heading" | "bullet" | "task" | "code" | "para"; level: number; text: string; done?: boolean };

/** Split note content into printable segments. */
function parse(content: string): Segment[] {
  const segs: Segment[] = [];
  const lines = content.split("\n");
  let inCode = false;
  const fence = String.fromCharCode(96).repeat(3);
  for (const raw of lines) {
    if (raw.trimStart().startsWith(fence)) { inCode = !inCode; continue; }
    if (inCode) { segs.push({ kind: "code", level: 0, text: raw }); continue; }
    const t = raw.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,6})\s+(.*)$/);
    if (h) { segs.push({ kind: "heading", level: h[1].length, text: stripInline(h[2]) }); continue; }
    const task = t.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (task) { segs.push({ kind: "task", level: 0, text: stripInline(task[2]), done: task[1] !== " " }); continue; }
    const b = t.match(/^[-*]\s+(.*)$/);
    if (b) { segs.push({ kind: "bullet", level: 0, text: stripInline(b[1]) }); continue; }
    segs.push({ kind: "para", level: 0, text: stripInline(t) });
  }
  return segs;
}

type Line = { text: string; size: number; bold: boolean; mono: boolean; indent: number; gapBefore: number };

/**
 * Render a note to PDF bytes. Throws nothing on empty content — a note with
 * no body still exports its title page.
 */
export function noteToPdf(title: string, content: string): Uint8Array {
  const printWidth = PAGE_W - 2 * MARGIN_X;
  const lines: Line[] = [];

  lines.push({ text: toWinAnsi((title || "Note").trim() || "Note"), size: 18, bold: true, mono: false, indent: 0, gapBefore: 0 });
  const d = new Date();
  const date =
    String(d.getDate()).padStart(2, "0") + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + d.getFullYear();
  lines.push({ text: "Exported from Pin - " + date, size: 9, bold: false, mono: false, indent: 0, gapBefore: 6 });

  for (const seg of parse(content)) {
    if (seg.kind === "code") {
      for (const piece of wrap(toWinAnsi(seg.text), 10, false, true, printWidth - 12)) {
        lines.push({ text: piece, size: 10, bold: false, mono: true, indent: 12, gapBefore: lines.length ? 2 : 2 });
      }
      continue;
    }
    const isH = seg.kind === "heading";
    const size = isH ? Math.max(12, 16 - seg.level * 1.5) : 11;
    const prefix = seg.kind === "bullet" ? "-  " : seg.kind === "task" ? (seg.done ? "[x]  " : "[ ]  ") : "";
    const indent = seg.kind === "bullet" || seg.kind === "task" ? 14 : 0;
    const wrapped = wrap(toWinAnsi(prefix + seg.text), size, isH, false, printWidth - indent);
    wrapped.forEach((piece, i) => {
      lines.push({
        text: piece, size, bold: isH, mono: false, indent,
        gapBefore: i === 0 ? (isH ? 12 : seg.kind === "para" ? 6 : 3) : isH ? 2 : 2.5,
      });
    });
  }

  // Lay out onto pages.
  const pages: { ops: string[] }[] = [];
  let ops: string[] = [];
  let y = TOP_Y;
  const newPage = () => { pages.push({ ops }); ops = []; y = TOP_Y; };
  for (const ln of lines) {
    const lead = ln.size * 1.35 + ln.gapBefore;
    if (y - lead < BOTTOM_Y) newPage();
    y -= lead;
    const font = ln.mono ? "/F3" : ln.bold ? "/F2" : "/F1";
    ops.push("BT " + font + " " + ln.size + " Tf 1 0 0 1 " + (MARGIN_X + ln.indent) + " " + y.toFixed(2) + " Tm (" + esc(ln.text) + ") Tj ET");
  }
  pages.push({ ops });

  // Page numbers on every page after the first line is drawn.
  pages.forEach((pg, i) => {
    const label = i + 1 + " / " + pages.length;
    const w = textWidth(label, 8, false, false);
    pg.ops.push("BT /F1 8 Tf 1 0 0 1 " + ((PAGE_W - w) / 2).toFixed(2) + " 34 Tm (" + esc(label) + ") Tj ET");
  });

  // Assemble the PDF objects.
  const objects: string[] = [];
  const pageCount = pages.length;
  const fontStart = 4; // 1 catalog, 2 pages, then page+content pairs
  const kids: string[] = [];
  const firstPageObj = fontStart + 3; // after 3 font objects
  for (let i = 0; i < pageCount; i++) kids.push(firstPageObj + 2 * i + " 0 R");
  objects[0] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pageCount + " >>";
  // Object 3 stays an empty placeholder so page numbering stays contiguous.

  const fonts = [
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  fonts.forEach((f, i) => { objects[fontStart - 1 + i] = f; });

  const firstPageObjB = firstPageObj;
  pages.forEach((pg, i) => {
    const pageObj = firstPageObjB + 2 * i;
    const contentObj = pageObj + 1;
    const stream = pg.ops.join("\n");
    objects[pageObj - 1] =
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PAGE_W + " " + PAGE_H +
      "] /Resources << /Font << /F1 " + fontStart + " 0 R /F2 " + (fontStart + 1) +
      " 0 R /F3 " + (fontStart + 2) + " 0 R >> >> /Contents " + contentObj + " 0 R >>";
    objects[contentObj - 1] = "<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream";
  });

  // Build the file body with a proper xref table.
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  const count = firstPageObj + 2 * pageCount;
  for (let n = 1; n <= count; n++) {
    offsets[n] = body.length;
    body += n + " 0 obj\n" + (objects[n - 1] !== undefined ? objects[n - 1] : "<< >>") + "\nendobj\n";
  }
  const xrefPos = body.length;
  body += "xref\n0 " + (count + 1) + "\n";
  body += "0000000000 65535 f \n";
  for (let n = 1; n <= count; n++) {
    body += String(offsets[n]).padStart(10, "0") + " 00000 n \n";
  }
  body += "trailer\n<< /Size " + (count + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";

  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) bytes[i] = body.charCodeAt(i) & 0xff;
  return bytes;
}
