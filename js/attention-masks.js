/* Demo 4 — attention structure across the lineage (centerpiece). */
(function () {
  const root = document.getElementById("demo-attention");
  if (!root) return;
  const B = window.Blog, C = B.C;
  const T = 12;
  const MODES = ["Bidirectional", "Causal", "Diffusion Forcing", "Rolling window + sinks"];
  let mode = 0, win = 4, sinks = 2, hover = null;

  // fixed per-frame noise levels for diffusion-forcing view
  const rnd = B.mulberry32(5), kpat = [];
  for (let i = 0; i < T; i++) kpat.push(0.15 + 0.7 * rnd());

  function active(i, j) { // query i attends to key j?
    switch (mode) {
      case 0: return true;
      case 1: return j <= i;
      case 2: return j <= i;                    // causal; difference is per-frame noise
      case 3: return (j <= i && j > i - win) || j < sinks;
    }
  }

  // ---- DOM ----
  const segRight = B.segmented(MODES, (i) => { mode = i; sub(); draw(); }, 0);
  root.appendChild(B.head("Figure 3 · Attention structure", segRight.wrap));
  const cv = B.canvas(root, 1.85, { onResize: () => draw() });
  const ctrls = B.controls();
  const slW = B.slider({ label: "window  w (rolling)", min: 2, max: 6, step: 1, value: 4, fmt: v => v + " frames", oninput: v => { win = v; draw(); } });
  const slK = B.slider({ label: "sink frames (rolling)", min: 0, max: 3, step: 1, value: 2, fmt: v => v, oninput: v => { sinks = v; draw(); } });
  ctrls.appendChild(slW.wrap); ctrls.appendChild(slK.wrap);
  root.appendChild(ctrls);
  const out = B.readout();
  root.appendChild(out);
  const sublabel = B.el("div", { class: "legend" }); root.appendChild(sublabel);

  function sub() {
    const txt = [
      "Dense: every frame attends to every frame, incl. the future. No causal seam → can't stream or react.",
      "Lower-triangular: each frame attends only to itself and the past → KV-cacheable, O(T) incremental decode.",
      "Causal mask + an independent noise level kₜ per frame (top strip). History can be partially noised at inference.",
      "Each frame attends to a fixed local window AND a few pinned 'sink' frames (StreamingLLM) → O(T·w), constant per-step cost."
    ][mode];
    sublabel.innerHTML = "<span style='font-family:var(--sans);font-size:12.5px;color:var(--muted)'>" + txt + "</span>";
  }

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h, pad = 10;
    B.clear(ctx, w, h, C.panel);
    const noiseH = mode === 2 ? 16 : 0;
    const labelL = 92, labelT = 30 + noiseH;
    const S = Math.min(h - labelT - pad - 18, (w - labelL - pad) * 0.78);
    const ox = labelL, oy = labelT, cell = S / T;

    // axis labels
    ctx.fillStyle = C.muted; ctx.font = "600 12px system-ui"; ctx.textAlign = "center";
    ctx.fillText("key frame  j   (history →)", ox + S / 2, oy - 8 - noiseH);
    ctx.save(); ctx.translate(ox - 64, oy + S / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("query frame  i  (current ↓)", 0, 0); ctx.restore();

    // diffusion-forcing noise strip over columns
    if (mode === 2) {
      for (let j = 0; j < T; j++) {
        const k = kpat[j], col = noiseColor(k);
        ctx.fillStyle = col; ctx.fillRect(ox + j * cell, oy - noiseH - 2, cell - 1, noiseH - 2);
      }
      ctx.fillStyle = C.faint; ctx.font = "10px system-ui"; ctx.textAlign = "left";
      ctx.fillText("noise kⱼ:", ox - 58, oy - noiseH + 8);
    }

    // grid
    for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) {
      const x = ox + j * cell, y = oy + i * cell, on = active(i, j);
      if (on) {
        let a = 0.85;
        if (mode === 3 && j < sinks && !(j <= i && j > i - win)) { ctx.fillStyle = C.accent2; a = 0.8; } // sink
        else ctx.fillStyle = C.accent;
        ctx.globalAlpha = a; ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1); ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = "#fff"; ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
      if (i === j) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.8, y + 0.8, cell - 1.6, cell - 1.6); }
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
    }
    // hover highlight
    if (hover) {
      const { i, j } = hover;
      ctx.strokeStyle = "#1c1b19"; ctx.lineWidth = 2;
      ctx.strokeRect(ox + 0.5, oy + i * cell + 0.5, S, cell); // row
      ctx.strokeRect(ox + j * cell + 0.5, oy + 0.5, cell, S);  // col
    }

    // count + cost
    let cnt = 0; for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) if (active(i, j)) cnt++;
    const cost = ["O(T²) — dense, no causal seam", "O(T²) compute · O(T) cached decode", "O(T²) cached · per-frame noise kₜ", "O(T·w) — bounded window + sinks"][mode];
    let hv = hover ? (active(hover.i, hover.j)
      ? "frame <b>" + hover.i + "</b> ATTENDS TO frame <b>" + hover.j + "</b>" + (hover.j < sinks && mode === 3 ? " (sink)" : "")
      : "frame " + hover.i + " is masked from frame " + hover.j) : "hover a cell to inspect";
    out.innerHTML = "<b>" + MODES[mode] + "</b> &nbsp;·&nbsp; active edges: <span class='hl'>" + cnt + "</span> / " + (T * T) +
      " &nbsp;·&nbsp; cost: <span class='hl2'>" + cost + "</span><br>" + hv;
  }
  function noiseColor(k) { // clean(dark teal) -> noisy(pale)
    const r = Math.round(B.lerp(47, 235, k)), g = Math.round(B.lerp(111, 228, k)), b = Math.round(B.lerp(151, 232, k));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  cv.cv.addEventListener("mousemove", e => {
    const rect = cv.cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
    const noiseH = mode === 2 ? 16 : 0, labelL = 92, labelT = 30 + noiseH, pad = 10;
    const S = Math.min(cv.h - labelT - pad - 18, (cv.w - labelL - pad) * 0.78);
    const ox = labelL, oy = labelT, cell = S / T;
    const j = Math.floor((mx - ox) / cell), i = Math.floor((my - oy) / cell);
    hover = (i >= 0 && i < T && j >= 0 && j < T) ? { i, j } : null;
    draw();
  });
  cv.cv.addEventListener("mouseleave", () => { hover = null; draw(); });

  sub();
  B.onVisibleOnce(root, draw);
})();
