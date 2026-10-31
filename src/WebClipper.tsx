import { useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { Globe, X, Loader2, Scissors } from "lucide-react";

/** v0.1.18: the Web Clipper (issue #42).
 *  Saves webpages and selected text into clean notes — just the article
 *  content, no ads, nav, cookie banners, share bars or page addresses. */
export const WEB_CLIPS_FOLDER_ID = "web-clips";

export type WebClip = { title: string; markdown: string };

/** Elements that never hold article content. */
const STRIP_SELECTORS =
  "script,style,noscript,iframe,frame,svg,form,button,input,select,textarea," +
  "canvas,video,audio,object,embed,link,meta,nav,footer,header,aside,figure," +
  "template,dialog,amp-ad,ins";

/** class / id fragments that mark ad or boilerplate containers. */
const JUNK_ATTR =
  /(^|[-_ ])(ad|ads|adsense|advert|advertisement|sponsor|promo|popup|modal|overlay|cookie|consent|gdpr|banner|newsletter|subscribe|signup|share|social|sidebar|widget|comment|related|recommend|paywall|meter|breadcrumb|pagination|skip|hidden|offscreen)([-_ ]|$)/i;

/** Lines that are pure site furniture, not content. */
const JUNK_LINE =
  /^\s*(accept (all )?cookies|we use cookies|cookie (policy|settings|preferences)|share (this|on)|subscribe|sign up|newsletter|advertisement|sponsored|read more|skip to (main )?content|advertisement\s*\.?\s*continue reading below)\b/i;

/** Remove nodes that are ads or boilerplate by class / id. */
function stripJunk(root: Element) {
  root.querySelectorAll(STRIP_SELECTORS).forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const sig = ((el.className && typeof el.className === "string" ? el.className : "") + " " + (el.id || "")).toLowerCase();
    if (JUNK_ATTR.test(sig)) el.remove();
  });
}

/** Inline node → markdown text (bold, italic, code, links, images). */
function inlineToMd(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += (child.textContent || "").replace(/\s+/g, " ");
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    const inner = () => inlineToMd(el).trim();
    if (tag === "strong" || tag === "b") out += "**" + inner() + "**";
    else if (tag === "em" || tag === "i") out += "_" + inner() + "_";
    else if (tag === "del" || tag === "s" || tag === "strike") out += "~~" + inner() + "~~";
    else if (tag === "code") out += "`" + inner() + "`";
    else if (tag === "br") out += "\n";
    else if (tag === "img") {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "image";
      if (/^(https?:|data:)/.test(src)) out += "![" + alt + "](" + src + ")";
    } else if (tag === "a") {
      const href = el.getAttribute("href") || "";
      const text = inner();
      if (/^https?:\/\//.test(href) && text) out += "[" + text + "](" + href + ")";
      else out += text;
    } else {
      out += inlineToMd(el);
    }
  });
  return out;
}

/** Block-level node → markdown blocks (joined by blank lines). */
function blockToMd(el: Element): string {
  const blocks: string[] = [];
  const push = (s: string) => {
    const t = s.replace(/[ \t]+\n/g, "\n").trim();
    if (t && !JUNK_LINE.test(t)) blocks.push(t);
  };

  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = (child.textContent || "").replace(/\s+/g, " ").trim();
      if (t) push(t);
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const c = child as Element;
    const tag = c.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      push("#".repeat(Math.min(level + 1, 6)) + " " + inlineToMd(c).trim());
    } else if (tag === "p" || tag === "div" || tag === "section" || tag === "article" || tag === "span") {
      // Container: recurse. A div that only wraps text stays a paragraph.
      if (c.querySelector("p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,pre,table,img,div")) {
        const inner = blockToMd(c);
        if (inner.trim()) push(inner);
      } else {
        const t = inlineToMd(c).trim();
        if (t) push(t);
      }
    } else if (tag === "ul" || tag === "ol") {
      const items: string[] = [];
      c.querySelectorAll(":scope > li").forEach((li, i) => {
        const t = inlineToMd(li).trim();
        if (t) items.push((tag === "ol" ? String(i + 1) + ". " : "- ") + t.replace(/\n+/g, " "));
      });
      push(items.join("\n"));
    } else if (tag === "blockquote") {
      const t = inlineToMd(c).trim().replace(/\n{2,}/g, "\n");
      if (t) push(t.split("\n").map((l) => "> " + l).join("\n"));
    } else if (tag === "pre") {
      const code = (c.textContent || "").trim();
      if (code) push("```\n" + code + "\n```");
    } else if (tag === "table") {
      const rows = Array.from(c.querySelectorAll("tr"));
      if (rows.length) {
        const cellsOf = (tr: Element) =>
          Array.from(tr.querySelectorAll("th,td")).map((td) => inlineToMd(td).trim().replace(/\|/g, "\\|") || " ");
        const lines = rows.map((tr) => "| " + cellsOf(tr).join(" | ") + " |");
        if (lines.length > 1) lines.splice(1, 0, "|" + cellsOf(rows[0]).map(() => " --- |").join(""));
        push(lines.join("\n"));
      }
    } else if (tag === "hr") {
      push("---");
    } else if (tag === "img") {
      const src = c.getAttribute("src") || "";
      const alt = c.getAttribute("alt") || "image";
      if (/^(https?:|data:)/.test(src)) push("![" + alt + "](" + src + ")");
    } else {
      const t = inlineToMd(c).trim();
      if (t) push(t);
    }
  });

  return blocks.join("\n\n");
}

/** Score a candidate root by how much real paragraph text it holds. */
function candidateScore(el: Element): number {
  const ps = el.querySelectorAll("p");
  let text = 0;
  ps.forEach((p) => {
    const t = (p.textContent || "").trim();
    if (t.length > 40) text += t.length;
  });
  return text + Math.min(ps.length, 40) * 20;
}

/** Extract the readable article from raw HTML as clean markdown. */
export function extractArticle(html: string): WebClip {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const title =
    (doc.querySelector("meta[property='og:title']") as HTMLMetaElement | null)?.content ||
    (doc.title || "").trim() ||
    "Web clip";

  stripJunk(doc.body || doc.documentElement);

  // Pick the densest candidate root.
  const candidates = Array.from(
    doc.querySelectorAll("article,[itemprop*='articleBody'],main,[role='main'],.post,.article,.content,#content,[class*='post-content'],[class*='entry-content']")
  ).filter((el) => (el.textContent || "").trim().length > 200);
  let root: Element = doc.body || doc.documentElement;
  let best = candidateScore(root);
  candidates.forEach((el) => {
    const s = candidateScore(el);
    if (s > best) { best = s; root = el; }
  });
  // Nested junk (related posts, comment sections) inside the chosen root.
  stripJunk(root);

  const markdown = blockToMd(root)
    .split("\n")
    .filter((l) => !JUNK_LINE.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 100000);

  return { title: title.slice(0, 80) || "Web clip", markdown };
}

/** Fetch a webpage and return its clean markdown. */
export async function clipUrlToMarkdown(rawUrl: string): Promise<WebClip> {
  let url = rawUrl.trim();
  if (!url) throw new Error("Empty URL");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try { new URL(url); } catch { throw new Error("Invalid URL"); }

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PinClipper/0.1)",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
  const html = await res.text();
  const clip = extractArticle(html);
  if (!clip.markdown || clip.markdown.length < 40) throw new Error("No readable content found");
  return clip;
}

/** Small overlay that asks for a URL and turns it into a clean note. */
export function WebClipOverlay(props: { open: boolean; onClose: () => void; onSave: (clip: WebClip) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!props.open) return null;

  const run = async () => {
    if (busy) return;
    if (!url.trim()) { props.onClose(); return; }
    setBusy(true);
    setError("");
    try {
      const clip = await clipUrlToMarkdown(url);
      props.onSave(clip);
      setUrl("");
      props.onClose();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="capture-overlay" onClick={props.onClose}>
      <div className="capture-box clip-box" onClick={(e) => e.stopPropagation()}>
        <div className="capture-header">
          <Globe size={13} className="capture-icon" />
          <span className="capture-title">Clip webpage</span>
          <button className="icon-btn" title="Close (Esc)" onClick={props.onClose}><X size={14} /></button>
        </div>
        <input
          className="clip-url-input"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); void run(); }
            if (e.key === "Escape") { e.preventDefault(); props.onClose(); }
          }}
          placeholder="Paste a page URL... only the article is saved, no ads or address"
          spellCheck={false}
        />
        {error && <div className="clip-error">{error}</div>}
        <div className="capture-footer">
          <span className="capture-hint">Saves the clean article into Web Clips</span>
          <button className="small-btn capture-save-btn" onClick={() => void run()} disabled={busy}>
            {busy ? <Loader2 size={13} className="clip-spin" /> : <Scissors size={12} />} Clip page
          </button>
        </div>
      </div>
    </div>
  );
}
