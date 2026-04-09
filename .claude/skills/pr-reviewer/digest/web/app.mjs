const STYLE_ID = 'pr-reviewer-digest-style';
const HIGHLIGHT_STYLE_ID = 'pr-reviewer-digest-highlight-style';
const HIGHLIGHT_SCRIPT_ID = 'pr-reviewer-digest-highlight-script';

const STYLES = `
  :root {
    --color-fg-default: #1f2328;
    --color-fg-muted: #656d76;
    --color-fg-accent: #0969da;
    --color-bg-default: #ffffff;
    --color-bg-subtle: #f6f8fa;
    --color-border-default: #d0d7de;
    --color-border-muted: #d8dee4;
    --color-neutral-muted: rgba(175, 184, 193, 0.2);
    color: var(--color-fg-default);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--color-bg-default);
    color: var(--color-fg-default);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  #app-root {
    min-height: auto;
  }

  .digest-shell {
    width: min(980px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 32px 0 40px;
  }

  .digest-header {
    margin-bottom: 16px;
    padding: 0 0 8px;
  }

  .digest-eyebrow {
    margin: 0 0 8px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-fg-muted);
  }

  .digest-title {
    margin: 0;
    font-size: 24px;
    line-height: 1.25;
    font-weight: 600;
  }

  .digest-subtitle {
    margin: 12px 0 0;
    color: var(--color-fg-muted);
    font-size: 14px;
    line-height: 1.5;
  }

  .digest-summary {
    margin-top: 16px;
    padding: 16px 18px;
    border: 1px solid var(--color-border-muted);
    border-radius: 16px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  }

  .digest-summary > :last-child {
    margin-bottom: 0;
  }

  .digest-stack {
    display: grid;
    gap: 24px;
  }

  .digest-section {
    padding: 0;
  }

  .digest-section-heading {
    margin: 0 0 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border-muted);
    font-size: 18px;
    line-height: 1.25;
    font-weight: 600;
  }

  .digest-md {
    color: var(--color-fg-default);
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .digest-md > :first-child { margin-top: 0; }
  .digest-md > :last-child { margin-bottom: 0; }

  .digest-md h1,
  .digest-md h2,
  .digest-md h3 {
    margin-top: 24px;
    margin-bottom: 16px;
    font-weight: 600;
    line-height: 1.25;
  }

  .digest-md h1:first-child,
  .digest-md h2:first-child,
  .digest-md h3:first-child {
    margin-top: 0;
  }

  .digest-md h1 {
    font-size: 1.5em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--color-border-muted);
  }

  .digest-md h2 {
    font-size: 1.25em;
    padding-bottom: 0.3em;
    border-bottom: 1px solid var(--color-border-muted);
  }

  .digest-md h3 {
    font-size: 1em;
  }

  .digest-md p {
    margin: 0 0 16px;
  }

  .digest-md img,
  .digest-md svg {
    max-width: 100%;
    height: auto;
  }

  .digest-md a {
    color: var(--color-fg-accent);
    text-decoration: none;
  }

  .digest-md a:hover {
    text-decoration: underline;
  }

  .digest-md blockquote {
    border-left: 0.25em solid var(--color-border-default);
    padding: 0 1em;
    margin: 0 0 16px;
    color: var(--color-fg-muted);
  }

  .digest-md hr {
    display: none;
  }

  .digest-md table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
  }

  .digest-md .mermaid {
    margin: 16px 0;
    overflow-x: auto;
  }

  .digest-md .mermaid svg {
    display: block;
    max-width: 100%;
    height: auto;
  }

  .digest-md th,
  .digest-md td {
    padding: 6px 13px;
    border: 1px solid var(--color-border-muted);
    text-align: left;
    vertical-align: top;
  }

  .digest-md th {
    background: var(--color-bg-subtle);
  }

  .digest-md pre,
  .digest-code pre {
    margin: 0;
    overflow-x: auto;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid var(--color-border-muted);
    background: var(--color-bg-subtle);
    color: var(--color-fg-default);
    font-size: 85%;
    line-height: 1.45;
  }

  .digest-md code,
  .digest-code code {
    font-family: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  }

  .digest-md code {
    background: var(--color-neutral-muted);
    padding: 0.2em 0.4em;
    border-radius: 6px;
    font-size: 85%;
  }

  .digest-md pre code,
  .digest-code pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: inherit;
    color: inherit;
  }

  .digest-md details {
    margin: 0 0 16px;
    border: 1px solid var(--color-border-muted);
    border-radius: 10px;
    background: var(--color-bg-default);
  }

  .digest-md details summary {
    display: list-item;
    padding: 8px 12px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-fg-muted);
    background: var(--color-bg-subtle);
    cursor: pointer;
    user-select: none;
  }

  .digest-md details[open] summary {
    border-bottom: 1px solid var(--color-border-muted);
  }

  .digest-md details[open] {
    padding-bottom: 12px;
  }

  .digest-md details > *:not(summary) {
    margin-left: 12px;
    margin-right: 12px;
  }

  .digest-md details > p:first-of-type {
    margin-top: 12px;
  }

  .digest-md details > p:last-of-type {
    margin-bottom: 12px;
  }

  .digest-md details > pre,
  .digest-md details > blockquote {
    margin: 12px;
  }

  .digest-overview-ui {
    margin-top: 20px;
    border: 1px solid var(--color-border-muted);
    border-radius: 16px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
  }

  .digest-overview-frame {
    display: block;
    width: 100%;
    min-height: 420px;
    border: 0;
    background: #fff;
  }

  .digest-highlights {
    display: grid;
    gap: 28px;
  }

  .digest-highlight {
    border: 1px solid var(--color-border-muted);
    border-radius: 16px;
    padding: 18px;
    background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
  }

  .digest-highlight-title {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .digest-highlight-title-row {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: flex-start;
  }

  .digest-highlight-title h3 {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
    font-weight: 600;
  }

  .digest-code {
    margin-bottom: 14px;
  }

  .digest-code-label {
    color: var(--color-fg-muted);
    font-size: 12px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .digest-highlight-body {
    display: grid;
    gap: 12px;
  }

  .digest-highlight-body .digest-md p {
    margin: 0;
  }

  .digest-submit {
    margin-top: 12px;
    padding-top: 18px;
    border-top: 1px solid var(--color-border-muted);
    display: flex;
    justify-content: flex-end;
  }

  .digest-button:focus {
    outline: none;
    border-color: var(--color-fg-accent);
    box-shadow: inset 0 0 0 1px var(--color-fg-accent);
  }

  .digest-button {
    appearance: none;
    border: 1px solid rgba(27, 31, 36, 0.15);
    border-radius: 999px;
    padding: 6px 18px;
    font: inherit;
    line-height: 20px;
    font-weight: 600;
    cursor: pointer;
    background: #111827;
    color: #fff;
  }

  @media (max-width: 720px) {
    .digest-shell {
      width: min(100vw - 20px, 100%);
      padding: 24px 0 32px;
    }

    .digest-title {
      font-size: 22px;
    }

    .digest-stack {
      gap: 20px;
    }

    .digest-section-heading {
      margin-bottom: 14px;
      font-size: 16px;
    }

    .digest-highlight {
      padding: 14px;
    }

    .digest-highlight-title-row {
      flex-direction: column;
      align-items: stretch;
    }

    .digest-md table {
      display: block;
      overflow-x: auto;
    }
  }

  @media (max-width: 540px) {
    .digest-shell {
      width: min(100vw - 16px, 100%);
      padding-top: 20px;
    }

    .digest-eyebrow {
      margin-bottom: 6px;
      font-size: 11px;
    }

    .digest-title {
      font-size: 20px;
      line-height: 1.3;
    }

    .digest-subtitle {
      margin-top: 8px;
      font-size: 13px;
    }

    .digest-md,
    .digest-code-label {
      font-size: 12px;
    }

    .digest-md pre,
    .digest-code pre {
      padding: 12px;
    }

    .digest-button {
      width: 100%;
      justify-content: center;
    }

    .digest-submit {
      justify-content: stretch;
    }
  }
`;

let markedPromise;
let mermaidPromise;

const UI_COPY = {
  eyebrow: 'PR Digest',
  overviewHeading: 'Overview',
  keyChangesHeading: 'Key Changes',
  fallbackHighlight: 'Key Change',
  done: 'Done',
};

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = STYLES;
  document.head.appendChild(style);
}

async function ensureDigestAssets() {
  injectStyles();
  await Promise.all([
    ensureStylesheet(
      HIGHLIGHT_STYLE_ID,
      'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css',
    ),
    ensureHighlightJS(),
  ]);
}

async function getMarked() {
  if (!markedPromise) {
    markedPromise = import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js').then((mod) => mod.marked);
  }
  return markedPromise;
}

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then((mod) => mod.default || mod);
  }
  return mermaidPromise;
}

async function highlightBlocks(container) {
  const hljs = await ensureHighlightJS();
  container.querySelectorAll('pre code').forEach((el) => {
    if (el.classList.contains('language-mermaid') || el.dataset.hljsDone === 'true') {
      return;
    }
    hljs.highlightElement(el);
    el.dataset.hljsDone = 'true';
  });
}

function bindDetailsHighlight(container) {
  container.querySelectorAll('details').forEach((details) => {
    if (details.dataset.hlBound === 'true') {
      return;
    }
    details.dataset.hlBound = 'true';
    details.addEventListener('toggle', () => {
      if (details.open) {
        highlightBlocks(details).catch(() => {});
      }
    });
  });
}

async function renderMermaidBlocks(container) {
  const blocks = [...container.querySelectorAll('pre code.language-mermaid')];
  if (!blocks.length) {
    return;
  }

  const mermaid = await getMermaid();
  mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

  for (const [index, block] of blocks.entries()) {
    const pre = block.closest('pre');
    if (!pre) {
      continue;
    }

    try {
      const { svg, bindFunctions } = await mermaid.render(
        `pr-reviewer-digest-mermaid-${index}`,
        block.textContent || '',
      );
      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid';
      wrapper.innerHTML = svg;
      bindFunctions?.(wrapper);
      pre.replaceWith(wrapper);
    } catch (error) {
      console.error('Failed to render mermaid SVG', error);
    }
  }
}

async function renderMarkdown(target, markdown) {
  try {
    const marked = await getMarked();
    target.innerHTML = sanitizeHTML(marked.parse(markdown || '', { gfm: true, breaks: true }));
    try {
      await renderMermaidBlocks(target);
    } catch (error) {
      console.error('Failed to render mermaid block', error);
    }
    try {
      await highlightBlocks(target);
      bindDetailsHighlight(target);
    } catch (error) {
      console.error('Failed to highlight code block', error);
    }
  } catch (error) {
    console.error('Failed to render markdown block', error);
    const fallback = document.createElement('pre');
    fallback.textContent = markdown || '';
    target.replaceChildren(fallback);
  }
}

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'strong', 'em', 'del', 'b', 'i', 'u', 's',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'details', 'summary',
  'div', 'span',
  'dl', 'dt', 'dd',
  'sub', 'sup',
  'input',
]);
const ALLOWED_ATTRS = new Set([
  'class', 'id', 'href', 'target', 'rel',
  'type', 'checked', 'disabled',
  'open',
  'colspan', 'rowspan', 'align',
]);

function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

export function isSafeHref(value) {
  const trimmed = String(value || '').trim();
  if (trimmed === '') {
    return false;
  }

  const normalized = trimmed.replace(/[\u0000-\u001f\u007f\s]+/gu, '');
  const schemeMatch = normalized.match(/^([a-z][a-z\d+\-.]*):/iu);
  if (!schemeMatch) {
    return true;
  }

  return ['http', 'https', 'mailto'].includes(schemeMatch[1].toLowerCase());
}

function sanitizeNode(node) {
  let dirty = true;
  while (dirty) {
    dirty = false;
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove();
        dirty = true;
        continue;
      }

      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        child.replaceWith(...child.childNodes);
        dirty = true;
        break;
      }

      for (const attr of [...child.attributes]) {
        const value = attr.value.trimStart().toLowerCase();
        if (!ALLOWED_ATTRS.has(attr.name) || (attr.name === 'href' && !isSafeHref(value))) {
          child.removeAttribute(attr.name);
        }
      }

      sanitizeNode(child);
    }
  }
}

function createSection(title) {
  const section = document.createElement('section');
  section.className = 'digest-section';

  const heading = document.createElement('h2');
  heading.className = 'digest-section-heading';
  heading.textContent = title;
  section.appendChild(heading);

  return section;
}

async function createMarkdownBody(markdown) {
  const body = document.createElement('div');
  body.className = 'digest-md';
  await renderMarkdown(body, markdown);
  return body;
}

async function appendMarkdownSection(parent, title, markdown) {
  if (!markdown) {
    return;
  }
  const section = createSection(title);
  section.appendChild(await createMarkdownBody(markdown));
  parent.appendChild(section);
}

async function appendOverviewSection(parent, markdown, overviewUI) {
  if (!markdown && !overviewUI) {
    return;
  }

  const section = createSection(UI_COPY.overviewHeading);
  if (markdown) {
    section.appendChild(await createMarkdownBody(markdown));
  }
  if (overviewUI?.kind === 'iframe' && overviewUI.srcdoc) {
    section.appendChild(createOverviewUIFrame(overviewUI));
  }
  parent.appendChild(section);
}

function createOverviewUIFrame(overviewUI) {
  const wrapper = document.createElement('div');
  wrapper.className = 'digest-overview-ui';

  const frame = document.createElement('iframe');
  frame.className = 'digest-overview-frame';
  frame.loading = 'lazy';
  frame.referrerPolicy = 'no-referrer';
  frame.sandbox = '';
  frame.srcdoc = String(overviewUI.srcdoc || '');
  frame.style.height = `${Math.max(320, Number(overviewUI.height) || 860)}px`;

  wrapper.appendChild(frame);
  return wrapper;
}

function button(label, onClick) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'digest-button';
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function codeBlock(diff) {
  const wrapper = document.createElement('div');
  wrapper.className = 'digest-code';
  const pre = document.createElement('pre');
  const code = document.createElement('code');
  code.className = 'language-diff';
  code.textContent = diff || '';
  pre.appendChild(code);
  wrapper.appendChild(pre);
  return wrapper;
}

export async function mount({ root, data, submit }) {
  await ensureDigestAssets();

  const highlights = Array.isArray(data.highlights) ? data.highlights : [];
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const shell = document.createElement('div');
  shell.className = 'digest-shell';
  root.replaceChildren(shell);

  const header = document.createElement('header');
  header.className = 'digest-header';
  header.innerHTML = `
    <p class="digest-eyebrow">${escapeHTML(UI_COPY.eyebrow)}</p>
    <h1 class="digest-title">${escapeHTML(data.title || 'PR Digest')}</h1>
    ${data.subtitle ? `<p class="digest-subtitle">${escapeHTML(data.subtitle)}</p>` : ''}
  `;

  if (data.pr_summary_md) {
    const summary = await createMarkdownBody(data.pr_summary_md);
    summary.classList.add('digest-summary');
    header.appendChild(summary);
  }

  shell.appendChild(header);

  const stack = document.createElement('div');
  stack.className = 'digest-stack';
  shell.appendChild(stack);

  await appendOverviewSection(stack, data.overview_md, data.overview_ui);

  for (const sectionData of sections) {
    await appendMarkdownSection(stack, sectionData.title, sectionData.markdown);
  }

  if (highlights.length) {
    const section = createSection(UI_COPY.keyChangesHeading);
    const list = document.createElement('div');
    list.className = 'digest-highlights';

    for (const highlight of highlights) {
      const card = document.createElement('article');
      card.className = 'digest-highlight';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'digest-highlight-title';

      if (highlight.file_label) {
        const label = document.createElement('div');
        label.className = 'digest-code-label';
        label.textContent = highlight.file_label;
        titleWrap.appendChild(label);
      }

      const titleRow = document.createElement('div');
      titleRow.className = 'digest-highlight-title-row';

      const title = document.createElement('h3');
      title.textContent = highlight.title || UI_COPY.fallbackHighlight;
      titleRow.appendChild(title);
      titleWrap.appendChild(titleRow);

      card.appendChild(titleWrap);

      const body = document.createElement('div');
      body.className = 'digest-highlight-body';
      body.appendChild(codeBlock(highlight.diff));

      if (highlight.explanation_md) {
        body.appendChild(await createMarkdownBody(highlight.explanation_md));
      }

      card.appendChild(body);
      list.appendChild(card);
    }

    section.appendChild(list);
    stack.appendChild(section);
  }

  const submitSection = document.createElement('div');
  submitSection.className = 'digest-submit';
  submitSection.appendChild(
    button(data.submit_label || UI_COPY.done, () => {
      submit({ acknowledged: true });
    }),
  );
  shell.appendChild(submitSection);

  await highlightBlocks(shell);
  bindDetailsHighlight(shell);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ensureStylesheet(id, href) {
  const existing = document.getElementById(id);
  if (existing) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(link);
    link.onerror = reject;
    document.head.appendChild(link);
  });
}

function ensureHighlightJS() {
  if (window.hljs) {
    return Promise.resolve(window.hljs);
  }

  const existing = document.getElementById(HIGHLIGHT_SCRIPT_ID);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(window.hljs), { once: true });
      existing.addEventListener('error', reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = HIGHLIGHT_SCRIPT_ID;
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js';
    script.onload = () => resolve(window.hljs);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
