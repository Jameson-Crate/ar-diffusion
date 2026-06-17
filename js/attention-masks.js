/* Demo 4 — attention structure across the lineage (centerpiece, animated).
   A "read head" sweeps down the frames: the current query frame lights up its
   visible keys and pulls information along glowing edges into itself. The same
   animation makes each mode legible in motion — bidirectional gathers from both
   past AND future, causal only from the past, and the rolling window visibly
   tracks the cursor. */
(function () {
  const root = document.getElementById("demo-attention");
  if (!root) return;
  const B = window.Blog, C = B.C;
  const T = 12;
  const MODES = ["Bidirectional", "Causal", "Diffusion Forcing", "Rolling window + sinks"];
  let mode = 0, win = 4, sinks = 2, hover = null;
  let playing = !B.reduced;
  let pos = 0;                 // animated query cursor in [0, T)
  let clock = 0, lastEl = 0;
  const SPEED = 1.5;           // frames generated per second
  const HOLD = 1.3;            // seconds paused at the bottom before looping
  const CYCLE = T / SPEED + HOLD;

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
  function isSink(i, j) { return mode === 3 && j < sinks && !(j <= i && j > i - win); }
  function smooth(t) { t = B.clamp(t, 0, 1); return t * t * (3 - 2 * t); }

  // ---- DOM ----
  const segRight = B.segmented(MODES, (i) => { mode = i; sub(); draw(); }, 0);
  root.appendChild(B.head("Figure 3 · Attention structure", segRight.wrap));
  const cv = B.canvas(root, 1.85, { onResize: () => draw() });
  const ctrls = B.controls();
  const slW = B.slider({ label: "window  w (rolling)", min: 2, max: 6, step: 1, value: 4, fmt: v => v + " frames", oninput: v => { win = v; draw(); } });
  const slK = B.slider({ label: "sink frames (rolling)", min: 0, max: 3, step: 1, value: 2, fmt: v => v, oninput: v => { sinks = v; draw(); } });
  const playBtn = B.el("button", { class: "btn", text: "⏸ pause", onclick: () => { playing = !playing; playBtn.textContent = playing ? "⏸ pause" : "▶ play"; } });
  ctrls.appendChild(slW.wrap); ctrls.appendChild(slK.wrap);
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "0 0 auto" } }, [B.el("label", { html: "<span>read head</span>" }), playBtn]));
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

  // shared geometry (kept identical between draw + hit-testing)
  function geom() {
    const w = cv.w, h = cv.h, pad = 10;
    const noiseH = mode === 2 ? 16 : 0;
    const labelL = 92, labelT = 30 + noiseH;
    const S = Math.min(h - labelT - pad - 18, (w - labelL - pad) * 0.78);
    return { w, h, pad, noiseH, labelL, labelT, S, ox: labelL, oy: labelT, cell: S / T };
  }

  function draw() {
    const ctx = cv.ctx, g = geom(), { ox, oy, cell, S, noiseH, w, h } = g;
    const live = performance.now() / 1000;
    // animation phase: live while hovering, otherwise tied to `clock` (which only
    // advances while playing) so Pause freezes the pulse and packets completely.
    const phase = hover ? live : clock;
    B.clear(ctx, w, h, C.panel);

    // which query frame is the read head on, and how far through gathering it is
    const cursor = hover ? hover.i : (pos < T ? Math.floor(pos) : -1);
    const rowProg = hover ? ((live * 0.8) % 1) : smooth(pos - Math.floor(pos));
    const reveal = mode !== 0;                 // causal family reveals frames top→bottom

    // axis labels
    ctx.fillStyle = C.muted; ctx.font = "600 12px system-ui"; ctx.textAlign = "center";
    ctx.fillText("key frame  j   (history →)", ox + S / 2, oy - 8 - noiseH);
    ctx.save(); ctx.translate(ox - 64, oy + S / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("query frame  i  (current ↓)", 0, 0); ctx.restore();

    // diffusion-forcing noise strip over columns
    if (mode === 2) {
      for (let j = 0; j < T; j++) {
        ctx.fillStyle = noiseColor(kpat[j]); ctx.fillRect(ox + j * cell, oy - noiseH - 2, cell - 1, noiseH - 2);
      }
      ctx.fillStyle = C.faint; ctx.font = "10px system-ui"; ctx.textAlign = "left";
      ctx.fillText("noise kⱼ:", ox - 58, oy - noiseH + 8);
    }

    // ---- grid ----
    for (let i = 0; i < T; i++) {
      const future = reveal && cursor >= 0 && i > cursor;   // not generated yet
      const onHead = i === cursor;
      for (let j = 0; j < T; j++) {
        const x = ox + j * cell, y = oy + i * cell, on = active(i, j);
        if (on) {
          let a = 0.82;
          if (future) a = 0.12;                              // dim un-generated rows
          else if (onHead) a = 1;                            // current frame fully lit
          else if (cursor >= 0) a = 0.6;                     // already-generated rows settle back
          ctx.fillStyle = isSink(i, j) ? C.accent2 : C.accent;
          ctx.globalAlpha = a; ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1); ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "#fff"; ctx.fillRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }
        if (i === j) { ctx.strokeStyle = "#222"; ctx.lineWidth = 1.2; ctx.strokeRect(x + 0.8, y + 0.8, cell - 1.6, cell - 1.6); }
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, cell, cell);
      }
    }

    // ---- read head: current query frame gathering from its visible keys ----
    if (cursor >= 0 && !B.reduced) {
      const cy = oy + cursor * cell, dcx = ox + cursor * cell + cell / 2, dcy = cy + cell / 2;
      // row band
      ctx.fillStyle = "rgba(196,80,42,0.07)"; ctx.fillRect(ox, cy, S, cell);
      // left marker (the frame being generated)
      ctx.fillStyle = C.accent; ctx.beginPath();
      ctx.moveTo(ox - 16, dcy - 5); ctx.lineTo(ox - 7, dcy); ctx.lineTo(ox - 16, dcy + 5); ctx.closePath(); ctx.fill();
      // glowing edges + travelling info packets from each visible key into the current frame
      for (let j = 0; j < T; j++) {
        if (j === cursor || !active(cursor, j)) continue;
        const kx = ox + j * cell + cell / 2;
        const col = isSink(cursor, j) ? C.accent2 : C.accent;
        ctx.strokeStyle = col; ctx.globalAlpha = 0.22; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(kx, dcy); ctx.lineTo(dcx, dcy); ctx.stroke(); ctx.globalAlpha = 1;
        const px = B.lerp(kx, dcx, rowProg);
        ctx.fillStyle = col; ctx.globalAlpha = 0.85 * (1 - 0.25 * rowProg);
        ctx.beginPath(); ctx.arc(px, dcy, 2.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      }
      // pulsing self-cell (the frame writing its own token)
      const pr = 1 + 0.18 * Math.sin(phase * 6);
      ctx.strokeStyle = C.accent; ctx.lineWidth = 2.2;
      ctx.strokeRect(dcx - cell / 2 * pr + 0.5, dcy - cell / 2 * pr + 0.5, cell * pr - 1, cell * pr - 1);
    }

    // hover crosshair (overrides while pointer is on the grid)
    if (hover) {
      const { i, j } = hover;
      ctx.strokeStyle = "#1c1b19"; ctx.lineWidth = 2;
      ctx.strokeRect(ox + 0.5, oy + i * cell + 0.5, S, cell);
      ctx.strokeRect(ox + j * cell + 0.5, oy + 0.5, cell, S);
    }

    // ---- readout ----
    let cnt = 0; for (let i = 0; i < T; i++) for (let j = 0; j < T; j++) if (active(i, j)) cnt++;
    const cost = ["O(T²) — dense, no causal seam", "O(T²) compute · O(T) cached decode", "O(T²) cached · per-frame noise kₜ", "O(T·w) — bounded window + sinks"][mode];
    let line2;
    if (hover) {
      line2 = active(hover.i, hover.j)
        ? "frame <b>" + hover.i + "</b> ATTENDS TO frame <b>" + hover.j + "</b>" + (isSink(hover.i, hover.j) ? " (sink)" : "")
        : "frame " + hover.i + " is masked from frame " + hover.j;
    } else if (cursor >= 0) {
      let deg = 0; for (let j = 0; j < T; j++) if (active(cursor, j)) deg++;
      line2 = "▶ generating frame <b>" + cursor + "</b> — reads <span class='hl'>" + deg + "</span> visible frame" + (deg === 1 ? "" : "s");
    } else {
      line2 = "hover a cell to inspect, or press play to watch the read head";
    }
    out.innerHTML = "<b>" + MODES[mode] + "</b> &nbsp;·&nbsp; active edges: <span class='hl'>" + cnt + "</span> / " + (T * T) +
      " &nbsp;·&nbsp; cost: <span class='hl2'>" + cost + "</span><br>" + line2;
  }

  function noiseColor(k) { // clean(dark teal) -> noisy(pale)
    const r = Math.round(B.lerp(47, 235, k)), g = Math.round(B.lerp(111, 228, k)), b = Math.round(B.lerp(151, 232, k));
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  cv.cv.addEventListener("mousemove", e => {
    const rect = cv.cv.getBoundingClientRect();
    const mx = (e.clientX - rect.left), my = (e.clientY - rect.top);
    const g = geom();
    const j = Math.floor((mx - g.ox) / g.cell), i = Math.floor((my - g.oy) / g.cell);
    hover = (i >= 0 && i < T && j >= 0 && j < T) ? { i, j } : null;
    if (B.reduced) draw();
  });
  cv.cv.addEventListener("mouseleave", () => { hover = null; if (B.reduced) draw(); });

  sub();
  if (B.reduced) { pos = -1; draw(); }
  else {
    B.visibleLoop(root, (elapsed) => {
      if (elapsed < lastEl) lastEl = elapsed;      // loop restarted after going off-screen
      const dt = Math.min(0.05, elapsed - lastEl); lastEl = elapsed;
      if (playing && !hover) {
        clock += dt;
        const tt = clock % CYCLE;
        pos = tt < T / SPEED ? tt * SPEED : T;     // sweep, then park at the bottom during HOLD
      }
      draw();
    });
  }
})();
