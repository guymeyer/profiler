import type { Slide, SlideDeck } from "@/lib/types";

// Standalone HTML renderer for a SlideDeck. Used for download / open-in-tab.
// Full-bleed slide deck with vanilla JS keyboard navigation, slide counter,
// speaker notes toggle ("n"), and a print stylesheet that lays every slide
// out as a paged handout with notes inline.
//
// The in-app deck viewer renders natively — this output is for offline
// presenting (open in a tab, F11 for full screen) and PDF export.

export function renderDeckHtml(deck: SlideDeck): string {
  const slidesHtml = deck.slides
    .map((s, i) => renderSlide(s, i, deck.slides.length))
    .join("\n");

  const slidesNotesEmbedded = JSON.stringify(
    deck.slides.map((s) => s.speakerNotes ?? ""),
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(deck.title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="screen-deck">
    <div class="slides">
      ${slidesHtml}
    </div>

    <nav class="chrome" aria-label="Slide controls">
      <button type="button" class="nav-btn" data-nav="prev" aria-label="Previous slide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="counter">
        <span data-counter-cur>1</span> / <span data-counter-total>${deck.slides.length}</span>
      </div>
      <button type="button" class="nav-btn" data-nav="next" aria-label="Next slide">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
      <button type="button" class="nav-btn notes-btn" data-toggle-notes aria-label="Toggle speaker notes" title="Toggle speaker notes (n)">
        Notes
      </button>
    </nav>

    <aside class="notes-pane" data-notes-pane hidden>
      <div class="notes-label">Speaker notes</div>
      <p data-notes-body>—</p>
    </aside>
  </div>

  <!-- Print-only handout layout: every slide laid out vertically with notes. -->
  <section class="print-handout">
    ${deck.slides
      .map(
        (s, i) => `<article class="handout-slide">
        <div class="handout-num">${String(i + 1).padStart(2, "0")} / ${String(deck.slides.length).padStart(2, "0")} · ${esc(s.kind)}</div>
        ${renderHandoutSlide(s)}
        ${s.speakerNotes ? `<div class="handout-notes"><strong>Notes:</strong> ${esc(s.speakerNotes)}</div>` : ""}
      </article>`,
      )
      .join("\n")}
  </section>

  <script>
    (function() {
      var NOTES = ${slidesNotesEmbedded};
      var slides = document.querySelectorAll('.slide');
      var counterCur = document.querySelector('[data-counter-cur]');
      var notesPane = document.querySelector('[data-notes-pane]');
      var notesBody = document.querySelector('[data-notes-body]');
      var notesBtn = document.querySelector('[data-toggle-notes]');
      var notesOpen = false;
      var index = 0;

      function applyHashIndex() {
        var h = (location.hash || '').replace(/^#/, '');
        var n = parseInt(h, 10);
        if (!isNaN(n) && n >= 1 && n <= slides.length) {
          index = n - 1;
        }
      }

      function render() {
        for (var i = 0; i < slides.length; i++) {
          if (i === index) slides[i].setAttribute('data-active', '');
          else slides[i].removeAttribute('data-active');
        }
        if (counterCur) counterCur.textContent = String(index + 1);
        if (notesBody) notesBody.textContent = NOTES[index] || '(no notes for this slide)';
        try { history.replaceState(null, '', '#' + (index + 1)); } catch (e) {}
      }

      function setNotes(open) {
        notesOpen = open;
        if (notesPane) {
          if (open) notesPane.removeAttribute('hidden');
          else notesPane.setAttribute('hidden', '');
        }
        if (notesBtn) {
          if (open) notesBtn.setAttribute('data-active', '');
          else notesBtn.removeAttribute('data-active');
        }
      }

      function next() { index = Math.min(index + 1, slides.length - 1); render(); }
      function prev() { index = Math.max(index - 1, 0); render(); }

      document.addEventListener('keydown', function(e) {
        var tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
          e.preventDefault(); next();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault(); prev();
        } else if (e.key === 'Home') {
          e.preventDefault(); index = 0; render();
        } else if (e.key === 'End') {
          e.preventDefault(); index = slides.length - 1; render();
        } else if (e.key === 'n' || e.key === 'N') {
          setNotes(!notesOpen);
        } else if (e.key === 'f' || e.key === 'F') {
          // 'f' to toggle fullscreen for in-tab presenting
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
          } else {
            document.exitFullscreen && document.exitFullscreen();
          }
        }
      });

      document.querySelectorAll('[data-nav]').forEach(function(btn) {
        btn.addEventListener('click', function() {
          if (btn.getAttribute('data-nav') === 'next') next();
          else prev();
        });
      });

      if (notesBtn) notesBtn.addEventListener('click', function() { setNotes(!notesOpen); });

      window.addEventListener('hashchange', function() {
        applyHashIndex();
        render();
      });

      applyHashIndex();
      render();
    })();
  </script>
</body>
</html>`;
}

function renderSlide(s: Slide, i: number, total: number): string {
  const active = i === 0 ? " data-active" : "";
  const counter = `<div class="slide-counter">${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;

  if (s.kind === "title") {
    return `<section class="slide slide-title"${active}>
      ${counter}
      <div class="slide-inner center">
        <h2 class="title">${esc(s.title)}</h2>
        ${s.subtitle ? `<div class="subtitle">${esc(s.subtitle)}</div>` : ""}
      </div>
    </section>`;
  }
  if (s.kind === "quote" && s.quote) {
    return `<section class="slide slide-quote"${active}>
      ${counter}
      <div class="slide-inner">
        <div class="quote-mark">&ldquo;</div>
        <blockquote class="quote">${esc(s.quote.text)}</blockquote>
        ${s.quote.attribution ? `<div class="quote-attr">— ${esc(s.quote.attribution)}</div>` : ""}
      </div>
    </section>`;
  }
  if (s.kind === "sources") {
    return `<section class="slide slide-sources"${active}>
      ${counter}
      <div class="slide-inner">
        <div class="eyebrow">Sources</div>
        <h3 class="heading">${esc(s.title)}</h3>
        <ol class="source-list">
          ${(s.bullets ?? []).map((b) => `<li>${esc(b)}</li>`).join("\n")}
        </ol>
      </div>
    </section>`;
  }
  if (s.kind === "narrative") {
    return `<section class="slide slide-narrative"${active}>
      ${counter}
      <div class="slide-inner">
        <div class="eyebrow">${esc(s.subtitle ?? "Narrative")}</div>
        <h3 class="heading">${esc(s.title)}</h3>
        ${s.body ? `<p class="narrative-body">${esc(s.body)}</p>` : ""}
      </div>
    </section>`;
  }
  // insight / implication / setup / decision (bulleted)
  const eyebrow =
    s.kind === "setup"
      ? "Setup"
      : s.kind === "decision"
        ? "Decision"
        : s.kind === "implication"
          ? "Implication"
          : "Insight";
  return `<section class="slide slide-bulleted slide-${esc(s.kind)}"${active}>
    ${counter}
    <div class="slide-inner">
      <div class="eyebrow">${esc(eyebrow)}</div>
      <h3 class="heading">${esc(s.title)}</h3>
      ${
        s.bullets && s.bullets.length > 0
          ? `<ul class="bullets">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("\n")}</ul>`
          : ""
      }
      ${
        s.citations && s.citations.length > 0
          ? `<div class="citations">${s.citations.map((c) => `<em>${esc(c)}</em>`).join(" · ")}</div>`
          : ""
      }
    </div>
  </section>`;
}

function renderHandoutSlide(s: Slide): string {
  if (s.kind === "title") {
    return `<h3 class="handout-title">${esc(s.title)}</h3>${s.subtitle ? `<div class="handout-sub">${esc(s.subtitle)}</div>` : ""}`;
  }
  if (s.kind === "quote" && s.quote) {
    return `<blockquote class="handout-quote">${esc(s.quote.text)}${s.quote.attribution ? `<div class="handout-attr">— ${esc(s.quote.attribution)}</div>` : ""}</blockquote>`;
  }
  if (s.kind === "narrative") {
    return `<h3 class="handout-title">${esc(s.title)}</h3>${s.body ? `<p>${esc(s.body)}</p>` : ""}`;
  }
  return `<h3 class="handout-title">${esc(s.title)}</h3>${
    s.bullets && s.bullets.length > 0
      ? `<ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("\n")}</ul>`
      : ""
  }${
    s.citations && s.citations.length > 0
      ? `<div class="handout-cites">${s.citations.map((c) => `<em>${esc(c)}</em>`).join(" · ")}</div>`
      : ""
  }`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
  :root {
    --bg: #18181b;
    --slide-bg: #ffffff;
    --fg: #18181b;
    --muted: #71717a;
    --line: #e4e4e7;
    --accent: #2563eb;
    --accent-soft: #eff6ff;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--fg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    line-height: 1.5;
  }

  /* ── Screen presentation layout ────────────────────────────────────── */
  .print-handout { display: none; }

  .screen-deck {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 24px;
    gap: 12px;
  }
  .slides {
    position: relative;
    width: 100%;
    max-width: 1280px;
    aspect-ratio: 16 / 9;
    background: var(--slide-bg);
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.25);
    overflow: hidden;
  }
  .slide {
    position: absolute;
    inset: 0;
    display: none;
    padding: 56px 64px;
  }
  .slide[data-active] { display: flex; }
  .slide-inner {
    width: 100%;
    max-width: 920px;
    margin: auto;
  }
  .slide-inner.center { text-align: center; }
  .slide-counter {
    position: absolute;
    top: 20px;
    right: 28px;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .eyebrow {
    display: inline-block;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    font-weight: 700;
    margin-bottom: 14px;
  }
  .heading {
    font-size: 36px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 24px;
  }
  .title {
    font-size: 52px;
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.1;
    margin: 0;
  }
  .subtitle {
    color: var(--muted);
    font-size: 18px;
    margin-top: 16px;
  }
  ul.bullets {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  ul.bullets li {
    font-size: 22px;
    line-height: 1.35;
    color: var(--fg);
    display: flex;
    gap: 14px;
  }
  ul.bullets li::before {
    content: "";
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    margin-top: 11px;
  }
  .citations { margin-top: 24px; font-size: 13px; color: var(--muted); }

  .quote-mark { font-size: 80px; color: var(--accent); line-height: 0.6; opacity: 0.4; margin-bottom: 12px; }
  blockquote.quote {
    margin: 0;
    font-size: 30px;
    font-weight: 500;
    line-height: 1.3;
    color: var(--fg);
  }
  .quote-attr { margin-top: 24px; font-size: 15px; color: var(--muted); }

  ol.source-list { list-style: none; padding: 0; margin: 0; counter-reset: src; }
  ol.source-list li {
    counter-increment: src;
    font-size: 18px;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    display: flex;
    gap: 16px;
  }
  ol.source-list li::before {
    content: counter(src, decimal-leading-zero);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    font-size: 13px;
    padding-top: 4px;
  }

  .narrative-body { font-size: 20px; line-height: 1.5; color: var(--fg); }

  nav.chrome {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 999px;
    padding: 6px 10px;
    color: white;
  }
  .nav-btn {
    appearance: none;
    background: transparent;
    border: 0;
    color: white;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    transition: background 0.15s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .nav-btn:hover { background: rgba(255,255,255,0.1); }
  .nav-btn[data-active] { background: rgba(255,255,255,0.2); }
  .counter { font-size: 13px; color: rgba(255,255,255,0.8); font-variant-numeric: tabular-nums; padding: 0 6px; }

  aside.notes-pane {
    width: 100%;
    max-width: 1280px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 10px;
    color: rgba(255,255,255,0.92);
    padding: 14px 18px;
  }
  .notes-label {
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.5);
    margin-bottom: 6px;
  }

  /* ── Print handout ──────────────────────────────────────────────────── */
  @media print {
    html, body { background: white; color: var(--fg); }
    .screen-deck { display: none; }
    .print-handout {
      display: block;
      max-width: 760px;
      margin: 0 auto;
      padding: 24px;
    }
    .handout-slide {
      page-break-after: always;
      border-bottom: 1px solid var(--line);
      padding: 24px 0;
    }
    .handout-slide:last-child { page-break-after: auto; border-bottom: 0; }
    .handout-num {
      font-size: 11px;
      letter-spacing: 0.08em;
      color: var(--muted);
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .handout-title { font-size: 22px; font-weight: 700; margin: 0 0 12px; }
    .handout-sub { color: var(--muted); margin-bottom: 12px; }
    .handout-quote { font-size: 18px; font-style: italic; border-left: 3px solid var(--accent); padding-left: 16px; margin: 0 0 12px; }
    .handout-attr { font-size: 13px; color: var(--muted); font-style: normal; margin-top: 6px; }
    .handout-slide ul { padding-left: 20px; margin: 0 0 12px; }
    .handout-slide li { margin: 4px 0; font-size: 14px; }
    .handout-cites { font-size: 12px; color: var(--muted); }
    .handout-notes { font-size: 13px; color: var(--muted); margin-top: 12px; padding-top: 8px; border-top: 1px dashed var(--line); }
  }
`;
