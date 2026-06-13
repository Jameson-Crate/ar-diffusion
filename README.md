# From Diffusion to Real-Time World Models — an interactive blog

A static, **no-build** interactive article tracing the arc from diffusion & flow matching →
bidirectional video diffusion → the autoregressive "forcing" lineage (Diffusion Forcing → CausVid →
Self Forcing → Self Forcing++ / Rolling Forcing / LongLive / Causal Forcing) → memory (RELIC,
Matrix-Game 3.0, LingBot-World) → the **FlashDreams** serving layer.

Researcher-level, math-forward (KaTeX), with **10 interactive figures** (vanilla JS + Canvas/SVG).

## View it

It's a static site. Because it loads local JS and KaTeX assets, serve it over HTTP (don't open
`index.html` via `file://`):

```bash
cd /media/big/Learning/ar-flow-models
python -m http.server 8000
# then open http://localhost:8000
```

Any static server works (`npx serve`, etc.). No dependencies to install — KaTeX is vendored under
`vendor/katex/`, so math renders fully offline.

## Layout

```
index.html            the article (prose, math, figure containers)
styles.css            Distill-style light theme
js/
  main.js             KaTeX render, TOC/scroll chrome, shared demo utilities (window.Blog)
  diffusion-slider.js Fig 1  forward/reverse diffusion bridge
  flow-field.js       Fig 2  marginal velocity field + few-step Euler sampling
  drift-demo.js       Fig 4  exposure bias / drift (teacher vs free-run vs diffusion forcing)
  attention-masks.js  Fig 3  bidirectional / causal / diffusion-forcing / rolling-window+sinks
  pipeline.js         Fig 7  the 4-stage training pipeline (clickable)
  fps-bench.js        Fig 10 FPS vs frame-time budget, with FlashDreams speedups
  serving-loop.js     Fig 8  prefill→decode vs initialize→decode
  kv-cache.js         Fig 9  static KV cache + local window + CUDA graphs vs the budget
  consistency.js      Fig 5  look-away/look-back consistency (schematic)
  pose-kv.js          Fig 6  pose-aware compressed KV retrieval (schematic)
vendor/katex/         locally vendored KaTeX (offline math)
```

## Notes

- Figures labeled **schematic** illustrate a mechanism; they are not running a real model.
- Every claim is cited in the References section. Established works are link-verified; very recent /
  closed / derivative systems are tagged **as reported**.
- Animations pause when off-screen and honor `prefers-reduced-motion`.
