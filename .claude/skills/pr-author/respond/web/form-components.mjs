const LOCAL_STYLE_ID = 'pr-author-respond-local-style';
const HIGHLIGHT_STYLE_ID = 'pr-author-respond-highlight-style';
const HIGHLIGHT_SCRIPT_ID = 'pr-author-respond-highlight-script';

let assetsReady;
let markedPromise;
let mermaidPromise;
let heartbeatTimerId = null;

export async function ensureRocFormAssets(assetsBaseURL) {
  if (!assetsReady) {
    assetsReady = (async () => {
      await Promise.all([
        ensureStylesheet(LOCAL_STYLE_ID, `${assetsBaseURL}form-components.css`),
        ensureStylesheet(HIGHLIGHT_STYLE_ID, 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css'),
      ]);
      await ensureHighlightJS();
    })();
  }
  return assetsReady;
}

export function createFormFrame({
  title,
  subtitle = '',
  eyebrow = 'PR Follow-up',
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
}) {
  const container = document.createElement('div');
  container.className = 'container';
  container.id = 'form-container';

  const header = document.createElement('header');
  header.className = 'form-header';
  const eyebrowEl = document.createElement('p');
  eyebrowEl.className = 'form-eyebrow';
  eyebrowEl.textContent = eyebrow;
  const titleEl = document.createElement('h1');
  titleEl.className = 'form-title';
  titleEl.textContent = title || 'PR Review Triage';
  header.append(eyebrowEl, titleEl);
  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'form-subtitle';
    subtitleEl.textContent = subtitle;
    header.appendChild(subtitleEl);
  }
  container.appendChild(header);

  const form = document.createElement('form');
  form.id = 'main-form';
  form.noValidate = true;

  const formBody = document.createElement('div');
  formBody.className = 'form-body';
  form.appendChild(formBody);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const submitButton = document.createElement('button');
  submitButton.type = 'submit';
  submitButton.className = 'btn-submit';
  submitButton.textContent = submitLabel;

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn-cancel';
  cancelButton.textContent = cancelLabel;

  actions.append(submitButton, cancelButton);
  form.appendChild(actions);
  container.appendChild(form);

  return { container, header, form, formBody, submitButton, cancelButton };
}

export async function createMarkdownBody(markdown, className = 'md-body') {
  const body = document.createElement('div');
  body.className = className;
  await renderMarkdownInto(body, markdown);
  return body;
}

export async function createMarkdownField(markdown) {
  const block = document.createElement('div');
  block.className = 'content-block';

  block.appendChild(await createMarkdownBody(markdown));
  return block;
}

export function createTextareaField({
  name,
  label,
  value = '',
  placeholder = '',
  rows = 4,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const labelEl = createLabel(label);
  labelEl.htmlFor = `field-${name}`;
  wrapper.appendChild(labelEl);

  const textarea = document.createElement('textarea');
  textarea.id = `field-${name}`;
  textarea.name = name;
  textarea.value = value;
  textarea.rows = Number(rows || 4);
  if (placeholder) {
    textarea.placeholder = placeholder;
  }
  wrapper.appendChild(textarea);

  return {
    name,
    type: 'ta',
    element: wrapper,
    readValue: () => textarea.value,
  };
}

export function createCheckboxField({
  name,
  label,
  checked = false,
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field checkbox-field';

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = `field-${name}`;
  input.name = name;
  input.checked = Boolean(checked);
  wrapper.appendChild(input);

  const labelEl = document.createElement('label');
  labelEl.htmlFor = input.id;
  labelEl.textContent = label || '';
  wrapper.appendChild(labelEl);

  return {
    name,
    type: 'cb',
    element: wrapper,
    readValue: () => input.checked,
  };
}

export async function createThread({ title, contextMarkdown, fields = [] }) {
  const thread = document.createElement('div');
  thread.className = 'issue-thread';

  const contentBlock = await createMarkdownField(prependThreadTitle(title, contextMarkdown));
  thread.appendChild(contentBlock);

  if (fields.length > 0) {
    const inputs = document.createElement('div');
    inputs.className = 'issue-thread-inputs';
    for (const field of fields) {
      inputs.appendChild(field.element);
    }
    thread.appendChild(inputs);
  }

  return {
    element: thread,
    fields,
  };
}

export async function createSection({
  titleMarkdown,
  hideFieldName,
  hideLabel = 'Hide this review group on PR page',
  hideValue = false,
  threads = [],
}) {
  const section = document.createElement('div');
  section.className = 'review-group';

  const header = document.createElement('div');
  header.className = 'review-group-header';
  const headerBody = document.createElement('div');
  headerBody.className = 'md-body';
  await renderMarkdownInto(headerBody, titleMarkdown || '');
  header.appendChild(headerBody);
  section.appendChild(header);

  const fields = [];
  if (hideFieldName) {
    const options = document.createElement('div');
    options.className = 'review-group-options';
    const checkboxField = createCheckboxField({
      name: hideFieldName,
      label: hideLabel,
      checked: hideValue,
    });
    options.appendChild(checkboxField.element);
    section.appendChild(options);
    fields.push(checkboxField);
  }

  const body = document.createElement('div');
  body.className = 'review-group-body';
  for (const thread of threads) {
    body.appendChild(thread.element);
    fields.push(...thread.fields);
  }
  section.appendChild(body);

  return {
    element: section,
    fields,
  };
}

export function collectFieldValues(fields) {
  const data = {};
  for (const field of fields) {
    data[field.name] = field.readValue();
  }
  return data;
}

export function showResult(container, message) {
  container.innerHTML = `<div class="result-msg">${escapeHTML(message)}</div>`;
  setTimeout(() => window.close(), 1000);
}

export function startHeartbeat() {
  if (heartbeatTimerId !== null) {
    return () => stopHeartbeat();
  }
  heartbeatTimerId = window.setInterval(() => {
    fetch('/heartbeat').catch(() => {});
  }, 5000);
  return () => stopHeartbeat();
}

function createLabel(text) {
  const label = document.createElement('label');
  label.textContent = text || '';
  return label;
}

function prependThreadTitle(title, markdown) {
  const safeTitle = String(title || '').replaceAll('\n', ' ').trim();
  if (!safeTitle) {
    return markdown || '';
  }
  return `### ${safeTitle}\n\n${markdown || ''}`;
}

export function buildThreadContextMarkdown(thread, { renderMd } = {}) {
  const parts = [];

  if (thread.is_outdated) {
    parts.push('⚠️ **OUTDATED**');
  }

  const primary = buildPrimaryContextBlock(thread, { renderMd });
  if (primary) {
    parts.push(primary);
  }

  return parts.join('\n\n');
}

async function renderMarkdownInto(target, markdown) {
  const marked = await getMarked();
  target.innerHTML = sanitizeHTML(marked.parse(markdown || '', { gfm: true, breaks: false }));
  await renderMermaidBlocks(target);
  await highlightBlocks(target);
  bindDetailsHighlight(target);
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
  'input', // for task list checkboxes
]);
const ALLOWED_ATTRS = new Set([
  'class', 'id', 'href', 'target', 'rel',
  'type', 'checked', 'disabled',
  'open', // for details
  'colspan', 'rowspan', 'align',
]);

function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function sanitizeNode(node) {
  // Iterate until stable — replaceWith can introduce new children that need checking
  let dirty = true;
  while (dirty) {
    dirty = false;
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE) { child.remove(); dirty = true; continue; }
      const tag = child.tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        const promoted = [...child.childNodes];
        child.replaceWith(...promoted);
        dirty = true;
        break; // restart loop — DOM changed
      }
      for (const attr of [...child.attributes]) {
        if (!ALLOWED_ATTRS.has(attr.name)) {
          child.removeAttribute(attr.name);
        } else if (attr.name === 'href' &&
                   attr.value.trimStart().toLowerCase().startsWith('javascript:')) {
          child.removeAttribute(attr.name);
        }
      }
      sanitizeNode(child);
    }
  }
}

async function renderMermaidBlocks(container) {
  const blocks = [...container.querySelectorAll('.md-body pre code.language-mermaid, pre code.language-mermaid')];
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await getMermaid();
  mermaid.initialize({ startOnLoad: false, theme: 'neutral' });

  for (const block of blocks) {
    const pre = block.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'mermaid';
    wrapper.textContent = block.textContent || '';
    pre?.replaceWith(wrapper);
  }

  await mermaid.run({ nodes: [...container.querySelectorAll('.mermaid')] });
}

async function highlightBlocks(container) {
  const hljs = await ensureHighlightJS();
  container.querySelectorAll('.md-body pre code, pre code').forEach((el) => {
    if (el.classList.contains('language-mermaid') || el.dataset.hljsDone === 'true') {
      return;
    }
    hljs.highlightElement(el);
    el.dataset.hljsDone = 'true';
  });
}

function bindDetailsHighlight(container) {
  container.querySelectorAll('.md-body details').forEach((details) => {
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

function getMarked() {
  if (!markedPromise) {
    markedPromise = import('https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js').then((mod) => mod.marked);
  }
  return markedPromise;
}

function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then((mod) => mod.default || mod);
  }
  return mermaidPromise;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function decodeHTMLEntities(value) {
  return String(value)
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&#x27;', "'")
    .replaceAll('&#x2F;', '/');
}

function quoteMarkdown(value) {
  return String(value || '')
    .split('\n')
    .map((line) => `> ${escapeHTML(line)}`)
    .join('\n');
}

function sanitizeURL(value) {
  if (!value) {
    return '';
  }
  try {
    const url = new URL(String(value));
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function buildCodeFence(lang, code) {
  const text = String(code || '');
  const runs = text.match(/`+/g) || [];
  const longestRun = runs.reduce((max, run) => Math.max(max, run.length), 0);
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const safeLang = String(lang || '').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${fence}${safeLang}\n${text}\n${fence}`;
}

function buildPrimaryContextBlock(thread, { renderMd } = {}) {
  const blocks = [];
  const metadataHTML = buildMetadataHTML(thread);
  if (metadataHTML) {
    blocks.push(`<div class="thread-context-meta">${metadataHTML}</div>`);
  }

  const primaryComment = thread.translated_comment || thread.original_comment || '';
  if (primaryComment) {
    const commentHTML = renderMd
      ? renderMd(escapeHTML(primaryComment))
      : escapeMultilineHTML(primaryComment);
    blocks.push(
      `<blockquote class="thread-context-comment">${commentHTML}</blockquote>`,
    );
  }

  if (thread.code_context) {
    const title = escapeHTML(thread.code_context_title || 'Code Context');
    const lang = String(thread.code_context_lang || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const code = escapeHTML(decodeHTMLEntities(thread.code_context));
    blocks.push(
      `<div class="thread-code-context">` +
        `<div class="thread-code-context-label">${title}</div>` +
        `<pre><code class="language-${lang}">${code}</code></pre>` +
      `</div>`,
    );
  }

  if (thread.original_comment && thread.show_original) {
    const title = thread.original_comment_title || 'Original';
    const body = renderMd
      ? renderMd(quoteMarkdown(thread.original_comment))
      : quoteMarkdown(thread.original_comment);
    blocks.push(buildDetailsBlockHTML(title, body));
  }

  if (thread.diff_hunk && thread.show_diff_hunk) {
    const lang = thread.diff_hunk_lang || 'diff';
    const title = thread.diff_hunk_title || 'Diff Hunk';
    const fence = buildCodeFence(lang, thread.diff_hunk);
    const body = renderMd ? renderMd(fence) : fence;
    blocks.push(buildDetailsBlockHTML(title, body));
  }

  if (thread.suggestion_md) {
    const title = thread.suggestion_title || 'Suggestion';
    const body = renderMd
      ? renderMd(thread.suggestion_md)
      : thread.suggestion_md;
    blocks.push(buildDetailsBlockHTML(title, body));
  }

  if (blocks.length === 0) {
    return '';
  }

  return `<div class="thread-context-primary">\n${blocks.join('\n')}\n</div>`;
}

function buildDetailsBlockHTML(summary, bodyHTML) {
  return `<details><summary>${escapeHTML(summary)}</summary>${bodyHTML}</details>`;
}

function buildMetadataHTML(thread) {
  const bits = [];
  if (thread.reviewer) {
    bits.push(`<strong>@${escapeHTML(thread.reviewer)}</strong>`);
  }
  if (thread.file_path) {
    const lineSuffix = thread.line ? `:${thread.line}` : '';
    bits.push(`<code>${escapeHTML(`${thread.file_path}${lineSuffix}`)}</code>`);
  } else {
    bits.push(`<span>${escapeHTML('general comment')}</span>`);
  }
  const safeThreadURL = sanitizeURL(thread.thread_url);
  if (safeThreadURL) {
    bits.push(`<a href="${escapeHTML(safeThreadURL)}">thread</a>`);
  }
  return bits.join(' · ');
}

function escapeMultilineHTML(value) {
  return escapeHTML(value).replaceAll('\n', '<br>');
}

function stopHeartbeat() {
  if (heartbeatTimerId !== null) {
    clearInterval(heartbeatTimerId);
    heartbeatTimerId = null;
  }
}
