import {
  SYNTHESIS_LENSES,
  type PersonLensDepth,
  type PersonLensSection,
  type SynthesisOutline,
  type SynthesisLensSection,
  type SynthesisLensId,
} from "@/lib/types";

// Standalone HTML renderer for offline download / open-in-tab. The in-app
// viewer renders the outline natively (so the URL can carry the active lens).
// This output is for offline use only; the sidebar + depth toggle below use
// URL hash so the artifact stays self-contained.
//
// `defaultLens` may be either a functional lens id ("product-design") or a
// person-prefixed id ("person-<personId>"). `defaultDepth` only applies to
// person lenses.

export interface RenderOptions {
  defaultLens?: SynthesisLensId | `person-${string}`;
  defaultDepth?: PersonLensDepth;
}

export function renderSynthesisHtml(
  outline: SynthesisOutline,
  options: RenderOptions = {},
): string {
  const presentLenses = SYNTHESIS_LENSES.filter((l) => outline.lenses[l.id]);
  const peopleLenses = outline.people ?? [];

  // Resolve default lens, falling back to general.
  let defaultLens: string =
    options.defaultLens ??
    presentLenses.find((l) => l.id === "general")?.id ??
    presentLenses[0]?.id ??
    "general";
  if (defaultLens.startsWith("person-")) {
    const pid = defaultLens.slice("person-".length);
    if (!peopleLenses.some((p) => p.personId === pid)) {
      defaultLens = presentLenses[0]?.id ?? "general";
    }
  } else if (!presentLenses.some((l) => l.id === defaultLens)) {
    defaultLens = presentLenses[0]?.id ?? "general";
  }
  const defaultDepth: PersonLensDepth =
    options.defaultDepth === "exec" ? "exec" : "brief";

  // Sidebar items
  const functionalItems = presentLenses
    .map(
      (l) =>
        `<li><a class="lens-link" href="#lens=${l.id}" data-lens-link="${l.id}"${
          l.id === defaultLens ? ' aria-current="page"' : ""
        }><span class="lens-name">${esc(l.name)}</span><span class="lens-brief">${esc(l.brief)}</span></a></li>`,
    )
    .join("\n");

  const personItems = peopleLenses
    .map((p) => {
      const key = `person-${p.personId}`;
      return `<li><a class="lens-link lens-person" href="#lens=${key}&depth=${defaultDepth}" data-lens-link="${key}"${
        key === defaultLens ? ' aria-current="page"' : ""
      }><span class="avatar" aria-hidden="true">${esc(initials(p.personName))}</span><span class="lens-name">${esc(p.personName)}</span></a></li>`;
    })
    .join("\n");

  // Functional sections rendered once per functional lens
  const summaryBlock = renderLensBlock(outline, defaultLens, (s) =>
    renderSummaryWithHmw(s),
  );
  const insightsBlock = renderLensBlock(outline, defaultLens, (s) =>
    renderInsights(s),
  );
  const implicationsBlock = renderLensBlock(outline, defaultLens, (s) =>
    renderBulletList(s.implications),
  );
  const tensionsBlock = renderLensBlock(outline, defaultLens, (s) =>
    renderBulletList(s.tensions),
  );
  const nextBlock = renderLensBlock(outline, defaultLens, (s) =>
    renderOrderedList(s.next),
  );

  // Person sections — wrapped so the whole functional area can be hidden when
  // a person lens is active.
  const personBlocks = peopleLenses
    .map((p) => renderPersonLensBlock(p, defaultLens, defaultDepth))
    .join("\n");

  const sourcesList = outline.sources
    .map(
      (src) => `
        <li>
          <strong>${esc(src.title)}</strong>
          <p>${esc(src.summary)}</p>
        </li>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(outline.title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-eyebrow">Read this for · function</div>
        <ul class="lens-list">
          ${functionalItems}
        </ul>
        ${
          peopleLenses.length > 0
            ? `<div class="sidebar-eyebrow with-divider">Read this for · person</div>
        <ul class="lens-list">
          ${personItems}
        </ul>`
            : ""
        }
        <div class="sidebar-footnote">
          Lens state lives in the URL hash — share the address to share the view.
        </div>
      </div>
    </aside>

    <main class="content">
      <header class="hero">
        <div class="eyebrow">Research synthesis</div>
        <h1>${esc(outline.title)}</h1>
      </header>

      <!-- Person lens content. Only shown when a person lens is active. -->
      <div class="person-area" data-lens-area="person">
        ${personBlocks}
      </div>

      <!-- Functional lens content. Hidden when a person lens is active. -->
      <div class="functional-area" data-lens-area="functional">
        <nav class="toc" aria-label="Sections">
          <ul>
            <li><a href="#overview">Overview</a></li>
            <li><a href="#for-this-lens">For this lens</a></li>
            <li><a href="#insights">Insights</a></li>
            <li><a href="#implications">Implications</a></li>
            <li><a href="#tensions">Tensions &amp; gaps</a></li>
            <li><a href="#next">What to do next</a></li>
            <li><a href="#sources">Sources</a></li>
          </ul>
        </nav>

        <section id="overview">
          <h2>Overview</h2>
          <p>${esc(outline.overview)}</p>
        </section>

        <section id="for-this-lens">
          <h2>For this lens</h2>
          ${summaryBlock}
        </section>

        <section id="insights">
          <h2>Insights</h2>
          ${insightsBlock}
        </section>

        <section id="implications">
          <h2>Implications</h2>
          ${implicationsBlock}
        </section>

        <section id="tensions">
          <h2>Tensions &amp; gaps</h2>
          ${tensionsBlock}
        </section>

        <section id="next">
          <h2>What to do next</h2>
          ${nextBlock}
        </section>
      </div>

      <section id="sources">
        <h2>Sources</h2>
        <ul class="sources">${sourcesList}</ul>
      </section>

      <footer>
        <span class="muted">Synthesis · ${outline.sources.length} source${outline.sources.length === 1 ? "" : "s"}</span>
      </footer>
    </main>
  </div>

  <script>
    (function() {
      // Parse hash like "lens=foo&depth=brief".
      function parseHash() {
        var h = (location.hash || '').replace(/^#/, '');
        var lens = null, depth = null;
        var parts = h.split('&');
        for (var i = 0; i < parts.length; i++) {
          var kv = parts[i].split('=');
          if (kv[0] === 'lens') lens = kv[1];
          if (kv[0] === 'depth') depth = kv[1];
        }
        return { lens: lens, depth: depth };
      }

      function applyLens(lens, depth) {
        var isPerson = lens && lens.indexOf('person-') === 0;

        // Toggle area visibility.
        var personArea = document.querySelector('[data-lens-area="person"]');
        var funcArea = document.querySelector('[data-lens-area="functional"]');
        if (personArea) personArea.style.display = isPerson ? 'block' : 'none';
        if (funcArea) funcArea.style.display = isPerson ? 'none' : 'block';

        // Functional lens blocks — show only the matching one.
        var funcNodes = document.querySelectorAll('[data-lens]');
        for (var i = 0; i < funcNodes.length; i++) {
          var key = funcNodes[i].getAttribute('data-lens');
          if (!isPerson && key === lens) {
            funcNodes[i].setAttribute('data-active', '');
          } else {
            funcNodes[i].removeAttribute('data-active');
          }
        }

        // Person lens blocks — show only the matching one.
        var personBlocks = document.querySelectorAll('[data-person-lens]');
        for (var j = 0; j < personBlocks.length; j++) {
          var pkey = personBlocks[j].getAttribute('data-person-lens');
          if (isPerson && lens === 'person-' + pkey) {
            personBlocks[j].setAttribute('data-active', '');
          } else {
            personBlocks[j].removeAttribute('data-active');
          }
        }

        // Depth — only meaningful for person lens.
        var d = depth === 'exec' ? 'exec' : 'brief';
        var depthNodes = document.querySelectorAll('[data-depth]');
        for (var k = 0; k < depthNodes.length; k++) {
          if (depthNodes[k].getAttribute('data-depth') === d) {
            depthNodes[k].setAttribute('data-active', '');
          } else {
            depthNodes[k].removeAttribute('data-active');
          }
        }
        var depthButtons = document.querySelectorAll('[data-depth-link]');
        for (var m = 0; m < depthButtons.length; m++) {
          if (depthButtons[m].getAttribute('data-depth-link') === d) {
            depthButtons[m].setAttribute('aria-current', 'page');
          } else {
            depthButtons[m].removeAttribute('aria-current');
          }
        }

        // Sidebar active highlight.
        var links = document.querySelectorAll('[data-lens-link]');
        for (var n = 0; n < links.length; n++) {
          if (links[n].getAttribute('data-lens-link') === lens) {
            links[n].setAttribute('aria-current', 'page');
          } else {
            links[n].removeAttribute('aria-current');
          }
        }
      }

      function applyFromHash() {
        var s = parseHash();
        applyLens(s.lens || ${JSON.stringify(defaultLens)}, s.depth || ${JSON.stringify(defaultDepth)});
      }

      applyFromHash();
      window.addEventListener('hashchange', applyFromHash);

      // Depth toggle clicks — they're anchor links that change hash; the
      // browser handles the hash update natively.

      // ── Per-HMW prompt copy (unchanged behavior) ──────────────────────
      var CTX = ${JSON.stringify(buildPromptContext(outline))};

      function stripHmwPrefix(q) {
        return q.replace(/^how\\s+might\\s+we\\s+/i, '').trim();
      }
      function buildHmwPrompt(q) {
        var insights = (CTX.insights || []).slice(0, 5).map(function(i, idx) {
          return '### ' + (idx + 1) + '. ' + i.headline + '\\n' + i.body;
        }).join('\\n\\n') || '(no insights in this synthesis)';
        var sources = (CTX.sources || []).map(function(s) {
          return '- ' + s.title;
        }).join('\\n') || '(no sources listed)';
        return [
          '# Build me a visual prototype for this HMW',
          '',
          'I want a single visual prototype that responds to the "How might we" question below. Use the surrounding context to ground the design, but stay laser-focused on this one question.',
          '',
          '## The question',
          '',
          '**How might we ' + stripHmwPrefix(q) + '**',
          '',
          '## Surrounding context',
          '',
          '### Synthesis: ' + (CTX.title || ''),
          '',
          '### Overview',
          CTX.overview || '(no overview provided)',
          '',
          '### Key insights from the corpus',
          insights,
          '',
          '### Source research',
          sources,
          '',
          '## What I need',
          '',
          'Build a visual prototype (as a Claude Artifact — prefer self-contained HTML + CSS, or a single React component if interactivity helps) that responds to the HMW above.',
          '',
          '## Constraints',
          '',
          '- One prototype, not a full app. The smallest UI that\\'s still meaningful.',
          '- Show the moment-of-use: the screen the user is on when this matters most.',
          '- Inline annotations (small text or callouts) linking parts of the design to specific insights from the context — be explicit about how the design answers the HMW.',
          '- Restrained, modern aesthetic: system font stack, generous whitespace, light background. No emoji decoration, no stock illustrations.',
          '- Fidelity over completeness. Don\\'t sketch ten screens; nail one.',
          '',
          'Begin with one sentence on the angle you\\'re taking, then deliver the prototype artifact.'
        ].join('\\n');
      }
      function flashCopied(btn) {
        btn.setAttribute('data-copied', '');
        setTimeout(function() { btn.removeAttribute('data-copied'); }, 1800);
      }
      document.addEventListener('click', function(e) {
        var target = e.target;
        var btn = target.closest ? target.closest('.hmw-copy') : null;
        if (!btn) return;
        e.preventDefault();
        var q = btn.getAttribute('data-hmw') || '';
        var prompt = buildHmwPrompt(q);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(prompt).then(
            function() { flashCopied(btn); },
            function() { window.prompt('Copy this prompt', prompt); }
          );
        } else {
          window.prompt('Copy this prompt', prompt);
        }
      });
    })();
  </script>
</body>
</html>`;
}

function renderPersonLensBlock(
  pl: PersonLensSection,
  defaultLens: string,
  defaultDepth: PersonLensDepth,
): string {
  const key = `person-${pl.personId}`;
  const activeAttr = key === defaultLens ? " data-active" : "";
  const briefAttr = defaultDepth === "brief" ? " data-active" : "";
  const execAttr = defaultDepth === "exec" ? " data-active" : "";
  const briefAria = defaultDepth === "brief" ? ' aria-current="page"' : "";
  const execAria = defaultDepth === "exec" ? ' aria-current="page"' : "";
  const baseHref = `#lens=${key}`;

  const fb = pl.fullBrief;
  const briefHmw =
    fb.hmwQuestions && fb.hmwQuestions.length > 0
      ? `<div class="hmw">
        <div class="hmw-eyebrow">How might we</div>
        <ol class="hmw-list">
          ${fb.hmwQuestions
            .map(
              (q, i) => `<li>
              <span class="hmw-num">${String(i + 1).padStart(2, "0")}</span>
              <span class="hmw-text">${esc(q)}</span>
              <button type="button" class="hmw-copy" data-hmw="${esc(q)}" aria-label="Copy prototype prompt" title="Copy prototype prompt">
                <svg class="i-clip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                <svg class="i-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </button>
            </li>`,
            )
            .join("\n")}
        </ol>
      </div>`
      : "";

  const exec = pl.executiveSummary;

  return `<div class="person-block" data-person-lens="${pl.personId}"${activeAttr}>
    <header class="person-hero">
      <div class="person-eyebrow">Person lens · microscopic read</div>
      <div class="person-row">
        <span class="avatar lg" aria-hidden="true">${esc(initials(pl.personName))}</span>
        <div>
          <h2 class="person-name">${esc(pl.personName)}</h2>
          <div class="person-sub">Filtered through this person&apos;s profile</div>
        </div>
      </div>
      <div class="depth-toggle" role="tablist" aria-label="Depth">
        <a class="depth-btn" data-depth-link="brief"${briefAria} role="tab" href="${baseHref}&depth=brief">Full brief</a>
        <a class="depth-btn" data-depth-link="exec"${execAria} role="tab" href="${baseHref}&depth=exec">Executive summary</a>
      </div>
    </header>

    <div class="depth-block" data-depth="brief"${briefAttr}>
      <section><h2>Summary</h2><p>${esc(fb.summary)}</p>${briefHmw}</section>
      <section><h2>Insights</h2>${renderInsights(fb)}</section>
      <section><h2>Implications</h2>${renderBulletList(fb.implications)}</section>
      <section><h2>Tensions &amp; gaps</h2>${renderBulletList(fb.tensions)}</section>
      <section><h2>What to do next</h2>${renderOrderedList(fb.next)}</section>
    </div>

    <div class="depth-block" data-depth="exec"${execAttr}>
      <section><h2>TL;DR</h2><p class="tldr">${esc(exec.tldr)}</p></section>
      <section><h2>Key points</h2><ol class="ordered">${exec.keyPoints
        .map((k) => `<li>${esc(k)}</li>`)
        .join("\n")}</ol></section>
      <section><h2>Call to action</h2><p class="cta">${esc(exec.callToAction)}</p></section>
    </div>
  </div>`;
}

function renderLensBlock(
  outline: SynthesisOutline,
  defaultLens: string,
  render: (s: SynthesisLensSection) => string,
): string {
  return SYNTHESIS_LENSES.filter((l) => outline.lenses[l.id])
    .map((l) => {
      const section = outline.lenses[l.id]!;
      const active = (l.id as SynthesisLensId) === defaultLens ? " data-active" : "";
      return `<div data-lens="${l.id}"${active}>${render(section)}</div>`;
    })
    .join("\n");
}

function renderSummaryWithHmw(s: SynthesisLensSection): string {
  const hmwBlock =
    s.hmwQuestions && s.hmwQuestions.length > 0
      ? `<div class="hmw">
          <div class="hmw-eyebrow">How might we</div>
          <ol class="hmw-list">
            ${s.hmwQuestions
              .map(
                (q, i) => `<li>
                <span class="hmw-num">${String(i + 1).padStart(2, "0")}</span>
                <span class="hmw-text">${esc(q)}</span>
                <button type="button" class="hmw-copy" data-hmw="${esc(q)}" aria-label="Copy prototype prompt for this HMW" title="Copy prototype prompt">
                  <svg class="i-clip" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <svg class="i-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
              </li>`,
              )
              .join("\n")}
          </ol>
        </div>`
      : "";
  return `<p>${esc(s.summary)}</p>${hmwBlock}`;
}

function renderInsights(s: SynthesisLensSection): string {
  if (s.insights.length === 0)
    return `<p class="muted">No insights for this lens.</p>`;
  return s.insights
    .map(
      (i) => `
        <article>
          <h3>${esc(i.headline)}</h3>
          <p>${esc(i.body)}</p>
          ${
            i.citations && i.citations.length > 0
              ? `<p class="cite">Citations: ${i.citations
                  .map((c) => `<em>[${esc(c)}]</em>`)
                  .join(", ")}</p>`
              : ""
          }
        </article>`,
    )
    .join("\n");
}

function renderBulletList(items: string[]): string {
  if (items.length === 0)
    return `<p class="muted">No items for this lens.</p>`;
  return `<ul class="bullets">${items
    .map((x) => `<li>${esc(x)}</li>`)
    .join("\n")}</ul>`;
}

function renderOrderedList(items: string[]): string {
  if (items.length === 0)
    return `<p class="muted">No items for this lens.</p>`;
  return `<ol class="ordered">${items
    .map((x) => `<li>${esc(x)}</li>`)
    .join("\n")}</ol>`;
}

function buildPromptContext(outline: SynthesisOutline) {
  const general =
    outline.lenses.general ?? Object.values(outline.lenses)[0];
  return {
    title: outline.title,
    overview: outline.overview,
    insights: (general?.insights ?? []).map((i) => ({
      headline: i.headline,
      body: i.body,
    })),
    sources: (outline.sources ?? []).map((s) => ({ title: s.title })),
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
  /*
    Notion-shaped microsite: near-monochrome, document-first, generous
    whitespace. Headings carry hierarchy through weight/size, not color.
    The sidebar reads as a navigation column, not a UI panel.
  */
  :root {
    --bg: #ffffff;
    --fg: #1f1f1f;
    --muted: #6b6b6b;
    --line: #ececec;
    --accent: #2563eb; /* links + hover only */
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    line-height: 1.6;
    font-size: 15px;
    letter-spacing: -0.003em;
  }
  .layout {
    display: grid;
    grid-template-columns: 220px 1fr;
    max-width: 980px;
    margin: 0 auto;
    gap: 48px;
    padding: 40px 32px 96px;
  }
  @media (max-width: 880px) {
    .layout { grid-template-columns: 1fr; gap: 16px; padding: 24px; }
    .sidebar { position: static !important; }
  }

  aside.sidebar { position: sticky; top: 32px; align-self: start; }
  .sidebar-inner { padding: 0; }
  .sidebar-eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--muted);
    padding: 8px 4px 6px;
  }
  .sidebar-eyebrow.with-divider {
    border-top: 1px solid var(--line);
    margin-top: 16px;
    padding-top: 18px;
  }
  ul.lens-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
  a.lens-link {
    display: block;
    padding: 4px 6px;
    border-radius: 4px;
    color: var(--muted);
    text-decoration: none;
    transition: background 0.1s ease, color 0.1s ease;
  }
  a.lens-link:hover { background: #f4f4f3; color: var(--fg); }
  a.lens-link[aria-current="page"] { background: #f4f4f3; color: var(--fg); }
  a.lens-link[aria-current="page"] .lens-name { color: var(--fg); font-weight: 600; }
  .lens-name { display: block; font-size: 13px; line-height: 1.4; }
  .lens-brief { display: none; }
  a.lens-person { display: flex; align-items: center; gap: 8px; }
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #f4f4f3;
    color: var(--muted);
    font-weight: 600;
    font-size: 10px;
    letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .avatar.lg { width: 40px; height: 40px; font-size: 14px; }
  .sidebar-footnote {
    padding: 14px 4px 0;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.5;
    border-top: 1px solid var(--line);
    margin-top: 16px;
  }

  main.content { min-width: 0; }
  header.hero { padding-bottom: 28px; margin-bottom: 8px; }
  header.hero .eyebrow {
    display: inline-block;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
    margin-bottom: 14px;
  }
  header.hero h1 {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0;
  }

  /* Functional area (default) */
  nav.toc {
    padding: 0 0 8px;
    margin: 0 0 16px;
    border-bottom: 1px solid var(--line);
  }
  nav.toc ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 16px; flex-wrap: wrap; }
  nav.toc a {
    color: var(--muted);
    text-decoration: none;
    font-size: 12px;
    font-weight: 500;
    padding: 2px 0;
  }
  nav.toc a:hover { color: var(--fg); }
  section { scroll-margin-top: 24px; padding: 24px 0; border-top: 1px solid var(--line); }
  section:first-of-type { border-top: 0; padding-top: 12px; }
  section h2 { font-size: 18px; font-weight: 600; margin: 0 0 14px; letter-spacing: -0.015em; }
  [data-lens] { display: none; }
  [data-lens][data-active] { display: block; }
  article { padding: 14px 0; border-top: 1px solid var(--line); }
  article:first-of-type { border-top: 0; padding-top: 0; }
  article h3 { font-size: 15px; margin: 0 0 6px; font-weight: 600; }
  article p { margin: 0 0 8px; }
  .cite { font-size: 12px; color: var(--muted); }

  /* Person area */
  .person-area { display: none; }
  .person-block { display: none; }
  .person-block[data-active] { display: block; }
  .person-hero { padding-bottom: 18px; margin-bottom: 8px; border-bottom: 1px solid var(--line); }
  .person-eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-weight: 500;
    margin-bottom: 12px;
  }
  .person-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
  .person-name { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.015em; }
  .person-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }
  .depth-toggle {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 2px;
    background: var(--bg);
  }
  .depth-btn {
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--muted);
    text-decoration: none;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
  }
  .depth-btn:hover { color: var(--fg); }
  .depth-btn[aria-current="page"] { background: #f4f4f3; color: var(--fg); }
  .depth-block { display: none; }
  .depth-block[data-active] { display: block; }
  p.tldr { font-size: 17px; font-weight: 500; line-height: 1.5; }
  p.cta {
    border-left: 2px solid var(--fg);
    padding: 4px 14px;
    font-style: italic;
    color: var(--fg);
    margin: 0;
  }

  .hmw { margin-top: 20px; }
  .hmw-eyebrow {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 500;
    color: var(--muted);
    margin-bottom: 10px;
  }
  ol.hmw-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
  ol.hmw-list li {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 6px 0;
    font-size: 14px;
    line-height: 1.5;
    border-bottom: 1px solid var(--line);
  }
  ol.hmw-list li:last-child { border-bottom: 0; }
  .hmw-num {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--muted);
    padding-top: 3px;
    width: 22px;
    flex-shrink: 0;
  }
  .hmw-text { flex: 1; min-width: 0; }
  button.hmw-copy {
    appearance: none;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.1s ease, background 0.1s ease;
  }
  button.hmw-copy:hover { color: var(--fg); background: #f4f4f3; }
  button.hmw-copy:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
  button.hmw-copy .i-check { display: none; }
  button.hmw-copy[data-copied] { color: var(--fg); }
  button.hmw-copy[data-copied] .i-clip { display: none; }
  button.hmw-copy[data-copied] .i-check { display: inline; }

  a { color: var(--fg); }
  a:hover { color: var(--accent); }
  ul.bullets, ol.ordered { padding-left: 20px; margin: 0; }
  ul.bullets li, ol.ordered li { margin: 6px 0; }
  ul.sources { list-style: none; padding: 0; }
  ul.sources li { padding: 14px 0; border-top: 1px solid var(--line); }
  ul.sources li:first-child { border-top: 0; padding-top: 0; }
  ul.sources p { margin: 6px 0 0; color: var(--fg); }
  .muted { color: var(--muted); }
  footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 11px;
  }
`;
