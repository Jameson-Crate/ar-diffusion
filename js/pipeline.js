/* Demo 5 — the standardized training pipeline, as a clickable 4-stage diagram. */
(function () {
  const root = document.getElementById("demo-pipeline");
  if (!root) return;
  const B = window.Blog, C = B.C;

  const STAGES = [
    {
      n: 1, title: "Bidirectional teacher", tag: "source of quality", color: C.accent2,
      disease: "—  (the quality ceiling)",
      body: "A strong but slow, non-causal flow-matching DiT. Denoises whole clips jointly with full bidirectional attention. Maximal quality, but O(T²), no streaming, no mid-generation reaction.",
      idea: "Train once, at scale, in latent space. Everything downstream distills from this.",
      works: [["Wan2.1/2.2", "#ref-7"], ["CogVideoX", "#ref-8"], ["Cosmos", "#ref-9"], ["DiT", "#ref-6"]]
    },
    {
      n: 2, title: "Causal few-step student", tag: "beats latency", color: C.accent,
      disease: "latency / streaming",
      body: "Distill the teacher into a CAUSAL model that decodes frame-by-frame with a KV cache, in ~4 steps instead of ~50. ODE-trajectory initialization + Distribution Matching Distillation (DMD).",
      idea: "∇θ D_KL(pθ‖p_teacher) = E[(s_fake − s_real)·∇θ G]. Match the teacher's distribution, not its pixels; few-step generation makes real-time possible.",
      works: [["CausVid", "#ref-13"], ["DMD / DMD2", "#ref-11"], ["Self Forcing", "#ref-14"], ["Causal Forcing", "#ref-18"]]
    },
    {
      n: 3, title: "Long-horizon stabilization", tag: "beats drift at scale", color: C.good,
      disease: "drift beyond the teacher horizon",
      body: "Self-rollout training (train = inference) plus rolling windows, progressive per-frame noise, and attention sinks push STABLE generation from ~5 s to minutes — without any long ground-truth video.",
      idea: "Sample short windows from deep inside a long self-rollout, re-noise them, and apply DMD against the ordinary short-horizon teacher. Corrective signal at positions the teacher never saw.",
      works: [["Self Forcing++", "#ref-15"], ["Rolling Forcing", "#ref-16"], ["LongLive", "#ref-17"]]
    },
    {
      n: 4, title: "Pose-aware memory", tag: "beats inconsistency", color: "#7c4fae",
      disease: "spatial memory / consistency",
      body: "A compressed, camera-aware KV cache holds the scene across minutes. Look away and look back and the world persists — the last gap with closed systems like Genie 3.",
      idea: "Store history as highly compressed latent tokens tagged with relative actions + absolute camera pose. Revisiting a viewpoint retrieves the matching tokens → implicit 3D consistency, no explicit geometry.",
      works: [["RELIC", "#ref-25"], ["Matrix-Game 3.0", "#ref-22"], ["LingBot-World", "#ref-21"]]
    }
  ];
  let cur = 1;

  root.appendChild(B.head("Figure 7 · One pipeline, four stages"));
  const row = B.el("div", { style: { display: "flex", alignItems: "stretch", gap: "0", flexWrap: "wrap", margin: "4px 0 6px" } });
  const chips = STAGES.map((s, i) => {
    const chip = B.el("div", {
      class: "pipe-chip",
      style: chipStyle(false, s.color),
      onclick: () => select(i)
    }, [
      B.el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
        B.el("span", { text: s.n, style: { fontFamily: "var(--sans)", fontWeight: "800", fontSize: "13px", color: "#fff", background: s.color, width: "22px", height: "22px", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" } }),
        B.el("span", { text: s.title, style: { fontFamily: "var(--sans)", fontWeight: "700", fontSize: "13.5px", lineHeight: "1.15" } })
      ]),
      B.el("div", { text: s.tag, style: { fontFamily: "var(--sans)", fontSize: "11px", color: C.faint, marginTop: "5px", textTransform: "uppercase", letterSpacing: ".04em" } })
    ]);
    row.appendChild(chip);
    if (i < STAGES.length - 1) row.appendChild(B.el("div", { html: "→", style: { alignSelf: "center", color: C.faint, fontSize: "20px", padding: "0 6px", fontFamily: "var(--sans)" } }));
    return chip;
  });
  root.appendChild(row);

  const detail = B.el("div", { style: { background: "#fff", border: "1px solid " + C.rule, borderRadius: "10px", padding: "16px 18px", marginTop: "6px" } });
  root.appendChild(detail);

  function chipStyle(active, color) {
    return {
      flex: "1 1 150px", minWidth: "150px", cursor: "pointer", borderRadius: "10px",
      padding: "12px 13px", background: active ? "#fff" : C.panel,
      border: "1.5px solid " + (active ? color : C.rule),
      boxShadow: active ? "0 2px 10px rgba(40,30,15,.08)" : "none", transition: "all .12s"
    };
  }
  function select(i) {
    cur = i;
    chips.forEach((c, j) => Object.assign(c.style, chipStyle(j === i, STAGES[j].color)));
    const s = STAGES[i];
    detail.innerHTML = "";
    detail.appendChild(B.el("div", { style: { fontFamily: "var(--sans)", fontSize: "11.5px", fontWeight: "700", letterSpacing: ".06em", textTransform: "uppercase", color: s.color } }, "Disease addressed · " + s.disease));
    detail.appendChild(B.el("div", { text: s.body, style: { margin: "8px 0 10px", fontSize: "16px", lineHeight: "1.55" } }));
    detail.appendChild(B.el("div", {
      style: { background: C.panel, borderLeft: "3px solid " + s.color, borderRadius: "6px", padding: "9px 12px", fontSize: "14.5px", color: C.ink, lineHeight: "1.5" }
    }, [B.el("b", { text: "Key idea. " }), document.createTextNode(s.idea)]));
    const w = B.el("div", { style: { marginTop: "11px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" } }, [
      B.el("span", { text: "Representative work:", style: { fontFamily: "var(--sans)", fontSize: "12px", color: C.faint, fontWeight: "600" } })
    ]);
    s.works.forEach(([name, href]) => {
      w.appendChild(B.el("a", { href, text: name, style: { fontFamily: "var(--sans)", fontSize: "12.5px", fontWeight: "600", color: s.color, border: "1px solid " + C.rule, borderRadius: "20px", padding: "3px 10px", textDecoration: "none", background: "#fff" } }));
    });
    detail.appendChild(w);
  }
  select(1);
})();
