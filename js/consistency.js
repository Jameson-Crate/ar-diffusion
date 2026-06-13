/* Demo 9 — schematic look-away/look-back spatial consistency test. */
(function () {
  const root = document.getElementById("demo-consistency");
  if (!root) return;
  const B = window.Blog, C = B.C;
  const rnd = B.mulberry32(33);

  const SPAN = 2.0, WIN = 0.42, FORGET = 0.62;
  const L = [];
  for (let i = 0; i < 16; i++) {
    const p = (i + 0.5) / 16 * SPAN;
    L.push({ p, mem: rndAttr(), no: rndAttr(), inMem: true });
  }
  function rndAttr() {
    const hue = Math.floor(rnd() * 360);
    return { hue, h: 0.4 + rnd() * 0.5, type: rnd() < 0.5 ? "build" : "tree", w: 0.5 + rnd() * 0.5 };
  }
  function resample(a) { a.hue = Math.floor(rnd() * 360); a.h = 0.4 + rnd() * 0.5; a.type = rnd() < 0.5 ? "build" : "tree"; a.w = 0.5 + rnd() * 0.5; }

  let center = WIN / 2; // camera center in [0,SPAN]
  function updateMemory() {
    for (const lm of L) {
      let d = Math.abs(lm.p - center); d = Math.min(d, SPAN - d);
      const visible = d <= WIN / 2;
      if (d > FORGET) lm.inMem = false;              // forgotten while looked away
      if (visible && !lm.inMem) { resample(lm.no); lm.inMem = true; } // resampled on re-entry (no-memory only)
      if (visible) lm.inMem = true;
    }
  }

  root.appendChild(B.head("Figure 5 · Look away, look back"));
  const cv = B.canvas(root, 2.0, { onResize: () => draw() });
  const ctrls = B.controls();
  const slP = B.slider({ label: "camera pan", min: 0, max: 1000, step: 1, value: Math.round((center / SPAN) * 1000), fmt: v => "θ = " + (v / 1000).toFixed(2), oninput: v => { center = (v / 1000) * SPAN; updateMemory(); draw(); } });
  const btn = B.el("button", { class: "btn primary", text: "↪ look away & back", onclick: () => sweep() });
  ctrls.appendChild(slP.wrap);
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "0 0 auto" } }, [B.el("label", { html: "<span>&nbsp;</span>" }), btn]));
  root.appendChild(ctrls);
  const out = B.readout();
  root.appendChild(out);

  function viewPanel(y, ph, attrSel, ok, title) {
    const ctx = cv.ctx, w = cv.w, padL = 12, vw = w - 24;
    // sky/ground
    const g = ctx.createLinearGradient(0, y, 0, y + ph * 0.7);
    g.addColorStop(0, "#bfe0f2"); g.addColorStop(1, "#eaf6fb"); ctx.fillStyle = g; ctx.fillRect(padL, y, vw, ph);
    ctx.fillStyle = "#cdbb94"; ctx.fillRect(padL, y + ph * 0.72, vw, ph * 0.28);
    ctx.save(); ctx.beginPath(); ctx.rect(padL, y, vw, ph); ctx.clip();
    // landmarks within window
    for (const lm of L) for (const off of [-SPAN, 0, SPAN]) {
      const rel = (lm.p + off) - center; if (Math.abs(rel) > WIN / 2 + 0.05) continue;
      const a = attrSel(lm);
      const x = padL + vw * (0.5 + rel / WIN);
      const bh = ph * 0.62 * a.h, bw = vw * 0.10 * a.w, gy = y + ph * 0.72;
      ctx.fillStyle = "hsl(" + a.hue + ",55%,55%)";
      if (a.type === "build") { ctx.fillRect(x - bw / 2, gy - bh, bw, bh); ctx.fillStyle = "hsl(" + a.hue + ",55%,70%)"; for (let r = 0; r < 3; r++) for (let cc = 0; cc < 2; cc++) ctx.fillRect(x - bw / 2 + 3 + cc * (bw / 2), gy - bh + 4 + r * (bh / 3.4), bw / 5, bh / 6); }
      else { ctx.beginPath(); ctx.moveTo(x, gy - bh); ctx.lineTo(x - bw / 2, gy); ctx.lineTo(x + bw / 2, gy); ctx.closePath(); ctx.fill(); ctx.fillStyle = "#7a5230"; ctx.fillRect(x - bw * 0.08, gy, bw * 0.16, ph * 0.08); }
    }
    ctx.restore();
    ctx.strokeStyle = ok ? C.good : C.bad; ctx.lineWidth = 2; ctx.strokeRect(padL, y, vw, ph);
    ctx.fillStyle = ok ? C.good : C.bad; ctx.font = "700 12px system-ui"; ctx.textAlign = "left";
    ctx.fillText(title, padL + 8, y + 16);
  }

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h; B.clear(ctx, w, h, C.panel);
    const ph = (h - 30 - 16) / 2;
    viewPanel(6, ph, lm => lm.mem, true, "KV memory  ✓  consistent on return");
    viewPanel(6 + ph + 8, ph, lm => lm.no, false, "no memory  ✗  resampled on return");
    // minimap
    const my = h - 12, mx = 12, mw = w - 24;
    ctx.fillStyle = "#e7e2d9"; ctx.fillRect(mx, my, mw, 6);
    for (const lm of L) { ctx.fillStyle = lm.inMem ? C.good : "#c9c3b8"; ctx.fillRect(mx + (lm.p / SPAN) * mw - 1, my - 1, 2, 8); }
    const c0 = mx + ((center - WIN / 2) / SPAN) * mw, c1 = mx + ((center + WIN / 2) / SPAN) * mw;
    ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.strokeRect(c0, my - 2, c1 - c0, 10);

    const forgotten = L.filter(l => !l.inMem).length;
    out.innerHTML = "camera window covers a slice of the panorama; <span class='hl'>" + forgotten + "</span> landmarks currently out of memory. " +
      "Pan past θ-distance " + FORGET.toFixed(2) + " and back: the <b>no-memory</b> scene regenerates differently; <b>KV memory</b> restores it.";
  }

  let anim = null;
  function sweep() {
    if (anim) cancelAnimationFrame(anim);
    if (B.reduced) return;
    const start = center, far = (center + 1.1) % SPAN, t0 = performance.now(), dur = 2600;
    function step(now) {
      const u = B.clamp((now - t0) / dur, 0, 1);
      const phase = u < 0.5 ? u * 2 : (1 - u) * 2;       // out then back
      center = (start + phase * 1.1) % SPAN;
      slP.value = Math.round((center / SPAN) * 1000); updateMemory(); draw();
      if (u < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }

  updateMemory();
  B.onVisibleOnce(root, draw);
})();
