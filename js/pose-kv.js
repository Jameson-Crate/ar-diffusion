/* Demo 10 — schematic pose-aware compressed KV memory (RELIC-style retrieval). */
(function () {
  const root = document.getElementById("demo-pose");
  if (!root) return;
  const B = window.Blog, C = B.C;
  const rnd = B.mulberry32(77);

  // stored memory tokens placed around the scene; each tagged with absolute pose + content hue
  const TOK = [];
  const Ncol = 14;
  for (let i = 0; i < Ncol; i++) {
    const a = (i / Ncol) * Math.PI * 2 + 0.15;
    const r = 1.5 + (rnd() - 0.5) * 0.5;
    TOK.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, hue: Math.floor(rnd() * 360), ang: a });
  }
  let heading = 0.0, walk = 0.0;        // camera heading (rad) and forward position
  const FOV = 0.62, RANGE = 3.6;

  function camPos() { return { x: 0, y: walk }; }
  function retrieved() {
    const c = camPos(), set = [];
    for (let i = 0; i < TOK.length; i++) {
      const dx = TOK[i].x - c.x, dy = TOK[i].y - c.y, dist = Math.hypot(dx, dy);
      let da = Math.atan2(dy, dx) - heading; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      if (Math.abs(da) < FOV && dist < RANGE) set.push({ i, da, dist });
    }
    set.sort((a, b) => a.da - b.da);
    return set;
  }

  root.appendChild(B.head("Figure 6 · Pose-aware memory retrieval"));
  const cv = B.canvas(root, 2.05, { onResize: () => draw() });
  const ctrls = B.controls();
  const slH = B.slider({ label: "camera heading", min: 0, max: 360, step: 1, value: 0, fmt: v => v + "°", oninput: v => { heading = v * Math.PI / 180; draw(); } });
  const slW = B.slider({ label: "walk forward / back", min: -120, max: 120, step: 1, value: 0, fmt: v => (v / 100).toFixed(2), oninput: v => { walk = v / 100; draw(); } });
  ctrls.appendChild(slH.wrap); ctrls.appendChild(slW.wrap);
  root.appendChild(ctrls);
  const out = B.readout();
  root.appendChild(out);

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h; B.clear(ctx, w, h, C.panel);
    const mapS = Math.min(h - 16, w * 0.46), mx = 8, my = (h - mapS) / 2;
    // ---- left: top-down map ----
    ctx.fillStyle = "#fff"; ctx.fillRect(mx, my, mapS, mapS); ctx.strokeStyle = C.rule; ctx.strokeRect(mx, my, mapS, mapS);
    ctx.fillStyle = C.faint; ctx.font = "600 10px system-ui"; ctx.textAlign = "left"; ctx.fillText("top-down · stored poses", mx + 6, my + 13);
    const cx = mx + mapS / 2, cy = my + mapS / 2, sc = mapS * 0.26;
    const cam = camPos(); const camX = cx + cam.x * sc, camY = cy - cam.y * sc;
    const ret = retrieved(), retSet = new Set(ret.map(r => r.i));
    // frustum (clipped to the map panel)
    ctx.save(); ctx.beginPath(); ctx.rect(mx, my, mapS, mapS); ctx.clip();
    ctx.fillStyle = "rgba(47,111,151,0.10)";
    ctx.beginPath(); ctx.moveTo(camX, camY);
    ctx.arc(camX, camY, RANGE * sc, -heading - FOV, -heading + FOV); ctx.closePath(); ctx.fill();
    ctx.restore();
    // tokens
    for (let i = 0; i < TOK.length; i++) {
      const tx = cx + TOK[i].x * sc, ty = cy - TOK[i].y * sc, on = retSet.has(i);
      if (on) { ctx.shadowColor = "hsl(" + TOK[i].hue + ",70%,50%)"; ctx.shadowBlur = 12; }
      ctx.fillStyle = on ? "hsl(" + TOK[i].hue + ",65%,52%)" : "#d8d2c7";
      ctx.beginPath(); ctx.arc(tx, ty, on ? 7 : 5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // camera
    ctx.fillStyle = C.accent; ctx.save(); ctx.translate(camX, camY); ctx.rotate(-heading);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill(); ctx.restore();

    // ---- right: KV cache + reconstructed view ----
    const rx = mx + mapS + 18, rw = w - rx - 10;
    ctx.fillStyle = C.faint; ctx.font = "600 10.5px system-ui"; ctx.fillText("compressed KV cache", rx, my + 10);
    const cols = TOK.length, cw = rw / cols, ky = my + 18, kh = 24;
    for (let i = 0; i < cols; i++) {
      const on = retSet.has(i);
      ctx.fillStyle = on ? "hsl(" + TOK[i].hue + ",65%,52%)" : "#ece7dd";
      ctx.fillRect(rx + i * cw + 1, ky, cw - 2, kh);
      if (on) { ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.strokeRect(rx + i * cw + 1, ky, cw - 2, kh); }
    }
    ctx.fillStyle = C.muted; ctx.font = "10px system-ui"; ctx.textAlign = "left";
    ctx.fillText("glowing = retrieved (pose match)", rx, ky + kh + 13);

    // reconstructed view from retrieved tokens
    const vy = ky + kh + 28, vh = my + mapS - vy - 4;
    ctx.fillStyle = "#fff"; ctx.fillRect(rx, vy, rw, vh); ctx.strokeStyle = C.rule; ctx.strokeRect(rx, vy, rw, vh);
    ctx.fillStyle = C.faint; ctx.font = "10px system-ui"; ctx.fillText("reconstructed view", rx + 4, vy + 13);
    const g = ctx.createLinearGradient(0, vy, 0, vy + vh); g.addColorStop(0, "#cfe7f4"); g.addColorStop(1, "#eef7fb");
    ctx.save(); ctx.beginPath(); ctx.rect(rx + 1, vy + 18, rw - 2, vh - 20); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(rx, vy + 18, rw, vh);
    if (ret.length) {
      const bw = (rw - 8) / ret.length;
      ret.forEach((r, k) => {
        const t = TOK[r.i], bh = (vh - 24) * (0.4 + 0.55 * (1 - r.dist / RANGE));
        ctx.fillStyle = "hsl(" + t.hue + ",60%,55%)";
        ctx.fillRect(rx + 4 + k * bw, vy + vh - bh - 3, bw - 3, bh);
      });
    } else {
      ctx.fillStyle = C.faint; ctx.font = "11px system-ui"; ctx.textAlign = "center"; ctx.fillText("no stored pose in view", rx + rw / 2, vy + vh / 2);
    }
    ctx.restore();

    out.innerHTML = "retrieved <span class='hl'>" + ret.length + "</span> / " + TOK.length + " tokens by pose match &nbsp;·&nbsp; " +
      "each token carries (relative action, <b>absolute camera pose</b>); revisiting a viewpoint re-selects the same tokens → 3D-consistent recall, no explicit geometry.";
  }

  B.onVisibleOnce(root, draw);
})();
