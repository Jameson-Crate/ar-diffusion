/* Demo 2 — flow matching: marginal velocity field + few-step Euler sampling.
   The field v(x,t)=E[x1-x0 | x_t=x] is computed exactly for a Gaussian source
   and an empirical ring target, so few-step integration error is genuine. */
(function () {
  const root = document.getElementById("demo-flow");
  if (!root) return;
  const B = window.Blog, C = B.C;
  const rnd = B.mulberry32(21);

  // target distribution: a ring (the "data manifold")
  const M = 46, Yx = [], Yy = [];
  for (let j = 0; j < M; j++) {
    const a = (j / M) * Math.PI * 2;
    const r = 0.92 + (rnd() - 0.5) * 0.06;
    Yx.push(Math.cos(a) * r); Yy.push(Math.sin(a) * r * 0.85);
  }
  // source samples x0 ~ N(0,I)
  const P = 90, X0 = [];
  for (let i = 0; i < P; i++) { const g = B.gaussPair(rnd); X0.push([g[0] * 0.5, g[1] * 0.5]); }

  // exact marginal velocity field
  function vfield(x, y, t) {
    t = B.clamp(t, 0, 0.985); const omt = 1 - t;
    let m = -1e9; const q = new Float64Array(M), ox = new Float64Array(M), oy = new Float64Array(M);
    for (let j = 0; j < M; j++) {
      const x0x = (x - t * Yx[j]) / omt, x0y = (y - t * Yy[j]) / omt;
      ox[j] = x0x; oy[j] = x0y;
      const qq = -(x0x * x0x + x0y * x0y) / 2; q[j] = qq; if (qq > m) m = qq;
    }
    let sum = 0; for (let j = 0; j < M; j++) { q[j] = Math.exp(q[j] - m); sum += q[j]; }
    let vx = 0, vy = 0;
    for (let j = 0; j < M; j++) { const w = q[j] / sum; vx += w * (Yx[j] - ox[j]); vy += w * (Yy[j] - oy[j]); }
    return [vx, vy];
  }

  // precompute Euler trajectories for N steps
  let N = 6, trajs = [];
  function build() {
    trajs = X0.map(p => {
      const tr = [[p[0], p[1]]]; let x = p[0], y = p[1];
      for (let s = 0; s < N; s++) { const t = s / N, v = vfield(x, y, t); x += v[0] / N; y += v[1] / N; tr.push([x, y]); }
      return tr;
    });
  }

  // ---- DOM ----
  root.appendChild(B.head("Figure 2 · Velocity field & few-step transport"));
  const cv = B.canvas(root, 2.3, { onResize: () => draw(lastU) });
  const ctrls = B.controls();
  const slN = B.slider({ label: "Euler steps  N", min: 3, max: 40, step: 1, value: 6, fmt: v => v + " steps", oninput: v => { N = v; build(); } });
  let showField = true, paused = false;
  const tgl = B.toggle("show field", true, v => { showField = v; });
  const playBtn = B.el("button", { class: "btn", text: "⏸ pause", onclick: () => { paused = !paused; playBtn.textContent = paused ? "▶ play" : "⏸ pause"; } });
  ctrls.appendChild(slN.wrap);
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "0 0 auto" } }, [B.el("label", { html: "<span>options</span>" }), B.el("div", { style: { display: "flex", gap: "12px", alignItems: "center" } }, [tgl.wrap, playBtn])]));
  root.appendChild(ctrls);
  const out = B.readout();
  root.appendChild(out);
  root.appendChild(B.el("div", { class: "legend" }, [
    leg(C.accent2, "source  x₀ ~ 𝒩(0,I)"), leg(C.accent, "target manifold  p_data"),
    leg(C.good, "particle path (ODE)"), leg("#bbb", "velocity field v(x,t)")
  ]));
  function leg(c, t) { return B.el("span", {}, [B.el("span", { class: "swatch", style: { background: c } }), t]); }

  build();
  let u = 0, lastU = 0, holdT = 0;
  const span = 1.7;
  function X(x, w) { return w / 2 + x / span * (w * 0.42); }
  function Y(y, h) { return h / 2 - y / span * (h * 0.42); }

  function draw(uu) {
    lastU = uu;
    const ctx = cv.ctx, w = cv.w, h = cv.h;
    B.clear(ctx, w, h, C.panel);
    ctx.strokeStyle = C.rule; ctx.strokeRect(8, 8, w - 16, h - 16);
    const t = B.clamp(uu, 0, 1);

    // field arrows
    if (showField) {
      const gx = 13, gy = 8;
      ctx.lineWidth = 1; ctx.strokeStyle = "#cfcabf"; ctx.fillStyle = "#cfcabf";
      for (let i = 1; i < gx; i++) for (let j = 1; j < gy; j++) {
        const xx = -span + (2 * span) * i / gx, yy = -span + (2 * span) * j / gy;
        const v = vfield(xx, yy, t); const mag = Math.hypot(v[0], v[1]) || 1e-6;
        const sc = 0.10, ax = X(xx, w), ay = Y(yy, h);
        B.arrow(ctx, ax, ay, ax + v[0] * sc / span * (w * 0.42), ay - v[1] * sc / span * (h * 0.42), 3);
      }
    }
    // target ring
    ctx.fillStyle = C.accent;
    for (let j = 0; j < M; j++) { ctx.beginPath(); ctx.arc(X(Yx[j], w), Y(Yy[j], h), 2.4, 0, 7); ctx.fill(); }

    // particle paths + heads
    const seg = Math.min(N - 1, Math.floor(t * N)), local = t * N - seg;
    for (let i = 0; i < trajs.length; i++) {
      const tr = trajs[i];
      ctx.strokeStyle = "rgba(63,143,79,0.35)"; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(X(tr[0][0], w), Y(tr[0][1], h));
      for (let k = 1; k <= seg; k++) ctx.lineTo(X(tr[k][0], w), Y(tr[k][1], h));
      const hx = B.lerp(tr[seg][0], tr[seg + 1][0], local), hy = B.lerp(tr[seg][1], tr[seg + 1][1], local);
      ctx.lineTo(X(hx, w), Y(hy, h)); ctx.stroke();
      // start point
      ctx.fillStyle = C.accent2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(X(tr[0][0], w), Y(tr[0][1], h), 1.8, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      // head
      ctx.fillStyle = C.good; ctx.beginPath(); ctx.arc(X(hx, w), Y(hy, h), 2.6, 0, 7); ctx.fill();
    }

    // measure off-manifold error at t=1 endpoints
    let err = 0;
    for (const tr of trajs) { const e = tr[tr.length - 1]; const r = Math.hypot(e[0], e[1] / 0.85); err += Math.abs(r - 0.92); }
    err /= trajs.length;
    out.innerHTML = "dx/dt = <span class='hl'>v<sub>θ</sub>(x,t)</span>, integrate t: 0→1 &nbsp;|&nbsp; t = <b>" + t.toFixed(2) +
      "</b> &nbsp; steps = <b>" + N + "</b> &nbsp; mean endpoint off-ring error ≈ <span class='" + (err < 0.06 ? "hl2" : "hl") + "'>" + err.toFixed(3) +
      "</span>" + (N <= 6 ? "  ← few steps overshoot the curved field" : "");
  }

  if (B.reduced) { draw(1); }
  else B.visibleLoop(root, () => {
    if (!paused) {
      if (u >= 1) { holdT += 1; if (holdT > 70) { u = 0; holdT = 0; } }
      else u = Math.min(1, u + 0.006);
    }
    draw(u);
  });
})();
