/* Demo 8 — why the serving tricks matter (schematic frame-time model). */
(function () {
  const root = document.getElementById("demo-kv");
  if (!root) return;
  const B = window.Blog, C = B.C;

  let staticKV = false, localWin = false, cuda = false, targetFPS = 40;
  const WIN = 16, N = 46;
  let f = 0, hist = [];

  function stepTime(frame) {
    const histLen = localWin ? Math.min(frame, WIN) : frame;
    const compute = 11;                         // model FFN/conv, fixed
    const attn = 0.5 * histLen;                 // attention over cached history
    let realloc = 0;
    if (!staticKV) { realloc = isRealloc(frame) ? 17 : 1.6; }   // dynamic cache: growth reallocs + per-step alloc
    const overhead = cuda ? 0.4 : 8.5;          // python/launch overhead per step
    return { compute, attn, realloc, overhead, total: compute + attn + realloc + overhead };
  }
  function isRealloc(frame) { let p = 4; while (p < 64) { if (frame === p) return true; p *= 2; } return false; }

  // ---- DOM ----
  root.appendChild(B.head("Figure 9 · Per-frame time budget"));
  const ctrls = B.controls();
  const t1 = B.toggle("static streaming KV cache", false, v => { staticKV = v; });
  const t2 = B.toggle("local attention window", false, v => { localWin = v; });
  const t3 = B.toggle("CUDA graphs", false, v => { cuda = v; });
  const allBtn = B.el("button", { class: "btn primary", text: "enable all", onclick: () => { staticKV = localWin = cuda = true; t1.input.checked = t2.input.checked = t3.input.checked = true; } });
  ctrls.appendChild(B.el("div", { class: "control", style: { flex: "1 1 100%" } }, [
    B.el("label", { html: "<span>runtime optimizations</span>" }),
    B.el("div", { style: { display: "flex", gap: "18px", flexWrap: "wrap", alignItems: "center" } }, [t1.wrap, t2.wrap, t3.wrap, allBtn])
  ]));
  const slF = B.slider({ label: "real-time target", min: 16, max: 60, step: 1, value: 40, fmt: v => v + " FPS (" + (1000 / v).toFixed(0) + " ms)", oninput: v => { targetFPS = v; } });
  ctrls.appendChild(slF.wrap);
  root.appendChild(ctrls);
  const cv = B.canvas(root, 2.2, {});
  const out = B.readout();
  root.appendChild(out);
  root.appendChild(B.el("div", { class: "legend" }, [
    leg(C.accent, "compute"), leg(C.accent2, "attention (history)"), leg(C.bad, "realloc / dynamic cache"), leg("#b9b2a6", "framework overhead"), leg("#222", "real-time budget")
  ]));
  function leg(c, t) { return B.el("span", {}, [B.el("span", { class: "swatch", style: { background: c } }), t]); }

  function draw() {
    const ctx = cv.ctx, w = cv.w, h = cv.h, padL = 40, padR = 12, top = 12, bot = 26;
    B.clear(ctx, w, h, C.panel);
    const budget = 1000 / targetFPS, ymax = Math.max(60, budget * 1.6);
    const plotH = h - top - bot, plotW = w - padL - padR;
    function Y(ms) { return top + plotH - (ms / ymax) * plotH; }
    // y axis ticks
    ctx.font = "10px system-ui"; ctx.textAlign = "right"; ctx.fillStyle = C.faint;
    for (let ms = 0; ms <= ymax; ms += 20) { const y = Y(ms); ctx.strokeStyle = "#efeae1"; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.fillText(ms + "", padL - 4, y + 3); }
    // budget line
    ctx.strokeStyle = "#222"; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(padL, Y(budget)); ctx.lineTo(w - padR, Y(budget)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#222"; ctx.font = "700 10px system-ui"; ctx.textAlign = "left"; ctx.fillText(budget.toFixed(1) + " ms", padL + 4, Y(budget) - 4);

    const bw = plotW / N;
    hist.forEach((s, i) => {
      const x = padL + i * bw; let yb = Y(0);
      const parts = [[s.compute, C.accent], [s.attn, C.accent2], [s.realloc, C.bad], [s.overhead, "#b9b2a6"]];
      for (const [val, col] of parts) { const y = Y(val) - (top + plotH); const hgt = (val / ymax) * plotH; ctx.fillStyle = col; ctx.fillRect(x + 0.5, yb - hgt, bw - 1, hgt); yb -= hgt; }
    });
    ctx.fillStyle = C.muted; ctx.font = "10px system-ui"; ctx.textAlign = "center"; ctx.fillText("autoregressive decode steps  →", padL + plotW / 2, h - 4);

    const cur = hist[hist.length - 1];
    if (cur) {
      const meets = cur.total <= budget;
      out.innerHTML = "frame time ≈ <b>" + cur.total.toFixed(1) + " ms</b> &nbsp;(" + (1000 / cur.total).toFixed(0) + " FPS) &nbsp; vs budget <span class='hl2'>" + budget.toFixed(1) + " ms</span> → " +
        (meets ? "<span class='hl2'>meets real-time</span>" : "<span class='hl'>misses real-time</span>") +
        "<br>compute " + cur.compute.toFixed(0) + " + attn " + cur.attn.toFixed(1) + " + realloc " + cur.realloc.toFixed(1) + " + overhead " + cur.overhead.toFixed(1) + " ms" +
        (staticKV && localWin && cuda ? " &nbsp;·&nbsp; <b>flat &amp; bounded</b>" : " &nbsp;·&nbsp; grows / spikes without the tricks");
    }
  }

  function tick() {
    f++; if (f > 60) f = 1;                 // cycle the decode-step counter (no blank reset)
    hist.push(stepTime(f)); if (hist.length > N) hist.shift();
    draw();
  }
  // pre-fill the buffer so the chart is populated immediately and never flashes empty
  for (let i = 1; i <= N; i++) { f = i; hist.push(stepTime(i)); if (hist.length > N) hist.shift(); }
  if (B.reduced) { draw(); }
  else { let c = 0; B.visibleLoop(root, () => { c++; if (c % 6 === 0) tick(); else draw(); }); }
})();
