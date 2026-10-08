var Claudamp = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // hooks/scenes.ts
  var scenes_exports = {};
  __export(scenes_exports, {
    DEFAULT_FRAME: () => DEFAULT_FRAME,
    SCENES: () => SCENES,
    deckSvg: () => deckSvg,
    frameFor: () => frameFor
  });
  var DEFAULT_FRAME = { width: 360, height: 480 };
  var W = DEFAULT_FRAME.width;
  var H = DEFAULT_FRAME.height;
  var STAGE_TOP = 64;
  var STAGE_H = H - 120;
  function frameFor(width, height) {
    const aspect = Math.min(3, Math.max(0.4, height / Math.max(1, width)));
    return aspect >= 480 / 360 ? { width: 360, height: Math.round(360 * aspect) } : { width: Math.round(480 / aspect), height: 480 };
  }
  var MONO = `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
  var SANS = `-apple-system, 'Helvetica Neue', 'Segoe UI', sans-serif`;
  var SERIF = `'Iowan Old Style', 'Palatino Linotype', Georgia, serif`;
  var SCENES = ["SPECTRUM", "WORDCLAUDE", "LYRICS", "TETRIS"];
  var PALETTES = {
    idle: { a: "#64748b", b: "#94a3b8", c: "#334155", label: "STANDBY" },
    thinking: { a: "#a78bfa", b: "#f0abfc", c: "#6366f1", label: "THINKING" },
    writing: { a: "#22d3ee", b: "#34d399", c: "#3b82f6", label: "WRITING" },
    tool: { a: "#fbbf24", b: "#fb7185", c: "#f97316", label: "RUNNING" },
    finale: { a: "#fde68a", b: "#f9a8d4", c: "#c4b5fd", label: "COMPLETE" }
  };
  var PLACEHOLDER_WORDS = [
    ["claudamp", 6],
    ["waiting", 3],
    ["prompt", 3],
    ["spectrum", 2],
    ["lyrics", 2],
    ["llama", 1.5],
    ["play", 1],
    ["vibes", 1]
  ];
  var LOOKS = {
    think: { label: "thinking", colors: ["#c4b5fd", "#f0abfc", "#a78bfa", "#e9d5ff"], family: `'Iowan Old Style', 'Palatino Linotype', Georgia, serif`, italic: true, heavy: 700, light: 400 },
    reply: { label: "replies", colors: ["#22d3ee", "#34d399", "#93c5fd", "#e2e8f0"], family: `-apple-system, 'Helvetica Neue', 'Segoe UI', sans-serif`, italic: false, heavy: 800, light: 500 },
    prompt: { label: "you", colors: ["#fde68a", "#fef3c7", "#facc15"], family: `-apple-system, 'Helvetica Neue', 'Segoe UI', sans-serif`, italic: false, heavy: 900, light: 700 },
    tool: { label: "tools", colors: ["#fb923c", "#fbbf24", "#fb7185", "#fdba74"], family: `ui-monospace, 'SF Mono', Menlo, Consolas, monospace`, italic: false, heavy: 700, light: 400 }
  };
  function esc(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
  }
  function rng(seed) {
    let s = seed * 2654435761 >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      return s / 4294967296;
    };
  }
  var f = (n) => (Math.round(n * 100) / 100).toString();
  function clock(ms) {
    const sec = Math.max(0, Math.floor(ms / 1e3));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }
  function deckSvg(deck, now, frame = DEFAULT_FRAME, options = {}) {
    const hasLcd = options.lcd !== false;
    W = frame.width;
    H = frame.height;
    STAGE_TOP = hasLcd ? 64 : 10;
    STAGE_H = H - STAGE_TOP - 56;
    const pal = PALETTES[deck.phase];
    const body = deck.phase === "finale" && deck.finale ? finale(deck.finale) : deck.scene === 1 ? cloud(deck.words.length > 2 ? deck : { ...deck, words: PLACEHOLDER_WORDS }, pal) : deck.scene === 2 ? lyrics(deck.lyric.length > 0 ? deck : { ...deck, lyric: ["waiting", "for", "a", "prompt"] }, pal) : deck.scene === 3 ? tetris(deck, now) : spectrum(deck, pal);
    const elapsed = deck.phase === "idle" ? "--:--" : deck.phase === "finale" && deck.finale ? clock(deck.finale.durationMs) : "\u25CF LIVE";
    const ticker = deck.phase === "tool" && deck.tool ? `\u25B6 ${deck.tool.toUpperCase()} \u2605 ${pal.label} \u2605 ${deck.tool.toUpperCase()} \u2605` : deck.phase === "finale" ? `\u25A0 FIN \u2605 ${(deck.finale?.title ?? "").toUpperCase()} \u2605 THANKS FOR LISTENING \u2605` : deck.phase === "idle" ? "\u2605 CLAUDAMP \u2605 WAITING FOR A PROMPT \u2605 PRESS PLAY \u2605" : `\u2605 CLAUDE \xB7 ${pal.label} \u2605 ${SCENES[deck.scene] ?? ""} \u2605 ${Math.round(deck.tokensPerSec)} TOK/S \u2605`;
    const glitch = deck.glitch > 0 && deck.phase !== "finale" ? `<rect class="glitch" x="0" y="0" width="${W}" height="${H}" fill="#ef4444"/>` : "";
    return `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d0b1a"/><stop offset="1" stop-color="#05050a"/>
  </linearGradient>
  <radialGradient id="aura" cx="0.5" cy="0.55" r="0.6">
    <stop offset="0" stop-color="${pal.c}" stop-opacity="0.35"/><stop offset="1" stop-color="${pal.c}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="amp" x1="0" y1="1" x2="0" y2="0" gradientUnits="objectBoundingBox">
    <stop offset="0" stop-color="#16a34a"/><stop offset="0.55" stop-color="#facc15"/><stop offset="0.85" stop-color="#f97316"/><stop offset="1" stop-color="#ef4444"/>
  </linearGradient>
  <linearGradient id="phase" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${pal.a}"/><stop offset="1" stop-color="${pal.b}"/>
  </linearGradient>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <clipPath id="stage"><rect x="10" y="${STAGE_TOP}" width="${W - 20}" height="${STAGE_H}" rx="6"/></clipPath>
  <clipPath id="lcd"><rect x="14" y="34" width="${W - 106}" height="20"/></clipPath>
</defs>
<style>
  @keyframes aura { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
  @keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }
  @keyframes blink { 0%,49% { opacity: 1 } 50%,100% { opacity: .25 } }
  @keyframes flash { 0% { opacity: 1 } 100% { opacity: 0 } }
  @keyframes glitch { 0% { opacity: .55 } 20% { opacity: 0 } 30% { opacity: .35 } 100% { opacity: 0 } }
  .aura { animation: aura ${f(3.6 - deck.energy * 2.4)}s ease-in-out infinite }
  .marquee { animation: marquee 14s linear infinite }
  .blink { animation: blink 1s steps(1) infinite }
  .glitch { animation: glitch .6s ease-out forwards; mix-blend-mode: screen }
</style>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<rect class="aura" width="${W}" height="${H}" fill="url(#aura)"/>
${hasLcd ? `<g font-family="${MONO}">
  <text x="14" y="22" font-size="11" letter-spacing="3" fill="${pal.b}" font-weight="700">CLAUDAMP</text>
  <text x="${W - 14}" y="22" font-size="11" text-anchor="end" fill="#64748b">${deck.phase === "finale" ? "\u25A0 STOP" : deck.phase === "idle" ? "\u275A\u275A PAUSE" : "\u25B6 PLAY"}</text>
  <rect x="12" y="32" width="${W - 24}" height="24" rx="3" fill="#000" stroke="#1e293b"/>
  <line x1="${W - 88}" y1="36" x2="${W - 88}" y2="52" stroke="#1e293b"/>
  <text x="${W - 20}" y="49" font-size="15" text-anchor="end" fill="${deck.phase === "finale" ? "#4ade80" : deck.phase === "idle" ? "#4ade80" : "#f87171"}" ${deck.phase !== "finale" ? 'class="blink"' : ""}>${elapsed}</text>
  <g clip-path="url(#lcd)">
    <g class="marquee"><text x="18" y="48" font-size="11" fill="#4ade80" opacity=".9">${esc(ticker)}   ${esc(ticker)}   </text></g>
  </g>
</g>` : ""}
<rect x="10" y="${STAGE_TOP}" width="${W - 20}" height="${STAGE_H}" rx="6" fill="#000" fill-opacity=".35" stroke="#1e1b4b"/>
<g clip-path="url(#stage)">${body}</g>
${footer(deck, pal)}
${glitch}
${deck.phase === "finale" && deck.finale?.isFresh ? `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff" style="animation:flash .9s ease-out both"/>` : ""}
</svg>`;
  }
  function footer(deck, pal) {
    if (deck.phase === "finale") return "";
    const dots = SCENES.map((name, i) => {
      const on = i === deck.scene;
      const x = 24 + (W - 60) * (i + 0.5) / SCENES.length;
      return `<text x="${f(x)}" y="${H - 22}" text-anchor="middle" font-size="${W < 420 ? 7.5 : 9}" letter-spacing="${W < 420 ? 1 : 2}" fill="${on ? pal.b : "#475569"}">${on ? "\u25CF " : "\u25CB "}${name}</text>`;
    }).join("");
    const meter = Math.round(deck.energy * 30);
    const mode = `<text x="${W - 14}" y="${H - 22}" text-anchor="end" font-size="8" letter-spacing="1" fill="#64748b">${deck.pick === null ? "\u27F3" : "\u{1F4CC}"}</text>`;
    return `<g font-family="${MONO}">${dots}${mode}
  <rect x="14" y="${H - 12}" width="${W - 28}" height="3" rx="1.5" fill="#1e293b"/>
  <rect x="14" y="${H - 12}" width="${f((W - 28) * meter / 30)}" height="3" rx="1.5" fill="url(#phase)"/></g>`;
  }
  function spectrum(deck, pal) {
    const r = rng(deck.beat + 7);
    const bars = Math.max(16, Math.round((W - 32) / 12.6));
    const gap = 2.4;
    const bw = (W - 32 - gap * (bars - 1)) / bars;
    const base = Math.round(STAGE_TOP + STAGE_H * 0.7);
    const maxH = Math.round(STAGE_H * 0.58);
    const e = deck.phase === "idle" ? 0.08 : Math.max(0.15, deck.energy);
    const measured = deck.phase !== "idle" && deck.bands.length > 0;
    const level = (i) => {
      if (!measured) return 0.04 + r() * 0.08;
      const at = i / bars * deck.bands.length;
      const lo = Math.floor(at);
      const hi = Math.min(deck.bands.length - 1, lo + 1);
      const mix = at - lo;
      return (deck.bands[lo] ?? 0) * (1 - mix) + (deck.bands[hi] ?? 0) * mix;
    };
    let css = "";
    let clips = "";
    let rects = "";
    for (let i = 0; i < bars; i++) {
      const v = level(i);
      const hi = Math.min(1, 0.03 + v * 0.97);
      const lo = hi * (0.3 + r() * 0.4);
      const dur = 0.12 + (1 - v) * 0.45 + r() * 0.25;
      const delay = -r() * 2;
      const x = 16 + i * (bw + gap);
      css += `@keyframes b${i}{0%{transform:scaleY(${f(lo)})}100%{transform:scaleY(${f(hi)})}}`;
      css += `@keyframes p${i}{0%{transform:translateY(${f(-maxH * lo - 4)}px)}100%{transform:translateY(${f(-maxH * hi - 4)}px)}}`;
      clips += `<clipPath id="cb${i}"><rect x="${f(x)}" y="${base - maxH}" width="${f(bw)}" height="${maxH}" style="transform-origin:${f(x)}px ${base}px;animation:b${i} ${f(dur)}s ease-in-out ${f(delay)}s infinite alternate"/></clipPath>`;
      rects += `<rect x="${f(x)}" y="${base - maxH}" width="${f(bw)}" height="${maxH}" fill="url(#meter)" clip-path="url(#cb${i})"/>`;
      rects += `<rect x="${f(x)}" y="${base}" width="${f(bw)}" height="2" fill="#e2e8f0" style="animation:p${i} ${f(dur)}s ease-out ${f(delay)}s infinite alternate"/>`;
    }
    const meter = `<linearGradient id="meter" gradientUnits="userSpaceOnUse" x1="0" y1="${base}" x2="0" y2="${base - maxH}"><stop offset="0" stop-color="#16a34a"/><stop offset=".45" stop-color="#84cc16"/><stop offset=".62" stop-color="#facc15"/><stop offset=".8" stop-color="#f97316"/><stop offset="1" stop-color="#ef4444"/></linearGradient>`;
    const mirror = `<g transform="translate(0 ${2 * base + 2}) scale(1 -1)" opacity=".18">${rects}</g>`;
    const amp = (6 + e * 26) * (STAGE_H / 360);
    const mid = STAGE_TOP + STAGE_H * 0.89;
    const series = measured ? deck.bands : Array.from({ length: 24 }, () => 0.15 + r() * 0.1);
    const pts = [];
    for (let k = 0; k <= series.length * 2; k++) {
      const v = series[k % series.length] ?? 0;
      const x = k / series.length * W;
      pts.push(`${f(x)},${f(mid + (k % 2 ? 1 : -1) * v * amp)}`);
    }
    const scopeDur = f(2.6 - e * 1.8);
    css += `@keyframes scope{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}`;
    return `<defs>${meter}${clips}</defs><style>${css}</style>
  ${mirror}${rects}
  <polyline points="${pts.join(" ")}" fill="none" stroke="${pal.a}" stroke-width="1.6" stroke-linejoin="round" filter="url(#glow)" style="animation:scope ${scopeDur}s linear infinite"/>
  <text x="${W / 2}" y="${STAGE_TOP + 22}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="4" fill="${pal.b}" opacity=".7">${esc(deck.phase === "tool" && deck.tool ? deck.tool : pal.label)}</text>`;
  }
  function layout(words, scale, seed) {
    const r = rng(seed);
    const max = words[0]?.[1] ?? 1;
    const cx = W / 2;
    const cy = STAGE_TOP + STAGE_H / 2;
    const ar = (W - 20) / STAGE_H / (340 / 360);
    const placed = [];
    for (const [word, n, source = "reply"] of words) {
      let size = Math.max(7, scale * (n / max));
      let w = word.length * size * 0.56;
      if (w > W - 36) {
        size *= (W - 36) / w;
        w = W - 36;
      }
      const h = size * 0.95;
      const turn = r() * Math.PI * 2;
      for (let s = 0; s < 2400; s++) {
        const a = s * 0.18 + turn;
        const rad = 1.2 * s * 0.18;
        const x = cx + Math.cos(a) * rad * 1.35 * Math.sqrt(ar) - w / 2;
        const y = cy + Math.sin(a) * rad * (0.85 / Math.sqrt(ar)) - h / 2;
        if (x < 14 || x + w > W - 14 || y < STAGE_TOP + 6 || y + h > STAGE_TOP + STAGE_H - 6) {
          if (rad > W + STAGE_H) break;
          continue;
        }
        const pad = Math.max(2, size * 0.12);
        if (placed.every((p) => x + w + pad < p.x || p.x + p.w + pad < x || y + h + 1 < p.y || p.y + p.h + 1 < y)) {
          placed.push({ word, n, source, size, x, y, w, h });
          break;
        }
      }
    }
    return placed;
  }
  function cloud(deck, pal) {
    const r = rng(deck.beat + 11);
    const words = deck.words;
    let scale = Math.min(W - 20, STAGE_H * 1.25) * 0.15;
    let placed = layout(words, scale, deck.beat);
    for (let tries = 0; tries < 7 && placed.length < words.length * 0.92; tries++) {
      scale *= 0.84;
      placed = layout(words, scale, deck.beat);
    }
    let css = `@keyframes pop{0%{opacity:0;transform:scale(.3)}70%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}`;
    css += `@keyframes bob{0%,100%{transform:translateY(-2px)}50%{transform:translateY(2px)}}`;
    const max = words[0]?.[1] ?? 1;
    const stagger = Math.min(0.06, 2.4 / Math.max(1, placed.length));
    const out = placed.map((p, i) => {
      const t = p.n / max;
      const look = LOOKS[p.source];
      const color = look.colors[(i + deck.beat) % look.colors.length];
      const mx = p.x + p.w / 2;
      const my = p.y + p.h * 0.8;
      const big = t > 0.45;
      const family = p.source === "reply" && !big ? MONO : look.family;
      return `<g style="transform-origin:${f(mx)}px ${f(my)}px;animation:pop .7s cubic-bezier(.2,1.4,.4,1) ${f(i * stagger)}s both">
      <text x="${f(mx)}" y="${f(my)}" text-anchor="middle" font-family="${family}" ${look.italic ? 'font-style="italic"' : ""} font-weight="${t > 0.25 ? look.heavy : look.light}" font-size="${f(p.size)}" fill="${color}" ${i < 3 ? 'filter="url(#glow)"' : ""} opacity="${f(0.55 + t * 0.45)}" style="animation:bob ${f(2.2 + r() * 2.5)}s ease-in-out ${f(-r() * 3)}s infinite">${esc(p.word)}</text></g>`;
    }).join("");
    const shown = Object.keys(LOOKS).filter((s) => placed.some((p) => p.source === s));
    const legend = shown.map((s, i) => {
      const look = LOOKS[s];
      const x = 22 + (W - 44) * (i + 0.5) / shown.length;
      return `<text x="${f(x)}" y="${f(STAGE_TOP + STAGE_H - 10)}" text-anchor="middle" font-family="${look.family}" ${look.italic ? 'font-style="italic"' : ""} font-weight="${look.heavy}" font-size="10" fill="${look.colors[0]}">\u25C6 ${look.label}</text>`;
    }).join("");
    return `<style>${css}</style>${out}${legend}`;
  }
  var overlaps = (a, b, pad) => !(a.x1 + pad <= b.x0 || b.x1 + pad <= a.x0 || a.y1 + pad <= b.y0 || b.y1 + pad <= a.y0);
  var ENTRIES = [
    "from{opacity:0;transform:scale(2.4);filter:blur(10px)}to{opacity:1;transform:scale(1);filter:blur(0)}",
    "from{opacity:0;transform:scale(0)}70%{opacity:1;transform:scale(1.12)}to{opacity:1;transform:scale(1)}",
    "from{opacity:0;transform:translateX(-60%) skewX(-25deg)}to{opacity:1;transform:translateX(0) skewX(0)}",
    "from{opacity:0;transform:translateY(-90%)}60%{opacity:1;transform:translateY(8%)}to{opacity:1;transform:translateY(0)}",
    "from{opacity:0;transform:scaleY(0)}to{opacity:1;transform:scaleY(1)}",
    "from{opacity:0;transform:rotate(-25deg) scale(.4)}to{opacity:1;transform:rotate(0) scale(1)}"
  ];
  function lyrics(deck, pal) {
    const r = rng(deck.beat + 3);
    const words = deck.lyric.slice(-8);
    const step = 0.38;
    const fly = 0.32;
    const cx = W / 2;
    const cy = STAGE_TOP + STAGE_H * 0.44;
    const COLORS = ["url(#phase)", "#f8fafc", pal.a, "#fde68a", pal.b];
    const placed = [];
    for (const word of words) {
      const text = word.toUpperCase();
      const size = 22 + r() * 34 + (word.length <= 3 ? -6 : 0);
      const len = text.length * size * 0.66;
      const thick = size * 0.86;
      const prev = placed[placed.length - 1];
      const isVertical = !!prev && !prev.isVertical && r() < 0.38;
      const w = isVertical ? thick : len;
      const h = isVertical ? len : thick;
      const g = size * 0.18;
      let spot = { x0: 0, y0: 0, x1: w, y1: h };
      if (prev) {
        const options = [
          { x0: prev.x1 + g, y0: prev.y0, x1: prev.x1 + g + w, y1: prev.y0 + h },
          // right, top-aligned
          { x0: prev.x1 + g, y0: prev.y1 - h, x1: prev.x1 + g + w, y1: prev.y1 },
          // right, bottom-aligned
          { x0: prev.x0, y0: prev.y1 + g, x1: prev.x0 + w, y1: prev.y1 + g + h },
          // below, left-aligned
          { x0: prev.x1 - w, y0: prev.y1 + g, x1: prev.x1, y1: prev.y1 + g + h },
          // below, right-aligned
          { x0: prev.x0, y0: prev.y0 - g - h, x1: prev.x0 + w, y1: prev.y0 - g },
          // above
          { x0: prev.x0 - g - w, y0: prev.y0, x1: prev.x0 - g, y1: prev.y0 + h }
          // left
        ];
        const recent = placed.slice(-5);
        const free = options.filter((o) => recent.every((p) => !overlaps(o, p, g * 0.5)));
        const pool = free.length ? free : options;
        spot = pool[Math.floor(r() * pool.length)];
      }
      placed.push({ ...spot, word: text, size, isVertical, color: COLORS[Math.floor(r() * COLORS.length)], isOutline: r() < 0.18 });
    }
    const cams = placed.map((p) => {
      const along = p.isVertical ? p.y1 - p.y0 : p.x1 - p.x0;
      const across = p.isVertical ? p.x1 - p.x0 : p.y1 - p.y0;
      const zoom = Math.min(2.6, (W - 40) * 0.82 / along, STAGE_H * 0.42 / across) * (0.86 + r() * 0.14);
      const rot = (p.isVertical ? 90 : 0) + (r() - 0.5) * 9;
      return `translate(${f(cx)}px,${f(cy)}px) rotate(${f(rot)}deg) scale(${f(zoom)}) translate(${f(-(p.x0 + p.x1) / 2)}px,${f(-(p.y0 + p.y1) / 2)}px)`;
    });
    const total = Math.max(1, placed.length) * step + 0.8;
    const pc = (t) => f(Math.min(100, t / total * 100));
    let camK = `0%{transform:${cams[0] ?? "none"}}`;
    cams.forEach((c, i) => {
      if (i === 0) return;
      camK += `${pc(i * step)}%{transform:${cams[i - 1]}}${pc(i * step + fly)}%{transform:${c}}`;
    });
    camK += `100%{transform:${cams[cams.length - 1] ?? "none"}}`;
    let css = `@keyframes cam{${camK}}`;
    css += ENTRIES.map((e, i) => `@keyframes e${i}{${e}}`).join("");
    css += `@keyframes out{to{opacity:0;transform:scale(.85);filter:blur(4px)}}`;
    css += `@keyframes karaoke{from{fill:#475569}to{fill:${pal.b}}}`;
    css += `@keyframes streak{from{transform:translateX(-${W}px)}to{transform:translateX(${W}px)}}`;
    const KEEP = 5;
    const board = placed.map((p, i) => {
      const origin = p.isVertical ? `translate(${f(p.x0)} ${f(p.y1)}) rotate(-90)` : `translate(${f(p.x0)} ${f(p.y0)})`;
      const entry = `e${Math.floor(r() * ENTRIES.length)} .42s cubic-bezier(.2,1.2,.4,1) ${f(i * step + 0.04)}s both`;
      const exit = i < placed.length - KEEP ? `, out .5s ease-in ${f((i + KEEP) * step)}s forwards` : "";
      const paint = p.isOutline ? `fill="none" stroke="${p.color === "url(#phase)" ? pal.a : p.color}" stroke-width="${f(p.size * 0.035)}"` : `fill="${p.color}"`;
      return `<g transform="${origin}"><text x="0" y="${f(p.size * 0.74)}" font-family="${SANS}" font-weight="900" font-size="${f(p.size)}" letter-spacing="${f(-p.size * 0.02)}" ${paint} filter="url(#glow)" style="transform-box:fill-box;transform-origin:center;animation:${entry}${exit}">${esc(p.word)}</text></g>`;
    }).join("");
    const k = Math.min(W, STAGE_H * 1.1) / 360;
    const rows = [[]];
    let used = 0;
    words.forEach((w, i) => {
      if (used + w.length > 36 * W / 360 && rows[rows.length - 1].length) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push({ w, i });
      used += w.length + 1;
    });
    const line = rows.slice(-2).map(
      (row, n) => `<text x="${cx}" y="${f(STAGE_TOP + STAGE_H * 0.86 + n * 20 * k)}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="${f(14 * k)}">` + row.map(({ w, i }) => `<tspan style="animation:karaoke .2s linear ${f(i * step)}s both">${esc(w)} </tspan>`).join("") + `</text>`
    ).join("");
    const streaks = [0, 1, 2].map(() => {
      const y = STAGE_TOP + 40 + r() * (STAGE_H - 100);
      return `<rect x="0" y="${f(y)}" width="${f(60 + r() * 120)}" height="1.5" fill="${pal.a}" opacity=".35" style="animation:streak ${f(0.9 + r())}s linear ${f(-r())}s infinite"/>`;
    }).join("");
    return `<style>${css}</style>${streaks}<g style="animation:cam ${f(total)}s cubic-bezier(.65,0,.35,1) both">${board}</g>
  <rect x="10" y="${f(STAGE_TOP + STAGE_H * 0.8)}" width="${W - 20}" height="${f(STAGE_H * 0.2)}" fill="#05050a" fill-opacity=".55"/>
  ${line}`;
  }
  var PIECES = [
    { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#22d3ee" },
    // I
    { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: "#facc15" },
    // O
    { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#a855f7" },
    // T
    { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: "#22c55e" },
    // S
    { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#ef4444" },
    // Z
    { cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#3b82f6" },
    // J
    { cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: "#f97316" }
    // L
  ];
  function rotations(cells) {
    const out = [];
    let cur = cells;
    for (let i = 0; i < 4; i++) {
      const minX = Math.min(...cur.map((c) => c[0]));
      const minY = Math.min(...cur.map((c) => c[1]));
      const norm = cur.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
      if (!out.some((o) => o.every((c, j) => c[0] === norm[j][0] && c[1] === norm[j][1]))) out.push(norm);
      cur = cur.map(([x, y]) => [-y, x]);
    }
    return out;
  }
  var SLOPPY_AFTER = 24;
  var TETRIS_WORDS = [
    "claude",
    "tetris",
    "prompt",
    "commit",
    "deploy",
    "refactor",
    "async",
    "await",
    "merge",
    "lint",
    "build",
    "ship",
    "debug",
    "tokens",
    "vibes",
    "stack",
    "queue",
    "cache",
    "llama",
    "winamp",
    "hooks",
    "state",
    "render",
    "diff"
  ];
  function playTetris(cols, rows, words, seed, maxBlocks) {
    const r = rng(seed);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const blocks = [];
    const clears = [];
    let t = 0.3;
    let total = 0;
    for (let n = 0; n < 70; n++) {
      const kindIndex = Math.floor(r() * PIECES.length);
      const kind = PIECES[kindIndex];
      const word = words[n % Math.max(1, words.length)] ?? "claude";
      let best = null;
      for (const cells of rotations(kind.cells)) {
        const w = Math.max(...cells.map((c) => c[0])) + 1;
        for (let x = 0; x + w <= cols; x++) {
          let y = -4;
          const fits = (yy) => cells.every(([cx, cy]) => yy + cy < rows && (yy + cy < 0 || !grid[yy + cy][x + cx]));
          if (!fits(y)) continue;
          while (fits(y + 1)) y++;
          if (cells.some(([, cy]) => y + cy < 0)) continue;
          const filled = cells.map(([cx, cy]) => [x + cx, y + cy]);
          const lines = [...new Set(filled.map((c) => c[1]))].filter(
            (row) => grid[row].every((b, col) => b || filled.some((c) => c[0] === col && c[1] === row))
          ).length;
          const isFull = (col, row) => !!grid[row][col] || filled.some((c) => c[0] === col && c[1] === row);
          let height = 0;
          let holes = 0;
          let bumps = 0;
          let last = -1;
          for (let col = 0; col < cols; col++) {
            let topRow = rows;
            for (let row = 0; row < rows; row++) if (isFull(col, row)) {
              topRow = row;
              break;
            }
            const colHeight = rows - topRow;
            for (let row = topRow + 1; row < rows; row++) if (!isFull(col, row)) holes++;
            height += colHeight;
            if (last >= 0) bumps += Math.abs(colHeight - last);
            last = colHeight;
          }
          const noise = t < SLOPPY_AFTER && blocks.length < maxBlocks * 0.6 ? 1.2 : 14;
          const score = lines * 8 - holes * 6 - height * 0.45 - bumps * 0.35 + r() * noise;
          if (!best || score > best.score) best = { cells, x, y, score };
        }
      }
      if (!best || blocks.length + 4 > maxBlocks) break;
      const h = Math.max(...best.cells.map((c) => c[1])) + 1;
      const fall = 0.22 + 0.055 * (best.y + h + 2);
      const chunk = Math.ceil(word.length / 4);
      const pieceBlocks = best.cells.map(([cx, cy], i) => {
        const b = {
          x: best.x + cx,
          from: cy - h - 1,
          land: best.y + cy,
          row: best.y + cy,
          text: word.slice(i * chunk, (i + 1) * chunk),
          color: kind.color,
          kind: kindIndex,
          born: t,
          landed: t + fall,
          moves: []
        };
        grid[b.row][b.x] = b;
        blocks.push(b);
        return b;
      });
      t += fall;
      const full = [...new Set(pieceBlocks.map((b) => b.row))].filter((row) => grid[row].every(Boolean)).sort((a, b) => a - b);
      if (full.length) {
        const at = t + 0.06;
        total += full.length;
        clears.push({ t: at, rows: full, total });
        for (const row of full) for (const b of grid[row]) if (b) b.died = { t: at, how: "clear" };
        const kept = grid.flat().filter((b) => !!b && !b.died);
        for (const row of grid) row.fill(null);
        for (const b of kept) {
          const drop = full.filter((fr) => fr > b.row).length;
          if (drop) {
            b.row += drop;
            b.moves.push({ t: at + 0.38, row: b.row });
          }
          grid[b.row][b.x] = b;
        }
        t = at + 0.6;
      }
      t += 0.1;
      if (grid[0].some(Boolean) || grid[1].some(Boolean)) break;
    }
    const over = t + 0.25;
    for (const b of blocks) if (!b.died) b.died = { t: over, how: "reset" };
    return { blocks, clears, over, length: over + 2.8 };
  }
  function tetris(deck, now) {
    for (const maxBlocks of [180, 120, 80, 48]) {
      const out = tetrisGame(deck, now, maxBlocks);
      if (out.length < 1e5) return out;
    }
    return "";
  }
  function tetrisGame(deck, now, maxBlocks) {
    const words = [...deck.lyric, ...deck.words.map(([w]) => w)].filter((w) => w.length >= 2);
    if (words.length < 8) words.push(...TETRIS_WORDS);
    const cols = Math.max(8, Math.min(14, Math.round((W - 40) / 42)));
    const cs = Math.min((W - 40) / cols, (STAGE_H - 24) / 9);
    const rows = Math.floor((STAGE_H - 24) / cs);
    const left = (W - cols * cs) / 2;
    const top = STAGE_TOP + (STAGE_H - rows * cs) / 2;
    const seed = deck.phase === "idle" || deck.phase === "finale" ? deck.beat * 31 : deck.turnStartedAt % 1e5;
    const game = playTetris(cols, rows, words, seed + 17, maxBlocks);
    const T = game.length;
    const pc = (t) => f(Math.min(100, Math.max(0, t / T * 100)));
    const delay = f(-((now - deck.turnStartedAt) / 1e3 % T));
    const r = rng(deck.turnStartedAt + 5);
    const cx = (x) => left + (x + 0.5) * cs;
    const cy = (row) => top + (row + 0.5) * cs;
    let defs = "<defs>";
    PIECES.forEach((p, k) => {
      defs += `<g id="tb${k}"><rect x="${f(-cs / 2 + 1)}" y="${f(-cs / 2 + 1)}" width="${f(cs - 2)}" height="${f(cs - 2)}" rx="${f(cs * 0.12)}" fill="${p.color}" fill-opacity=".88" stroke="#fff" stroke-opacity=".35"/><rect x="${f(-cs / 2 + 3)}" y="${f(-cs / 2 + 3)}" width="${f(cs - 6)}" height="${f(cs * 0.22)}" rx="${f(cs * 0.08)}" fill="#fff" fill-opacity=".22"/></g>`;
    });
    defs += "</defs>";
    let css = `.tb{font-family:${MONO};font-weight:700;fill:#0b0a14;text-anchor:middle}`;
    let cells = "";
    game.blocks.forEach((b, i) => {
      const y = (row) => `translateY(${f(cy(row))}px)`;
      const steps = Math.max(1, b.land - b.from);
      let k = `0%,${pc(b.born - 1e-3)}%{transform:${y(b.from)};opacity:0}`;
      k += `${pc(b.born)}%{transform:${y(b.from)};opacity:1;animation-timing-function:steps(${steps},end)}`;
      k += `${pc(b.landed)}%{transform:${y(b.land)}}`;
      let cur = b.land;
      for (const m of b.moves) {
        k += `${pc(m.t)}%{transform:${y(cur)}}${pc(m.t + 0.16)}%{transform:${y(m.row)}}`;
        cur = m.row;
      }
      const d = b.died;
      if (d.how === "clear") {
        k += `${pc(d.t)}%{transform:${y(cur)} scale(1);opacity:1;filter:none}`;
        k += `${pc(d.t + 0.1)}%{transform:${y(cur)} scale(1.15);filter:brightness(3)}`;
        k += `${pc(d.t + 0.36)}%{transform:${y(cur)} scale(1.7) rotate(${Math.round((r() - 0.5) * 60)}deg);opacity:0}`;
      } else {
        const ang = r() * Math.PI * 2;
        const dist = 140 + r() * 260;
        k += `${pc(d.t)}%{transform:translate(0,${f(cy(cur))}px) rotate(0);opacity:1;animation-timing-function:cubic-bezier(.1,.7,.3,1)}`;
        k += `${pc(d.t + 1.3)}%{transform:translate(${Math.round(Math.cos(ang) * dist)}px,${Math.round(cy(cur) + Math.sin(ang) * dist - 80)}px) rotate(${Math.round((r() - 0.5) * 720)}deg);opacity:0}`;
      }
      k += `100%{opacity:0}`;
      css += `@keyframes t${i}{${k}}`;
      const fs = Math.min(cs * 0.42, cs * 0.9 / Math.max(1, b.text.length * 0.62));
      cells += `<g transform="translate(${f(cx(b.x))} 0)"><g style="animation:t${i} ${f(T)}s linear ${delay}s infinite"><use href="#tb${b.kind}"/>` + (b.text ? `<text class="tb" y="${f(fs * 0.36)}" font-size="${f(fs)}">${esc(b.text)}</text>` : "") + `</g></g>`;
    });
    const NAMES = ["", "LINE!", "DOUBLE!", "TRIPLE!", "TETRIS!"];
    let fx = "";
    game.clears.forEach((c, i) => {
      css += `@keyframes s${i}{0%,${pc(c.t)}%{opacity:0;transform:scaleX(0)}${pc(c.t + 0.08)}%{opacity:.95;transform:scaleX(1)}${pc(c.t + 0.4)}%{opacity:0;transform:scaleX(1)}100%{opacity:0}}`;
      css += `@keyframes n${i}{0%,${pc(c.t)}%{opacity:0;transform:translateY(10px) scale(.6)}${pc(c.t + 0.12)}%{opacity:1;transform:translateY(0) scale(1.15)}${pc(c.t + 0.9)}%{opacity:0;transform:translateY(-24px) scale(1)}100%{opacity:0}}`;
      for (const row of c.rows)
        fx += `<rect x="${f(left)}" y="${f(top + row * cs)}" width="${f(cols * cs)}" height="${f(cs)}" fill="#fff" style="transform-origin:${f(W / 2)}px 0;animation:s${i} ${f(T)}s linear ${delay}s infinite"/>`;
      const label = NAMES[Math.min(4, c.rows.length)] ?? "LINES!";
      fx += `<text x="${f(W / 2)}" y="${f(top + Math.min(...c.rows) * cs - 6)}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="${f(c.rows.length >= 4 ? 30 : 20)}" fill="#fde68a" filter="url(#glow)" style="transform-origin:${f(W / 2)}px ${f(top + Math.min(...c.rows) * cs)}px;animation:n${i} ${f(T)}s ease-out ${delay}s infinite">${label}</text>`;
    });
    const marks = [{ t: 0, total: 0 }, ...game.clears.map((c) => ({ t: c.t, total: c.total }))];
    const lcd = marks.map((m, i) => {
      const end = marks[i + 1]?.t ?? game.over + 2.2;
      css += `@keyframes l${i}{0%{opacity:0}${pc(m.t)}%{opacity:0}${pc(m.t + 0.01)}%{opacity:1}${pc(end)}%{opacity:1}${pc(end + 0.01)}%{opacity:0}100%{opacity:0}}`;
      return `<text x="${f(left + cols * cs)}" y="${f(top - 6)}" text-anchor="end" font-family="${MONO}" font-size="10" letter-spacing="2" fill="#4ade80" style="animation:l${i} ${f(T)}s linear ${delay}s infinite">LINES ${String(m.total).padStart(3, "0")}</text>`;
    }).join("");
    const o = game.over;
    css += `@keyframes over{0%,${pc(o)}%{opacity:0;transform:scale(2.4)}${pc(o + 0.18)}%{opacity:1;transform:scale(1)}${pc(o + 1.9)}%{opacity:1;transform:scale(1)}${pc(o + 2.5)}%{opacity:0;transform:scale(.9)}100%{opacity:0}}`;
    css += `@keyframes coin{0%,${pc(o + 1)}%{opacity:0}${pc(o + 1.1)}%{opacity:1}${pc(o + 1.4)}%{opacity:.2}${pc(o + 1.7)}%{opacity:1}${pc(o + 2.5)}%{opacity:0}100%{opacity:0}}`;
    css += `@keyframes boom{0%,${pc(o)}%{opacity:0}${pc(o + 0.05)}%{opacity:.85}${pc(o + 0.7)}%{opacity:0}100%{opacity:0}}`;
    css += `@keyframes shake{0%,${pc(o)}%{transform:translate(0,0)}${pc(o + 0.05)}%{transform:translate(-6px,4px)}${pc(o + 0.1)}%{transform:translate(5px,-5px)}${pc(o + 0.15)}%{transform:translate(-4px,-3px)}${pc(o + 0.2)}%{transform:translate(3px,4px)}${pc(o + 0.3)}%{transform:translate(0,0)}100%{transform:translate(0,0)}}`;
    const midY = top + rows * cs / 2;
    const over = `<rect x="${f(left)}" y="${f(top)}" width="${f(cols * cs)}" height="${f(rows * cs)}" fill="#fff" style="animation:boom ${f(T)}s linear ${delay}s infinite"/><g style="transform-origin:${f(W / 2)}px ${f(midY)}px;animation:over ${f(T)}s cubic-bezier(.2,1.4,.4,1) ${delay}s infinite"><text x="${f(W / 2 + 3)}" y="${f(midY)}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="${f(Math.min(54, cols * cs / 5.2))}" fill="#22d3ee" opacity=".8">GAME OVER</text><text x="${f(W / 2 - 3)}" y="${f(midY)}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="${f(Math.min(54, cols * cs / 5.2))}" fill="#f43f5e" opacity=".8">GAME OVER</text><text x="${f(W / 2)}" y="${f(midY)}" text-anchor="middle" font-family="${SANS}" font-weight="900" font-size="${f(Math.min(54, cols * cs / 5.2))}" fill="#fff">GAME OVER</text></g><text x="${f(W / 2)}" y="${f(midY + 34)}" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="4" fill="#fde68a" style="animation:coin ${f(T)}s linear ${delay}s infinite">\u21BB INSERT COIN</text>`;
    let well = `<rect x="${f(left)}" y="${f(top)}" width="${f(cols * cs)}" height="${f(rows * cs)}" fill="#000" fill-opacity=".45" stroke="#2e2a4f"/>`;
    for (let x = 1; x < cols; x++) well += `<line x1="${f(left + x * cs)}" y1="${f(top)}" x2="${f(left + x * cs)}" y2="${f(top + rows * cs)}" stroke="#ffffff" stroke-opacity=".04"/>`;
    for (let y = 1; y < rows; y++) well += `<line x1="${f(left)}" y1="${f(top + y * cs)}" x2="${f(left + cols * cs)}" y2="${f(top + y * cs)}" stroke="#ffffff" stroke-opacity=".04"/>`;
    return `${defs}<style>${css}</style><g style="animation:shake ${f(T)}s linear ${delay}s infinite">${well}${lcd}
  <g>${cells}</g>${fx}${over}</g>`;
  }
  function wrap(text, width) {
    const out = [];
    let cur = "";
    for (const word of text.split(/\s+/)) {
      if (!word) continue;
      if ((cur + " " + word).trim().length > width && cur) {
        out.push(cur);
        cur = word;
      } else cur = (cur + " " + word).trim();
    }
    if (cur) out.push(cur);
    return out;
  }
  function finale(fin) {
    const fresh = fin.isFresh;
    const accent = fin.outcome === "answer" ? "#fde68a" : "#fb7185";
    const kicker = fin.outcome === "answer" ? "\u2726  TRACK COMPLETE  \u2726" : fin.outcome === "aborted" ? "\u2726  STOPPED  \u2726" : "\u2726  TRACK SKIPPED  \u2726";
    const t0 = fresh ? 0.9 : 0;
    let css = `@keyframes flash{0%{opacity:1}100%{opacity:0}}`;
    css += `@keyframes ring{from{r:4;opacity:.9;stroke-width:6}to{r:${Math.round(Math.max(W, H) * 0.9)};opacity:0;stroke-width:.5}}`;
    css += `@keyframes fall{from{transform:scaleY(1)}to{transform:scaleY(.02)}}`;
    css += `@keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`;
    css += `@keyframes rule{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
    css += `@keyframes shimmer{0%,100%{opacity:.75}50%{opacity:1}}`;
    let fx = "";
    if (fresh) {
      const r = rng(42);
      const base = STAGE_TOP + STAGE_H - 10;
      const n = Math.round((W - 32) / 11.8);
      for (let i = 0; i < n; i++) {
        const x = 16 + i * 11.8;
        const h = 40 + r() * 160;
        fx += `<rect x="${f(x)}" y="${f(base - h)}" width="9.4" height="${f(h)}" fill="url(#amp)" opacity=".5" style="transform-origin:${f(x)}px ${base}px;animation:fall .5s cubic-bezier(.6,0,.9,.4) ${f(0.15 + i * 0.018)}s both"/>`;
      }
      fx += [0, 0.18, 0.36].map((d) => `<circle cx="${W / 2}" cy="${f(STAGE_TOP + STAGE_H * 0.42)}" r="4" fill="none" stroke="${accent}" style="animation:ring 1.4s ease-out ${d}s both"/>`).join("");
    }
    const CARD = 360;
    const at = (i) => `animation:up .7s cubic-bezier(.2,.9,.3,1) ${f(t0 + i * 0.14)}s both`;
    const titleLines = wrap(fin.title, 20).slice(0, 2);
    const titleSize = titleLines.length > 1 ? 24 : 28;
    let y = STAGE_TOP + 46;
    let body = `<text x="${CARD / 2}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="10" letter-spacing="3" fill="${accent}" style="${at(0)}">${kicker}</text>`;
    y += 40;
    titleLines.forEach((l, i) => {
      body += `<text x="${CARD / 2}" y="${y}" text-anchor="middle" font-family="${SERIF}" font-style="italic" font-size="${titleSize}" fill="#f8fafc" filter="url(#glow)" style="${at(1 + i)};">${esc(l)}</text>`;
      y += titleSize + 6;
    });
    y += 2;
    body += `<rect x="${CARD / 2 - 50}" y="${y}" width="100" height="1" fill="${accent}" style="transform-origin:${CARD / 2}px ${y}px;animation:rule .8s ease-out ${f(t0 + 0.35)}s both"/>`;
    y += 28;
    let k = 3;
    for (const line of fin.lines.slice(0, 3)) {
      const rows = wrap(line, 44).slice(0, 3);
      rows.forEach((row, i) => {
        body += `<text x="34" y="${y}" font-family="${SANS}" font-size="12.5" fill="#cbd5e1" style="${at(k)}">${i === 0 ? `<tspan fill="${accent}">\u266A </tspan>` : '<tspan opacity="0">\u266A </tspan>'}${esc(row)}</text>`;
        y += 17;
      });
      y += 8;
      k++;
    }
    const tokens = fin.outputTokens >= 1e3 ? `${(fin.outputTokens / 1e3).toFixed(1)}k` : String(fin.outputTokens);
    const stats = [`\u23F1 ${clock(fin.durationMs)}`, `${tokens} tok`, `${fin.tools} tool${fin.tools === 1 ? "" : "s"}`];
    const sy = STAGE_TOP + 360 - 62;
    body += `<g style="${at(k++)}"><rect x="24" y="${sy - 16}" width="${CARD - 48}" height="24" rx="4" fill="#000" stroke="#1e293b"/>`;
    body += stats.map((s, i) => `<text x="${f(24 + (CARD - 48) / 3 * (i + 0.5))}" y="${sy}" text-anchor="middle" font-family="${MONO}" font-size="11" fill="#4ade80">${esc(s)}</text>`).join("");
    body += `</g>`;
    let cx = 24;
    const cy = sy + 22;
    let chips = "";
    for (const word of fin.topWords.slice(0, 5)) {
      const w = word.length * 6.4 + 16;
      if (cx + w > CARD - 24) break;
      chips += `<rect x="${f(cx)}" y="${cy}" width="${f(w)}" height="18" rx="9" fill="none" stroke="#475569"/><text x="${f(cx + w / 2)}" y="${cy + 12.5}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="#94a3b8">${esc(word)}</text>`;
      cx += w + 6;
    }
    body += `<g style="${at(k)}">${chips}</g>`;
    const ox = (W - CARD) / 2;
    const oy = Math.max(0, (STAGE_H - 360) / 2);
    return `<style>${css}</style>${fx}<g transform="translate(${f(ox)} ${f(oy)})"><g style="animation:shimmer 5s ease-in-out ${f(t0 + 1.5)}s infinite">${body}</g></g>`;
  }
  return __toCommonJS(scenes_exports);
})();
