/* Demo 6 — frame rate vs frame-time budget, with reported FlashDreams speedups. */
(function () {
  const root = document.getElementById("demo-fps");
  if (!root) return;
  const B = window.Blog, C = B.C;

  // reported / representative streaming frame rates. speed = reported FlashDreams speedup (1 = none).
  const DATA = [
    { name: "Wan2.1", fps: 3.0, speed: 1.40, note: "offline backbone (FPS illustrative)", kind: "offline" },
    { name: "CausVid", fps: 9.4, speed: 1, note: "1 GPU, KV cache (CVPR'25)", kind: "rt" },
    { name: "RELIC (14B)", fps: 16, speed: 1, note: "pose-aware memory", kind: "rt" },
    { name: "LingBot-World Fast", fps: 16, speed: 3.10, note: "480p, 1 GPU node", kind: "rt" },
    { name: "Self Forcing", fps: 17, speed: 2.12, note: "sub-second latency, 1 GPU", kind: "rt" },
    { name: "LongLive", fps: 20.7, speed: 1, note: "single H100, ≤240 s", kind: "rt" },
    { name: "Genie 3 (closed)", fps: 24, speed: 1, note: "720p, multi-min consistency", kind: "closed" },
    { name: "Matrix-Game 3.0 (5B)", fps: 40, speed: 1, note: "720p, minute memory", kind: "rt" }
  ];
  let target = 30, boost = false;

  const tgl = B.toggle("apply FlashDreams speedup", false, v => { boost = v; draw(); });
  root.appendChild(B.head("Figure 10 · Frame rate vs real-time budget", tgl.wrap));
  const cv = B.canvas(root, 1.7, { onResize: () => draw() });
  const ctrls = B.controls();
  const slT = B.slider({ label: "real-time target", min: 16, max: 60, step: 1, value: 30, fmt: v => v + " FPS  (" + (1000 / v).toFixed(1) + " ms)", oninput: v => { target = v; draw(); } });
  ctrls.appendChild(slT.wrap);
  root.appendChild(ctrls);
  const out = B.readout();
  root.appendChild(out);

  function eff(d) { return boost ? d.fps * d.speed : d.fps; }
  const AXMAX = 56;

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h;
    B.clear(ctx, w, h, C.panel);
    const left = Math.min(160, Math.max(120, w * 0.34)), right = 30, top = 16, bot = 34;
    const plotW = w - left - right, plotH = h - top - bot;
    const n = DATA.length, rowH = plotH / n;
    const sx = plotW / AXMAX;

    // gridlines (FPS)
    ctx.font = "10px system-ui"; ctx.textAlign = "center";
    for (let f = 0; f <= AXMAX; f += 10) {
      const x = left + f * sx; ctx.strokeStyle = "#efeae1"; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + plotH); ctx.stroke();
      ctx.fillStyle = C.faint; ctx.fillText(f, x, top + plotH + 14);
    }
    ctx.fillStyle = C.muted; ctx.fillText("frames per second  →", left + plotW / 2, h - 4);

    // target line
    const tx = left + target * sx;
    ctx.strokeStyle = C.accent2; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(tx, top - 2); ctx.lineTo(tx, top + plotH + 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = C.accent2; ctx.font = "700 10px system-ui"; ctx.textAlign = "left";
    ctx.fillText("target " + target + " FPS", tx + 4, top + 8);

    // bars
    DATA.forEach((d, i) => {
      const y = top + i * rowH + rowH * 0.5, fpsE = eff(d), bw = fpsE * sx;
      const meets = fpsE >= target;
      // base ghost when boosted
      if (boost && d.speed !== 1) {
        ctx.fillStyle = "rgba(150,150,150,.18)"; ctx.fillRect(left, y - rowH * 0.26, d.fps * sx, rowH * 0.52);
      }
      let col = d.kind === "closed" ? "#9b8ec2" : d.kind === "offline" ? "#b9b2a6" : (meets ? C.good : C.accent);
      ctx.fillStyle = col;
      ctx.fillRect(left, y - rowH * 0.26, Math.max(2, bw), rowH * 0.52);
      // boosted delta arrow
      if (boost && d.speed !== 1) {
        ctx.strokeStyle = C.accent; ctx.fillStyle = C.accent; ctx.lineWidth = 1.4;
        B.arrow(ctx, left + d.fps * sx, y, left + bw - 2, y, 4);
      }
      // name (shrink font if it would overflow the gutter)
      ctx.fillStyle = C.ink; ctx.textAlign = "right";
      let nf = 12; ctx.font = "600 " + nf + "px system-ui";
      while (ctx.measureText(d.name).width > left - 12 && nf > 9) { nf -= 0.5; ctx.font = "600 " + nf + "px system-ui"; }
      ctx.fillText(d.name, left - 8, y + 4);
      // value label — reflow inside the bar if it would overflow the right edge
      const ms = 1000 / fpsE, label = fpsE.toFixed(fpsE < 10 ? 1 : 0) + " FPS · " + ms.toFixed(0) + " ms";
      ctx.font = "700 11px system-ui"; const tw = ctx.measureText(label).width;
      const endX = left + Math.max(2, bw);
      if (endX + 6 + tw > w - 2 && bw > tw + 10) { ctx.textAlign = "right"; ctx.fillStyle = "#fff"; ctx.fillText(label, endX - 6, y + 4); }
      else { ctx.textAlign = "left"; ctx.fillStyle = meets ? C.good : C.muted; ctx.fillText(label, endX + 6, y + 4); }
    });

    const met = DATA.filter(d => eff(d) >= target).map(d => d.name);
    out.innerHTML = "budget = 1000 / " + target + " = <span class='hl'>" + (1000 / target).toFixed(1) + " ms/frame</span>" +
      (boost ? " &nbsp;·&nbsp; <span class='hl'>FlashDreams ON</span>: ×2.12 Self-Forcing, ×3.10 LingBot-World, ×1.40 Wan2.1 (reported)" : " &nbsp;·&nbsp; speedup off") +
      "<br>meeting target (" + met.length + "): <span class='hl2'>" + (met.join(", ") || "none") + "</span>";
  }

  B.onVisibleOnce(root, draw);
})();
