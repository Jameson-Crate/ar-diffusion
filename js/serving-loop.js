/* Demo 7 — two autoregressive serving loops contrasted. */
(function () {
  const root = document.getElementById("demo-serving");
  if (!root) return;
  const B = window.Blog, C = B.C;

  // build block sequences (dur = relative time cost)
  function llmSeq() {
    const s = [];
    for (let turn = 0; turn < 3; turn++) {
      s.push({ t: "prefill", dur: 2.3, turn });
      for (let d = 0; d < 4; d++) s.push({ t: "decode", dur: 0.85, turn });
    }
    return s;
  }
  function wmSeq() {
    const s = [{ t: "init", dur: 1.8 }];
    for (let d = 0; d < 18; d++) s.push({ t: "decode", dur: 0.85 });
    return s;
  }
  const TOP = llmSeq(), BOT = wmSeq();
  const Wwin = 8, SINK = 2;

  root.appendChild(B.head("Figure 8 · prefill→decode  vs  initialize→decode"));
  const cv = B.canvas(root, 1.85, { onResize: () => { layout(); draw(phase); } });
  const out = B.readout();
  root.appendChild(out);
  root.appendChild(B.el("div", { class: "legend" }, [
    leg(C.accent2, "prefill / initialize"), leg(C.good, "decode (one frame/token)"), leg("#d6cdbb", "KV cache"), leg(C.accent, "active step")
  ]));
  function leg(c, t) { return B.el("span", {}, [B.el("span", { class: "swatch", style: { background: c } }), t]); }

  let geom = null;
  function layout() {
    const w = cv.w, h = cv.h, padL = w < 540 ? 52 : 96, padR = 12;
    const trackW = w - padL - padR;
    geom = { w, h, padL, padR, trackW, topY: 34, botY: h * 0.56 + 18, trackH: 26, cacheH: 18 };
    geom.topTotal = TOP.reduce((a, b) => a + b.dur, 0);
    geom.botTotal = BOT.reduce((a, b) => a + b.dur, 0);
  }
  layout();

  function drawTrack(seq, total, y, cursor, label) {
    const ctx = cv.ctx, g = geom; let x = g.padL; const sc = g.trackW / total;
    ctx.fillStyle = C.muted; ctx.font = (g.w < 540 ? "700 10px " : "700 12px ") + "system-ui"; ctx.textAlign = "right";
    ctx.fillText(label, g.padL - 8, y + 17);
    let acc = 0, activeIdx = -1;
    for (let i = 0; i < seq.length; i++) { if (cursor >= acc && cursor < acc + seq[i].dur) activeIdx = i; acc += seq[i].dur; }
    x = g.padL; acc = 0;
    for (let i = 0; i < seq.length; i++) {
      const bw = seq[i].dur * sc - 2, isActive = i === activeIdx, done = cursor >= acc + seq[i].dur;
      let col = (seq[i].t === "prefill" || seq[i].t === "init") ? C.accent2 : C.good;
      ctx.globalAlpha = done || isActive ? 1 : 0.28;
      ctx.fillStyle = col; roundRect(ctx, x, y, bw, g.trackH, 4); ctx.fill();
      if (isActive) { ctx.globalAlpha = 1; ctx.strokeStyle = C.accent; ctx.lineWidth = 2.5; roundRect(ctx, x, y, bw, g.trackH, 4); ctx.stroke(); }
      ctx.globalAlpha = 1; ctx.fillStyle = "#fff"; ctx.font = "700 10px system-ui"; ctx.textAlign = "center";
      const lbl = seq[i].t === "prefill" ? "P" : seq[i].t === "init" ? "INIT" : "d";
      if (bw > 10) ctx.fillText(lbl, x + bw / 2, y + 17);
      x += seq[i].dur * sc; acc += seq[i].dur;
    }
    return activeIdx;
  }

  function draw(p) {
    const ctx = cv.ctx, g = geom; B.clear(ctx, g.w, g.h, C.panel);
    const topCur = p * g.topTotal, botCur = p * g.botTotal;
    const narrow = g.w < 540, tf = narrow ? "700 10px system-ui" : "700 12px system-ui";

    ctx.fillStyle = C.ink; ctx.font = tf; ctx.textAlign = "left";
    ctx.fillText(narrow ? "LLM chat — re-prefills each turn" : "LLM chat — turn-based; re-prefills a growing prompt each turn", g.padL, 18);
    const tA = drawTrack(TOP, g.topTotal, g.topY, topCur, "LLM");

    // LLM KV cache: grows unbounded; bump at each prefill
    let kv = 0, reprefill = false; { let acc = 0; for (let i = 0; i < TOP.length; i++) { if (topCur < acc) break; kv += (TOP[i].t === "prefill" ? 6 : 1); if (TOP[i].t === "prefill" && Math.abs(topCur - acc) < TOP[i].dur) reprefill = true; acc += TOP[i].dur; } }
    drawCacheBar(g.padL, g.topY + g.trackH + 6, Math.min(kv, 30), 30, false, 0);
    const subY = g.topY + g.trackH + 6 + g.cacheH + 12;
    if (reprefill) { ctx.fillStyle = C.accent; ctx.font = "700 9.5px system-ui"; ctx.textAlign = "left"; ctx.fillText(narrow ? "↻ re-prefill all" : "↻ re-prefill whole context", g.padL + 2, subY); }
    else { ctx.fillStyle = C.faint; ctx.font = "9.5px system-ui"; ctx.textAlign = "left"; ctx.fillText(narrow ? "cache grows →" : "cache grows every turn →", g.padL + 2, subY); }

    ctx.fillStyle = C.ink; ctx.font = tf;
    ctx.fillText(narrow ? "World model — fixed cadence, forever" : "World model — initialize once, then advance at a fixed cadence, forever", g.padL, g.botY - 10);
    drawTrack(BOT, g.botTotal, g.botY, botCur, "world");

    // WM KV cache: fixed window slides; sinks pinned
    let frame = -1; { let acc = 0; for (let i = 0; i < BOT.length; i++) { if (botCur >= acc) frame = i; acc += BOT[i].dur; } }
    const nFrames = BOT.length;
    drawWindow(g.padL, g.botY + g.trackH + 6, nFrames, frame, Wwin, SINK);

    out.innerHTML = "LLM: <span class='hl'>prefill → decode → … → prefill</span> (cache grows, re-prefill per turn) &nbsp;|&nbsp; " +
      "World model: <span class='hl2'>initialize → decode → decode → …</span> at a <b>fixed wall-clock deadline</b>, with a sliding fixed-size cache.";
  }

  function drawCacheBar(x, y, n, max, ring, sink) {
    const ctx = cv.ctx, g = geom, cw = g.trackW / max;
    for (let i = 0; i < n; i++) { ctx.fillStyle = "#d6cdbb"; ctx.fillRect(x + i * cw, y, cw - 1.5, g.cacheH); }
    ctx.strokeStyle = C.rule; ctx.strokeRect(x, y, g.trackW, g.cacheH);
  }
  function drawWindow(x, y, nFrames, cur, W, sink) {
    const ctx = cv.ctx, g = geom, cw = g.trackW / 22;
    // strip of frame slots
    for (let i = 0; i < 22; i++) {
      const inWin = (i > cur - W && i <= cur) || i < sink;
      const isSink = i < sink && i <= cur;
      ctx.fillStyle = isSink ? C.accent2 : (inWin && i <= cur ? "#d6cdbb" : "#f2eee6");
      ctx.fillRect(x + i * cw, y, cw - 1.5, g.cacheH);
    }
    // window outline
    const wx0 = x + Math.max(0, cur - W + 1) * cw, wx1 = x + (cur + 1) * cw;
    ctx.strokeStyle = C.good; ctx.lineWidth = 2; ctx.strokeRect(wx0, y - 2, wx1 - wx0, g.cacheH + 4);
    ctx.fillStyle = C.faint; ctx.font = "9.5px system-ui"; ctx.textAlign = "left";
    ctx.fillText(g.w < 540 ? "window slides → (sinks pinned)" : "fixed window slides →  (first " + sink + " pinned = sinks)", x + 2, y + g.cacheH + 12);
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  let phase = 0;
  if (B.reduced) draw(0.5);
  else B.visibleLoop(root, () => { phase += 0.0016; if (phase > 1) phase = 0; draw(phase); });
})();
