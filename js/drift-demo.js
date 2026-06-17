/* Demo 3 — exposure bias as compounding covariate shift.
   Manifold = unit circle. Three rollouts: teacher-forced (re-anchors to GT),
   free-running (amplifies deviations -> collapse), diffusion-forcing (corrects -> bounded). */
(function () {
  const root = document.getElementById("demo-drift");
  if (!root) return;
  const B = window.Blog, C = B.C;

  const MAXF = 84;
  let sigma = 0.05, gain = 0.34;
  let frame = 0, hold = 0, rndState;
  let TF, FR, DF, errTF, errFR, errDF;

  function reset() {
    rndState = B.mulberry32(99);
    const start = [Math.cos(0.3), Math.sin(0.3)];
    TF = [start.slice()]; FR = [start.slice()]; DF = [start.slice()];
    errTF = [0]; errFR = [0]; errDF = [0];
    frame = 0; hold = 0;
  }
  function n() { return B.gaussPair(rndState)[0]; }
  const dth = 0.42;
  function rot(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]; }

  function advance() {
    const k = frame + 1, gtA = 0.3 + k * dth;
    // teacher forcing: condition on GROUND TRUTH each step, output = gt_next + small noise
    const gt = [Math.cos(gtA), Math.sin(gtA)];
    const tf = [gt[0] + n() * sigma * 0.6, gt[1] + n() * sigma * 0.6];
    TF.push(tf); errTF.push(Math.abs(Math.hypot(tf[0], tf[1]) - 1));

    // free running: condition on OWN previous output; deviations get amplified
    let p = rot(FR[FR.length - 1], dth);
    let rad = Math.hypot(p[0], p[1]);
    let nr = rad + gain * (rad - 1) + n() * sigma;      // unstable fixed point at rad=1
    nr = Math.max(0.02, nr);
    p = [p[0] / rad * nr, p[1] / rad * nr];
    FR.push(p); errFR.push(Math.abs(nr - 1));

    // diffusion forcing: same rollout but partial correction back to manifold (trained on noisy history)
    let q = rot(DF[DF.length - 1], dth);
    let qr = Math.hypot(q[0], q[1]);
    let qnr = 1 + (qr - 1) * 0.45 + n() * sigma * 0.6;  // contracts toward rad=1
    q = [q[0] / qr * qnr, q[1] / qr * qnr];
    DF.push(q); errDF.push(Math.abs(qnr - 1));
    frame = k;
  }

  // ---- DOM ----
  root.appendChild(B.head("Figure 4 · Drift = compounding covariate shift"));
  const cv = B.canvas(root, 1.95, { onResize: () => draw() });
  const ctrls = B.controls();
  const slS = B.slider({ label: "per-step error  σ", min: 0, max: 0.14, step: 0.005, value: 0.05, fmt: v => v.toFixed(3), oninput: v => { sigma = v; reset(); } });
  const slG = B.slider({ label: "free-run drift gain", min: 0, max: 0.6, step: 0.02, value: 0.34, fmt: v => v.toFixed(2), oninput: v => { gain = v; reset(); } });
  const rb = B.el("button", { class: "btn", text: "↻ restart", onclick: () => reset() });
  ctrls.appendChild(slS.wrap); ctrls.appendChild(slG.wrap);
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "0 0 auto" } }, [B.el("label", { html: "<span>&nbsp;</span>" }), rb]));
  root.appendChild(ctrls);
  root.appendChild(B.el("div", { class: "legend" }, [
    leg(C.good, "teacher forcing (re-anchors)"), leg(C.bad, "free-running (own output → collapse)"), leg(C.accent2, "diffusion forcing (bounded)")
  ]));
  function leg(c, t) { return B.el("span", {}, [B.el("span", { class: "swatch", style: { background: c } }), t]); }

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h;
    B.clear(ctx, w, h, C.panel);
    const topH = h * 0.62, botY = topH + 8;
    // ---- top: phase space ----
    ctx.fillStyle = "#fff"; ctx.fillRect(8, 8, w - 16, topH - 12); ctx.strokeStyle = C.rule; ctx.strokeRect(8, 8, w - 16, topH - 12);
    const cx = w * 0.5, cy = 8 + (topH - 12) / 2, R = Math.min(w - 16, topH - 12) * 0.34;
    ctx.fillStyle = C.faint; ctx.font = "600 11px system-ui"; ctx.textAlign = "left"; ctx.fillText("state space — data lies on the manifold (ring)", 14, 22);
    // manifold ring
    ctx.setLineDash([4, 4]); ctx.strokeStyle = "#c9c3b8"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // clip trails to the phase-space panel: the free-running rollout collapses off to infinity
    ctx.save(); ctx.beginPath(); ctx.rect(8, 8, w - 16, topH - 12); ctx.clip();
    drawTrail(ctx, TF, cx, cy, R, C.good);
    drawTrail(ctx, DF, cx, cy, R, C.accent2);
    drawTrail(ctx, FR, cx, cy, R, C.bad);
    ctx.restore();

    // ---- bottom: error curves ----
    const bx = 8, bw = w - 16, bh = h - botY - 8;
    ctx.fillStyle = "#fff"; ctx.fillRect(bx, botY, bw, bh); ctx.strokeStyle = C.rule; ctx.strokeRect(bx, botY, bw, bh);
    ctx.fillStyle = C.faint; ctx.font = "600 11px system-ui"; ctx.fillText("off-manifold error  e_t = | ‖x̂_t‖ − 1 |", bx + 6, botY + 15);
    const emax = 1.0, padB = 20;
    function ex(i) { return bx + 6 + (bw - 12) * i / MAXF; }
    function ey(e) { return botY + bh - padB + 4 - (bh - padB - 8) * B.clamp(e / emax, 0, 1); }
    // axis
    ctx.strokeStyle = "#eee"; ctx.beginPath(); ctx.moveTo(bx + 6, ey(0)); ctx.lineTo(bx + bw - 6, ey(0)); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(bx, botY, bw, bh); ctx.clip();
    curve(ctx, errTF, ex, ey, C.good); curve(ctx, errDF, ex, ey, C.accent2); curve(ctx, errFR, ex, ey, C.bad);
    ctx.restore();
    ctx.fillStyle = C.faint; ctx.font = "10px system-ui"; ctx.textAlign = "right";
    ctx.fillText("frame t →", bx + bw - 8, botY + bh - 6);
  }
  function drawTrail(ctx, arr, cx, cy, R, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < arr.length; i++) { const x = cx + arr[i][0] * R, y = cy - arr[i][1] * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    const last = arr[arr.length - 1]; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx + last[0] * R, cy - last[1] * R, 3.4, 0, 7); ctx.fill();
  }
  function curve(ctx, arr, ex, ey, col) {
    ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i < arr.length; i++) { i ? ctx.lineTo(ex(i), ey(arr[i])) : ctx.moveTo(ex(i), ey(arr[i])); }
    ctx.stroke();
  }

  reset();
  if (B.reduced) { while (frame < MAXF) advance(); draw(); }
  else {
    let tick = 0;
    B.visibleLoop(root, () => {
      tick++;
      if (frame < MAXF) { if (tick % 4 === 0) advance(); }
      else { hold++; if (hold > 90) reset(); }
      draw();
    });
  }
})();
