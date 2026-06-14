/* Demo 1 — forward/reverse diffusion as interpolation to a Gaussian. */
(function () {
  const root = document.getElementById("demo-diffusion");
  if (!root) return;
  const B = window.Blog, C = B.C;

  // ---- build a 2D "data" distribution: two moons ----
  const N = 460, rnd = B.mulberry32(7);
  const pts = [];
  for (let i = 0; i < N; i++) {
    const top = i < N / 2;
    const a = rnd() * Math.PI;
    const r = 1.0 + (rnd() - 0.5) * 0.12;
    let x, y;
    if (top) { x = Math.cos(a) * r - 0.5; y = Math.sin(a) * r - 0.25; }
    else { x = Math.cos(a) * r * -1 + 0.5; y = -Math.sin(a) * r + 0.25; }
    const g = B.gaussPair(rnd);
    pts.push({ x: x * 0.95, y: y * 0.95, ex: g[0], ey: B.gaussPair(rnd)[0] });
  }

  // ---- build a tiny procedural "image" (sky / sun / ground) ----
  const G = 44;
  const base = new Float32Array(G * G * 3);
  const noise = new Float32Array(G * G * 3);
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const u = i / (G - 1), v = j / (G - 1);
    let r, g, b;
    if (v < 0.62) { // sky gradient
      r = B.lerp(0.45, 0.80, v / 0.62); g = B.lerp(0.62, 0.86, v / 0.62); b = B.lerp(0.92, 0.98, v / 0.62);
      const dx = u - 0.72, dy = v - 0.22, d = Math.sqrt(dx * dx + dy * dy); // sun
      if (d < 0.14) { const k = 1 - d / 0.14; r = B.lerp(r, 1.0, k); g = B.lerp(g, 0.93, k); b = B.lerp(b, 0.55, k); }
    } else { // ground
      const t = (v - 0.62) / 0.38;
      r = B.lerp(0.42, 0.30, t); g = B.lerp(0.58, 0.42, t); b = B.lerp(0.30, 0.22, t);
      if (Math.abs(u - 0.3) < 0.05 && v > 0.5 && v < 0.7) { r = 0.32; g = 0.24; b = 0.16; } // tree trunk-ish
    }
    const o = (j * G + i) * 3;
    base[o] = r; base[o + 1] = g; base[o + 2] = b;
    noise[o] = B.gaussPair(rnd)[0]; noise[o + 1] = B.gaussPair(rnd)[0]; noise[o + 2] = B.gaussPair(rnd)[0];
  }

  // cosine schedule abar(k), k in [0,1000]
  const K = 1000, s = 0.008;
  function f(u) { const x = Math.cos((u + s) / (1 + s) * Math.PI / 2); return x * x; }
  function abar(k) { return f(k / K) / f(0); }

  // ---- DOM ----
  root.appendChild(B.head("Figure 1 · Diffusion bridge"));
  const cv = B.canvas(root, 2.5, { onResize: () => render() });
  const ctrls = B.controls();
  const out = B.readout();
  const sl = B.slider({
    label: "noise level  k", min: 0, max: K, step: 5, value: 0,
    fmt: v => "k = " + v, oninput: () => render()
  });
  ctrls.appendChild(sl.wrap);
  const dirBtns = B.segmented(["▶ forward (add noise)", "◀ reverse (denoise)"], (i) => animate(i), 0);
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "1 1 220px" } }, [
    B.el("label", { html: "<span>direction</span>" }), dirBtns.wrap
  ]));
  root.appendChild(ctrls);
  root.appendChild(out);
  root.appendChild(B.el("div", { class: "legend" }, [
    B.el("span", {}, [sw(C.accent), "data distribution / clean image"]),
    B.el("span", {}, [sw(C.accent2), "as k → K: isotropic Gaussian"])
  ]));
  function sw(c) { return B.el("span", { class: "swatch", style: { background: c } }); }

  function render() {
    const k = sl.value, ab = abar(k), sq = Math.sqrt(ab), sn = Math.sqrt(1 - ab);
    const ctx = cv.ctx, w = cv.w, h = cv.h, pad = 14;
    B.clear(ctx, w, h, C.panel);
    const split = w * 0.5, narrow = w < 420;
    // ----- left: scatter -----
    const Lx = pad, Ly = pad + 16, Lw = split - pad * 1.5, Lh = h - Ly - pad;
    panel(ctx, Lx, Ly, Lw, Lh, narrow ? "distribution p_k(x)" : "latent distribution  p_k(x)");
    const cx = Lx + Lw / 2, cy = Ly + Lh / 2, sc = Math.min(Lw, Lh) * 0.30;
    ctx.fillStyle = C.accent;
    for (const p of pts) {
      const x = sq * p.x + sn * p.ex, y = sq * p.y + sn * p.ey;
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(cx + x * sc, cy - y * sc, 2.1, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // ----- right: image -----
    const Rx = split + pad * 0.5, Ry = Ly, Rw = w - Rx - pad, Rh = h - Ly - pad;
    panel(ctx, Rx, Ry, Rw, Rh, "a sample  x_k");
    const side = Math.min(Rw, Rh) - 10, ix = Rx + (Rw - side) / 2, iy = Ry + (Rh - side) / 2;
    const cell = side / G;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const o = (j * G + i) * 3;
      const r = clampc(sq * base[o] + sn * noise[o] * 0.5 + 0.5 * (1 - sq) * 0 + 0);
      // x_k = sqrt(ab)*x0 + sqrt(1-ab)*eps ; map to [0,1] for display (x0 already in [0,1], eps ~ N(0,1))
      const rr = clampc(sq * base[o] + sn * noise[o] * 0.5 + (1 - sq) * 0.5);
      const gg = clampc(sq * base[o + 1] + sn * noise[o + 1] * 0.5 + (1 - sq) * 0.5);
      const bb = clampc(sq * base[o + 2] + sn * noise[o + 2] * 0.5 + (1 - sq) * 0.5);
      ctx.fillStyle = "rgb(" + (rr * 255 | 0) + "," + (gg * 255 | 0) + "," + (bb * 255 | 0) + ")";
      ctx.fillRect(ix + i * cell, iy + j * cell, cell + 0.6, cell + 0.6);
    }
    ctx.strokeStyle = C.rule; ctx.strokeRect(ix, iy, side, side);

    const t = (k / K);
    out.innerHTML =
      "x<sub>k</sub> = <span class='hl'>√ᾱ<sub>k</sub></span>·x₀ + <span class='hl2'>√(1−ᾱ<sub>k</sub>)</span>·ε &nbsp;&nbsp;|&nbsp;&nbsp; " +
      "t = k/K = <b>" + t.toFixed(2) + "</b> &nbsp; " +
      "<span class='hl'>√ᾱ<sub>k</sub> = " + sq.toFixed(3) + "</span> &nbsp; " +
      "<span class='hl2'>√(1−ᾱ<sub>k</sub>) = " + sn.toFixed(3) + "</span>";
  }
  function clampc(x) { return B.clamp(x, 0, 1); }
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = "#fff"; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.rule; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = C.faint; ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "left";
    ctx.fillText(title, x + 2, y - 5);
  }

  // simple animation when a direction button is pressed
  let anim = null;
  function animate(dir) {
    if (anim) cancelAnimationFrame(anim);
    if (B.reduced) { sl.value = dir === 0 ? K : 0; return; }
    const from = sl.value, to = dir === 0 ? K : 0, dur = 1100, t0 = performance.now();
    function step(now) {
      const u = B.clamp((now - t0) / dur, 0, 1), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      sl.value = Math.round(B.lerp(from, to, e));
      if (u < 1) anim = requestAnimationFrame(step);
    }
    anim = requestAnimationFrame(step);
  }

  B.onVisibleOnce(root, render);
})();
