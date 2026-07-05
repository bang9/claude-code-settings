#!/usr/bin/env node
// check-skill.mjs — rule-checkable preflight for agent skill packages.
//
// USAGE:
//   node check-skill.mjs <target> [<target>...]
//
//   Each <target> is a concrete skill: a SKILL.md path, or a directory that directly
//   contains a SKILL.md. Finding skills across a repo or layout is the caller's job
//   (skill step 1); this script only checks the targets it is handed.
//
// WHAT IT CHECKS (rule-checkable only — no judgment, no behavior):
//   - SKILL.md exists and has a parseable YAML frontmatter block
//     (including block-scalar values: `description: |` / `>-` and friends)
//   - name is kebab-case and equals its directory name (when a dir exists)
//   - description present, non-empty, and carries a trigger phrase. A leading
//     "use when"/"when ..." passes; a bare mid-sentence "when" is a MINOR
//     advisory (trigger *quality* is a judgment check, not a rule check);
//     no "when" at all is a BLOCKER.
//   - spec hard limits on field length (name <=64, description <=1024, compatibility <=500)
//   - frontmatter keys are well-known (an unlisted key is a MINOR heads-up, not a blocker)
//   - every references/<...>, scripts/<...>, steps/<...> path mentioned in the body exists
//   - body line count under a soft budget (warning only)
//   - obvious secrets / placeholder text scan
//   - over-broad allowed-tools scan
//
// OUTPUT: a per-file report grouped by severity.
// EXIT CODE: non-zero (1) if ANY BLOCKER-level issue is found; 0 otherwise.
//   (MAJOR/MINOR/INFO do not fail the run — they are advisory for the agent.)

import { readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve, isAbsolute } from 'node:path';

// ---- config ---------------------------------------------------------------

// Well-known frontmatter keys. Runtimes add keys over time, and we can't know new ones
// before they ship — so a key outside this set is a MINOR heads-up (new field? typo?),
// never a hard BLOCKER.
const WELL_KNOWN_KEYS = new Set([
  'name',
  'description',
  'argument-hint',
  'allowed-tools',
  'disallowed-tools',
  'disable-model-invocation',
  'when_to_use',
  'paths',
  'model',
  'license',
  'compatibility',
  'metadata',
]);

// Spec hard limits (https://agentskills.io/specification): a conformant validator
// rejects a skill that exceeds these, so an over-limit name/description is a packaging
// failure (BLOCKER). compatibility is an optional, rarely-used field — over-limit is a
// MAJOR heads-up, not a load-breaker.
const NAME_MAX = 64;
const DESC_MAX = 1024;
const COMPAT_MAX = 500;

// Strong leading trigger: "use when" or a sentence-initial "when ...".
const STRONG_TRIGGER_RE = /^\s*(use\s+when\b|when\b)/i;
// Weak signal: a bare " when " somewhere inside the description. Real trigger
// quality is a judgment check; a bare mid-sentence "when" only earns a MINOR
// advisory, never a silent PASS that lulls a reviewer.
const WEAK_TRIGGER_RE = /\bwhen\b/i;
const BODY_SOFT_LINE_BUDGET = 200;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// YAML block-scalar markers: |, >, with optional chomp/indent indicators
// (|-, >-, |+, >2, etc.). Matched on a key's inline value.
const BLOCK_SCALAR_RE = /^[|>][+-]?\d*$/;

// placeholder / leftover-stub markers
const PLACEHOLDER_RE = /\b(TODO|TBD|FIXME|XXX|REPLACE_ME|PLACEHOLDER|LOREM IPSUM)\b/;
// token-shaped secrets
const SECRET_PATTERNS = [
  { re: /\bsk-[A-Za-z0-9]{16,}\b/, label: 'OpenAI-style secret key (sk-...)' },
  { re: /\bghp_[A-Za-z0-9]{20,}\b/, label: 'GitHub personal token (ghp_...)' },
  { re: /\bgho_[A-Za-z0-9]{20,}\b/, label: 'GitHub OAuth token (gho_...)' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id (AKIA...)' },
  { re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, label: 'Slack token (xox...)' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, label: 'PEM private key' },
];
// long base64/hex blobs that look like embedded credentials/data dumps
const LONG_HEX_RE = /\b[0-9a-fA-F]{40,}\b/;
const LONG_B64_RE = /\b[A-Za-z0-9+/]{60,}={0,2}\b/;

// destructive / over-broad tool grants
const BROAD_TOOL_RE =
  /\b(rm\s+-rf|sudo\b|Bash\(\*\)|Bash\s*$|:\s*\*\s*$|--force\b|git\s+push\s+--force|curl\b.*\|\s*sh)\b/i;

// references/ and scripts/ path mentions inside the body
const PATH_MENTION_RE = /(?:^|[\s(<`"'\[])((?:references|scripts|steps)\/[A-Za-z0-9._\-\/]+)/g;

// ---- tiny frontmatter parser (no deps) ------------------------------------

// Returns { ok, frontmatter:{...}, body, rawKeys:[], error }.
// Supports: scalar values, single-line "[a, b]" inline arrays, block
// list items ("- x") under a key, and block-scalar values (`|`, `>`, with
// chomp/indent indicators) whose indented continuation lines are folded/joined
// into the value. Nested maps (e.g. metadata:) are captured loosely as present
// keys; their leaf values are not deeply validated.
function parseFrontmatter(text) {
  if (!text.startsWith('---')) {
    return { ok: false, error: 'no opening --- frontmatter fence' };
  }
  const lines = text.split(/\r?\n/);
  // first line is the opening fence
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { ok: false, error: 'unterminated frontmatter (no closing ---)' };
  }
  const fmLines = lines.slice(1, end);
  const body = lines.slice(end + 1).join('\n');

  const frontmatter = {};
  const rawKeys = [];
  let currentKey = null;

  for (let i = 0; i < fmLines.length; i++) {
    const rawLine = fmLines[i];
    if (rawLine.trim() === '' || rawLine.trim().startsWith('#')) continue;

    const indented = /^\s+/.test(rawLine);
    const listMatch = rawLine.match(/^\s*-\s+(.*)$/);

    if (listMatch && currentKey) {
      // block list item belonging to currentKey
      if (!Array.isArray(frontmatter[currentKey])) frontmatter[currentKey] = [];
      frontmatter[currentKey].push(stripQuotes(listMatch[1].trim()));
      continue;
    }

    const kv = rawLine.match(/^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) continue;

    const isTopLevel = kv[1].length === 0;
    const key = kv[2];
    const value = kv[3];

    if (!isTopLevel) {
      // nested key (e.g. under metadata) — record nothing top-level
      if (indented && currentKey) {
        if (typeof frontmatter[currentKey] !== 'object' || frontmatter[currentKey] === null) {
          frontmatter[currentKey] = {};
        }
        if (!Array.isArray(frontmatter[currentKey])) {
          frontmatter[currentKey][key] = stripQuotes(value);
        }
      }
      continue;
    }

    rawKeys.push(key);
    currentKey = key;

    const trimmedValue = value.trim();

    if (BLOCK_SCALAR_RE.test(trimmedValue)) {
      // Block scalar (`|`, `>`, `|-`, `>-`, ...). Collect the following
      // more-indented continuation lines as the value. A leading-`>` folds
      // newlines into spaces; `|` keeps line breaks. For our checks the
      // joined text is what matters, so fold either way.
      const folded = trimmedValue[0] === '>';
      const block = collectBlockScalar(fmLines, i + 1);
      i = block.nextIndex - 1; // -1 because the for-loop will i++
      frontmatter[key] = folded ? block.lines.join(' ').trim() : block.lines.join('\n').trim();
    } else if (value === '') {
      // Empty inline value: a block list/map may follow on indented lines, or
      // the key is genuinely empty. Look ahead: capture indented continuation
      // lines that are not list items as a folded scalar (defensive — handles
      // an unmarked multi-line scalar); leave '' when nothing follows so the
      // empty-value gates still fire on a truly empty key.
      const block = collectBlockScalar(fmLines, i + 1);
      if (block.lines.length > 0) {
        i = block.nextIndex - 1;
        frontmatter[key] = block.lines.join(' ').trim();
      } else {
        frontmatter[key] = '';
      }
    } else if (value.startsWith('[') && value.endsWith(']')) {
      frontmatter[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => stripQuotes(s.trim()))
        .filter((s) => s.length > 0);
    } else {
      frontmatter[key] = stripQuotes(value);
    }
  }

  return { ok: true, frontmatter, body, rawKeys };
}

// Collect a block-scalar value: consecutive indented, non-list continuation
// lines starting at `start`. Returns { lines:[trimmed text], nextIndex }.
// Stops at: a top-level (non-indented) line, a list item ("- x"), or EOF.
// Blank lines inside the block are preserved as empty entries so literal
// formatting survives; trailing blanks are trimmed by the caller's join+trim.
function collectBlockScalar(fmLines, start) {
  const lines = [];
  let i = start;
  for (; i < fmLines.length; i++) {
    const line = fmLines[i];
    if (line.trim() === '') {
      // blank line: part of the block only if more indented content follows
      lines.push('');
      continue;
    }
    if (!/^\s+/.test(line)) break; // next top-level key ends the block
    if (/^\s*-\s+/.test(line)) break; // a block list item, not a scalar
    lines.push(line.trim());
  }
  // drop trailing blank entries that were speculatively pushed
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  // if every collected line was blank, treat as no block content
  return { lines, nextIndex: lines.length > 0 ? i : start };
}

function stripQuotes(s) {
  if (s.length >= 2) {
    const a = s[0];
    const b = s[s.length - 1];
    if ((a === '"' && b === '"') || (a === "'" && b === "'")) return s.slice(1, -1);
  }
  return s;
}

// ---- discovery ------------------------------------------------------------

// Resolve one explicit target (a SKILL.md path, or a dir that directly contains SKILL.md)
// to its SKILL.md. Discovering skills across a repo/layout is the caller's job (step 1);
// this script only checks the concrete targets it is handed.
function resolveTarget(target) {
  const abs = isAbsolute(target) ? target : resolve(process.cwd(), target);
  if (!existsSync(abs)) fail(`target does not exist: ${abs}`);
  const st = statSync(abs);
  if (st.isFile()) {
    if (basename(abs) !== 'SKILL.md') fail(`target file is not a SKILL.md: ${abs}`);
    return abs;
  }
  const direct = join(abs, 'SKILL.md');
  if (existsSync(direct)) return direct;
  fail(`not a skill: no SKILL.md in ${abs} (pass a SKILL.md path or its directory)`);
}

// ---- per-skill checks -----------------------------------------------------

// Each finding: { severity: 'BLOCKER'|'MAJOR'|'MINOR'|'INFO', msg }
function checkSkill(skillMdPath) {
  const findings = [];
  const dir = dirname(skillMdPath);
  const dirName = basename(dir);

  let text;
  try {
    text = readFileSync(skillMdPath, 'utf8');
  } catch (err) {
    return { path: skillMdPath, findings: [{ severity: 'BLOCKER', msg: `cannot read file: ${err.message}` }] };
  }

  const parsed = parseFrontmatter(text);
  if (!parsed.ok) {
    findings.push({ severity: 'BLOCKER', msg: `unparseable frontmatter: ${parsed.error}` });
    return { path: skillMdPath, findings };
  }

  const { frontmatter: fm, body, rawKeys } = parsed;

  // --- name ---
  const name = fm.name;
  if (name === undefined || name === '') {
    findings.push({ severity: 'MAJOR', msg: 'frontmatter has no `name` (required by most runtimes)' });
  } else {
    if (!KEBAB.test(name)) {
      findings.push({ severity: 'BLOCKER', msg: `name "${name}" is not kebab-case` });
    }
    if (name.length > NAME_MAX) {
      findings.push({ severity: 'BLOCKER', msg: `name is ${name.length} chars (> spec max ${NAME_MAX})` });
    }
    if (name !== dirName) {
      findings.push({ severity: 'BLOCKER', msg: `name "${name}" != directory name "${dirName}"` });
    }
  }

  // --- description ---
  // Note on layering: the rule gate only proves a trigger phrase is *present*.
  // Trigger *quality* (does it fire on the right situations, stay specific,
  // avoid over-eager matches) is a judgment check scored in steps/4-judgment-review.md.
  // A strong leading "use when"/"when ..." passes silently; a bare mid-sentence
  // "when" passes only with a MINOR advisory so a clean run never lulls a
  // reviewer into trusting the rule layer for trigger quality.
  const desc = fm.description;
  if (desc === undefined || String(desc).trim() === '') {
    findings.push({ severity: 'BLOCKER', msg: '`description` is missing or empty' });
  } else {
    const value = String(desc).trim();
    if (value.length > DESC_MAX) {
      findings.push({ severity: 'BLOCKER', msg: `description is ${value.length} chars (> spec max ${DESC_MAX})` });
    }
    if (STRONG_TRIGGER_RE.test(value)) {
      // strong leading trigger — pass
    } else if (WEAK_TRIGGER_RE.test(value)) {
      findings.push({
        severity: 'MINOR',
        msg: '`description` trigger phrase is weak (bare "when", not a leading "use when ..."); confirm trigger quality in judgment review',
      });
    } else {
      findings.push({
        severity: 'BLOCKER',
        msg: '`description` has no trigger phrase (expected a leading "use when" / "when ...")',
      });
    }
  }

  // --- non-well-known keys → advisory, not a blocker ---
  for (const k of rawKeys) {
    if (!WELL_KNOWN_KEYS.has(k)) {
      findings.push({
        severity: 'MINOR',
        msg: `frontmatter key "${k}" is not well-known — confirm it is intended (a new runtime field, not a typo)`,
      });
    }
  }

  // --- compatibility length (optional field; spec hard limit) ---
  if (fm.compatibility !== undefined) {
    const compat = String(fm.compatibility).trim();
    if (compat.length > COMPAT_MAX) {
      findings.push({ severity: 'MAJOR', msg: `compatibility is ${compat.length} chars (> spec max ${COMPAT_MAX})` });
    }
  }

  // --- allowed-tools breadth ---
  if (fm['allowed-tools'] !== undefined) {
    const at = fm['allowed-tools'];
    const atStr = Array.isArray(at) ? at.join(', ') : String(at);
    if (atStr.trim() === '*' || /(^|[,\s])\*([,\s]|$)/.test(atStr)) {
      findings.push({ severity: 'MAJOR', msg: 'allowed-tools grants a wildcard (*) — narrow it' });
    }
    if (BROAD_TOOL_RE.test(atStr)) {
      findings.push({ severity: 'MAJOR', msg: `allowed-tools grants broad/destructive command: "${atStr}"` });
    }
  }

  // --- referenced paths exist ---
  const mentioned = new Set();
  let m;
  PATH_MENTION_RE.lastIndex = 0;
  while ((m = PATH_MENTION_RE.exec(body)) !== null) {
    // strip trailing punctuation/markdown that may cling to the path
    let p = m[1].replace(/[)\]>`"'.,;:]+$/, '');
    mentioned.add(p);
  }
  for (const rel of mentioned) {
    const full = join(dir, rel);
    if (!existsSync(full)) {
      findings.push({ severity: 'BLOCKER', msg: `referenced path does not exist: ${rel}` });
    }
  }

  // --- body size (soft) ---
  const bodyLines = body.split(/\r?\n/).length;
  if (bodyLines > BODY_SOFT_LINE_BUDGET) {
    findings.push({
      severity: 'MINOR',
      msg: `body is ${bodyLines} lines (> soft budget ${BODY_SOFT_LINE_BUDGET}); consider routing detail to references/`,
    });
  }

  // --- secrets & placeholders (scan whole file) ---
  const fileLines = text.split(/\r?\n/);
  fileLines.forEach((line, idx) => {
    const ln = idx + 1;
    for (const { re, label } of SECRET_PATTERNS) {
      if (re.test(line)) findings.push({ severity: 'BLOCKER', msg: `possible secret (${label}) at line ${ln}` });
    }
    if (LONG_HEX_RE.test(line)) {
      findings.push({ severity: 'MAJOR', msg: `long hex blob at line ${ln} (possible embedded token/data)` });
    }
    if (LONG_B64_RE.test(line) && !line.trim().startsWith('//')) {
      findings.push({ severity: 'MAJOR', msg: `long base64-like blob at line ${ln} (possible embedded credential/data)` });
    }
    if (PLACEHOLDER_RE.test(line)) {
      findings.push({ severity: 'MAJOR', msg: `placeholder/stub marker at line ${ln}: ${PLACEHOLDER_RE.exec(line)[0]}` });
    }
  });

  return { path: skillMdPath, findings };
}

// ---- reporting ------------------------------------------------------------

const ORDER = { BLOCKER: 0, MAJOR: 1, MINOR: 2, INFO: 3 };

function fail(msg) {
  process.stderr.write(`check-skill: ${msg}\n`);
  process.exit(2);
}

function main() {
  const targets = process.argv.slice(2);
  process.stdout.write('check-skill — rule-checkable preflight\n');

  if (targets.length === 0) {
    process.stderr.write('usage: node check-skill.mjs <skill-dir-or-SKILL.md> [more...]\n');
    process.exit(2);
  }

  const skillMds = targets.map(resolveTarget);
  process.stdout.write(`targets: ${skillMds.length}\n`);

  let blockerCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  for (const sm of skillMds) {
    const { path, findings } = checkSkill(sm);
    findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

    process.stdout.write(`\n${path}\n`);
    if (findings.length === 0) {
      process.stdout.write('  OK — no rule-level issues\n');
      continue;
    }
    for (const f of findings) {
      if (f.severity === 'BLOCKER') blockerCount++;
      else if (f.severity === 'MAJOR') majorCount++;
      else if (f.severity === 'MINOR') minorCount++;
      process.stdout.write(`  [${f.severity}] ${f.msg}\n`);
    }
  }

  process.stdout.write(
    `\nsummary: ${skillMds.length} skill(s) — ${blockerCount} BLOCKER, ${majorCount} MAJOR, ${minorCount} MINOR\n`,
  );

  if (blockerCount > 0) {
    process.stdout.write('result: NOT SHIPPABLE (BLOCKERs present — carry into the report alongside judgment findings)\n');
    process.exit(1);
  }
  process.stdout.write('result: PASS rule checks (proceed to judgment review)\n');
  process.exit(0);
}

main();
