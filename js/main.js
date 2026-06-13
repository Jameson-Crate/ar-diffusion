/* main.js — KaTeX rendering, TOC/scroll chrome, and shared demo utilities. */

window.Blog = (function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // shared palette (mirrors styles.css)
  const C = {
    bg: "#ffffff", panel: "#fcfaf6", fg: "#1c1b19", muted: "#6c6760", faint: "#97918a",
    rule: "#e7e2d9", grid: "#efeae1", accent: "#c4502a", accent2: "#2f6f97",
    accent3: "#6b8e3d", bad: "#c0392b", good: "#3f8f4f", warn: "#d89b30",
    ink: "#2a2824"
  };

  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.startsWith("on") && typeof attrs[k] === "function") n.addEventListener(k.slice(2), attrs[k]);
      else if (k === "style" && typeof attrs[k] === "object") Object.assign(n.style, attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(c => {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }

  // Hi-DPI canvas that tracks its container width at a fixed aspect ratio.
  function canvas(container, ratio, opts) {
    opts = opts || {};
    const cv = el("canvas");
    container.appendChild(cv);
    const ctx = cv.getContext("2d");
    const api = { cv, ctx, w: 0, h: 0, dpr: 1, ratio };
    let inited = false; // suppress onResize during the caller's TDZ window (resize() runs synchronously here)
    function resize() {
      const cssW = Math.max(120, container.clientWidth || cv.clientWidth || 320);
      const cssH = opts.height ? opts.height : Math.round(cssW / ratio);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      cv.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.w = cssW; api.h = cssH; api.dpr = dpr;
      if (opts.onResize && inited) { try { opts.onResize(api); } catch (e) { /* caller not ready yet; its own first paint will cover it */ } }
    }
    resize();        // size the canvas now; do NOT notify (caller's vars may be in TDZ)
    inited = true;
    const ro = new ResizeObserver(() => resize());  // fires an initial async callback -> safe onResize
    ro.observe(container);
    api.resize = resize;
    return api;
  }

  // rAF loop gated by visibility; respects reduced-motion (runs one frame then stops).
  function visibleLoop(container, step) {
    let running = false, raf = 0, t0 = performance.now();
    function frame(now) {
      if (!running) return;
      step((now - t0) / 1000, now);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running) return;
      running = true; t0 = performance.now();
      if (reduced) { step(0, performance.now()); running = false; return; }
      raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) start(); else { running = false; cancelAnimationFrame(raf); } });
    }, { threshold: 0.04 });
    io.observe(container);
    return { stop() { running = false; cancelAnimationFrame(raf); io.disconnect(); }, get running() { return running; } };
  }

  // run cb once the element first becomes visible (for static draws)
  function onVisibleOnce(node, cb) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { cb(); io.disconnect(); } });
    }, { threshold: 0.04 });
    io.observe(node);
  }

  // ---- small drawing helpers ----
  function clear(ctx, w, h, color) { ctx.clearRect(0, 0, w, h); if (color) { ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); } }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
  // deterministic gaussian via Box-Muller with a seeded PRNG
  function mulberry32(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function gaussPair(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); const m = Math.sqrt(-2 * Math.log(u)); return [m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)]; }

  function arrow(ctx, x0, y0, x1, y1, head) {
    head = head || 4;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5));
    ctx.lineTo(x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5));
    ctx.closePath(); ctx.fill();
  }

  // small reusable control builders
  function slider(opts) {
    const wrap = el("div", { class: "control" });
    const lab = el("label", {}, [el("span", { text: opts.label }), el("span", { class: "val" })]);
    const valSpan = lab.querySelector(".val");
    const input = el("input", { type: "range", min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value });
    function fmt(v) { return opts.fmt ? opts.fmt(v) : v; }
    // fire=false on initial/label-only updates so we never call oninput while the caller's
    // later consts are still in their temporal dead zone. User input and programmatic sets fire.
    function update(fire) { valSpan.textContent = fmt(parseFloat(input.value)); if (fire && opts.oninput) opts.oninput(parseFloat(input.value)); }
    input.addEventListener("input", () => update(true));
    wrap.appendChild(lab); wrap.appendChild(input);
    update(false);
    return { wrap, input, get value() { return parseFloat(input.value); }, set value(v) { input.value = v; update(true); } };
  }

  function segmented(options, onpick, initial) {
    const wrap = el("div", { class: "seg" });
    let cur = initial || 0;
    const btns = options.map((o, i) => {
      const b = el("button", { text: o, class: i === cur ? "active" : "" });
      b.addEventListener("click", () => { cur = i; btns.forEach((x, j) => x.classList.toggle("active", j === cur)); onpick(i, o); });
      wrap.appendChild(b); return b;
    });
    return { wrap, get index() { return cur; }, set index(i) { btns[i].click(); } };
  }

  function toggle(label, checked, onchange) {
    const input = el("input", { type: "checkbox" });
    input.checked = !!checked;
    const lab = el("label", { class: "toggle" }, [input, el("span", { class: "track" }), el("span", { text: label })]);
    input.addEventListener("change", () => onchange(input.checked));
    return { wrap: lab, input, get checked() { return input.checked; } };
  }

  function controls() { return el("div", { class: "controls" }); }
  function head(title, right) {
    const h = el("div", { class: "demo-head" }, [el("div", { class: "demo-title", text: title })]);
    if (right) h.appendChild(right);
    return h;
  }
  function readout() { return el("div", { class: "readout" }); }

  return {
    reduced, C, el, canvas, visibleLoop, onVisibleOnce,
    clear, lerp, clamp, mulberry32, gaussPair, arrow,
    slider, segmented, toggle, controls, head, readout
  };
})();

/* ---------- page chrome: math, TOC, progress ---------- */
document.addEventListener("DOMContentLoaded", function () {
  // KaTeX
  if (window.renderMathInElement) {
    renderMathInElement(document.querySelector("main.article"), {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }

  // scroll progress
  const bar = document.getElementById("progress");
  const toc = document.getElementById("toc");
  const links = toc ? Array.from(toc.querySelectorAll("a")) : [];
  const targets = links.map(a => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);

  function onScroll() {
    const sTop = window.scrollY || document.documentElement.scrollTop;
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (docH > 0 ? (sTop / docH) * 100 : 0) + "%";
    // active section
    let active = 0;
    for (let i = 0; i < targets.length; i++) {
      if (targets[i].getBoundingClientRect().top - 120 <= 0) active = i;
    }
    links.forEach((a, i) => a.classList.toggle("active", i === active));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
});
