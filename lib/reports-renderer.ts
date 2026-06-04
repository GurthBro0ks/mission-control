// Pure HTML rendering helpers for the Harness Reports routes.
// All output is mobile-first, inline-CSS, no external assets, no JS.
// The shell-less layout is intentional: these pages are Tailscale-only
// review surfaces, separate from the Mission Control dashboard.

import type {
  FailedApproachEntry,
  FeatureList,
  FeatureListEntry,
  SessionReport,
  SessionReportSummary,
} from './reports-data';

const CSS = `
  :root {
    --bg: #0b1020;
    --panel: #131a2e;
    --panel-2: #1a2240;
    --border: #2a3354;
    --text: #e5e9f5;
    --muted: #8a93b0;
    --accent: #7dd3fc;
    --green: #34d399;
    --red: #f87171;
    --yellow: #fbbf24;
    --gray: #6b7280;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    -webkit-text-size-adjust: 100%;
  }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 22px; line-height: 1.25; margin: 0 0 12px; word-wrap: break-word; }
  h2 { font-size: 18px; line-height: 1.3; margin: 20px 0 8px; color: var(--accent); }
  h3 { font-size: 15px; line-height: 1.3; margin: 12px 0 6px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  p { margin: 6px 0 10px; word-wrap: break-word; }
  a { color: var(--accent); text-decoration: none; }
  a:hover, a:focus { text-decoration: underline; }
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .muted { color: var(--muted); font-size: 13px; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; }
  .row {
    display: block;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 8px;
    color: var(--text);
    text-decoration: none;
    min-height: 44px;
  }
  .row:hover, .row:focus { background: var(--panel-2); text-decoration: none; }
  .row-title { font-weight: 600; font-size: 15px; word-wrap: break-word; }
  .row-meta { color: var(--muted); font-size: 13px; margin-top: 4px; }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 4px;
  }
  .badge.pass { background: var(--green); color: #03221a; }
  .badge.fail { background: var(--red); color: #1f0606; }
  .badge.warn { background: var(--yellow); color: #2a1c00; }
  .badge.gray { background: var(--gray); color: #111; }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
  .stat {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 80px;
    text-align: center;
    flex: 1 1 80px;
  }
  .stat-num { font-size: 22px; font-weight: 700; }
  .stat-lbl { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
  details {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    margin: 8px 0;
  }
  details > summary { cursor: pointer; font-weight: 600; padding: 4px 0; }
  details > pre { overflow-x: auto; padding: 8px 0; margin: 0; }
  pre, code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
  ul { margin: 4px 0 8px; padding-left: 22px; }
  li { margin: 2px 0; word-wrap: break-word; }
  hr { border: 0; border-top: 1px solid var(--border); margin: 16px 0; }
  .nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .nav a {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
  }
  .empty {
    text-align: center;
    padding: 32px 16px;
    color: var(--muted);
  }
  .footer { color: var(--muted); font-size: 12px; text-align: center; margin-top: 20px; padding-bottom: 8px; }
  @media (max-width: 480px) {
    .wrap { padding: 12px; }
    h1 { font-size: 19px; }
    h2 { font-size: 16px; }
    .row-title { font-size: 14px; }
    .stat-num { font-size: 19px; }
  }
`;

function esc(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function pageShell(opts: {
  title: string;
  body: string;
  nav?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#0b1020" />
<meta name="robots" content="noindex,nofollow" />
<title>${esc(opts.title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${opts.nav ?? ''}
${opts.body}
<p class="footer">Harness Reports — internal Tailscale-only surface</p>
</div>
</body>
</html>`;
}

function statusBadgeClass(status: string | null): string {
  if (!status) return 'gray';
  const s = status.toLowerCase();
  if (s === 'completed' || s === 'pass' || s === 'passed' || s === 'success' || s === 'ok') return 'pass';
  if (s === 'failed' || s === 'fail' || s === 'error' || s === 'cancelled') return 'fail';
  if (s === 'blocked' || s === 'partial' || s === 'in_progress' || s === 'pending' || s === 'warn') return 'warn';
  return 'gray';
}

function formatDate(iso: string | null): string {
  if (!iso) return 'unknown';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return esc(iso);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  } catch {
    return esc(iso);
  }
}

function formatDuration(min: number | null): string {
  if (min === null || min === undefined) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const NAV_HTML = `
<div class="nav">
  <a href="/reports">Index</a>
  <a href="/reports/sessions">Sessions</a>
  <a href="/reports/blockers">Blockers</a>
</div>
`;

export function renderIndexPage(opts: { sessionCount: number; blockedCount: number; availableCount: number; totalFeatures: number; }): string {
  const body = `
<h1>🧪 Harness Reports</h1>
<p class="muted">Internal review surface for SlimyAI agent session reports. Mobile-first, no auth (Tailscale-only).</p>
<div class="stats">
  <div class="stat"><div class="stat-num">${opts.sessionCount}</div><div class="stat-lbl">Sessions</div></div>
  <div class="stat"><div class="stat-num">${opts.blockedCount}</div><div class="stat-lbl">Blocked</div></div>
  <div class="stat"><div class="stat-num">${opts.availableCount}</div><div class="stat-lbl">Available</div></div>
  <div class="stat"><div class="stat-num">${opts.totalFeatures}</div><div class="stat-lbl">Total</div></div>
</div>
<div class="panel">
  <a class="row" href="/reports/sessions" style="display:block">
    <div class="row-title">📜 Session Reports</div>
    <div class="row-meta">${opts.sessionCount} report${opts.sessionCount === 1 ? '' : 's'} archived, newest first. Tap any row for the full detail view (header, work done, validation, failed approaches, next actions, raw JSON).</div>
  </a>
  <a class="row" href="/reports/blockers" style="display:block; margin-top: 8px">
    <div class="row-title">🚧 Blocker Dashboard</div>
    <div class="row-meta">Blocked features, available-for-retry, and dispatch queue, derived from feature_list.json.</div>
  </a>
</div>
`;
  return pageShell({ title: 'Harness Reports', body });
}

export function renderSessionListPage(opts: { sessions: SessionReportSummary[]; dir: string | null; }): string {
  let body: string;
  if (opts.sessions.length === 0) {
    body = `
<h1>📜 Session Reports</h1>
<p class="muted">No archived session reports found.</p>
<div class="empty">
  <p>Expected directory: <span class="mono">${esc(opts.dir ?? '(none of the searched locations exist)')}</span></p>
  <p>Searched: <span class="mono">/home/slimy/kb/raw/sessions</span>, <span class="mono">/home/slimy/slimy-kb/raw/sessions</span>, <span class="mono">/home/slimy/kb-game/raw/sessions</span></p>
  <p>Once agents write reports, they will appear here automatically.</p>
</div>
`;
  } else {
    const rows = opts.sessions
      .map((s) => {
        const badge = `<span class="badge ${statusBadgeClass(s.status)}">${esc(s.status ?? 'unknown')}</span>`;
        const feature = s.feature_id ? `<span class="mono">${esc(s.feature_id)}</span>` : '<span class="muted">(no feature_id)</span>';
        const proj = s.project ? esc(s.project) : '—';
        const when = formatDate(s.timestamp);
        const dur = s.duration_minutes ? ` · ${esc(formatDuration(s.duration_minutes))}` : '';
        const summary = s.summary ? `<div class="row-meta">${esc(s.summary)}</div>` : '';
        return `<a class="row" href="/reports/sessions/${encodeURIComponent(s.filename)}">
<div class="row-title">${badge} ${feature}</div>
<div class="row-meta">${proj} · ${when}${dur}</div>
${summary}
</a>`;
      })
      .join('\n');
    body = `
<h1>📜 Session Reports</h1>
<p class="muted">${opts.sessions.length} report${opts.sessions.length === 1 ? '' : 's'}, newest first. Source: <span class="mono">${esc(opts.dir)}</span></p>
${rows}
`;
  }
  return pageShell({ title: 'Session Reports', body, nav: NAV_HTML });
}

export function renderSessionDetailPage(opts: { report: SessionReport | null; failedApproaches: FailedApproachEntry[]; example: SessionReport | null; filename: string; }): string {
  const r = opts.report;
  if (!r) {
    const ex = opts.example;
    const exampleBlock = ex
      ? `
<div class="panel">
  <h3>Example Report Schema</h3>
  <p class="muted">A valid example (loaded from <span class="mono">/home/slimy/slimy-harness/sequencer/session-report.example.json</span>) so you can see the expected fields:</p>
  <div class="panel">
    <div class="row-title">${esc(ex.feature_id ?? 'no feature_id')}</div>
    <div class="row-meta">${esc(ex.project ?? '?')} · ${formatDate(ex.timestamp)} · ${esc(ex.status ?? '?')}</div>
    <p>${esc(ex.summary ?? '')}</p>
  </div>
</div>
`
      : '';
    return pageShell({
      title: 'Session Report Not Found',
      body: `
<h1>📜 Session Not Found</h1>
<p>Could not load <span class="mono">${esc(opts.filename)}</span> from the session archive. The file may have been rotated, renamed, or not yet created.</p>
${exampleBlock}
`,
      nav: NAV_HTML,
    });
  }

  const badge = `<span class="badge ${statusBadgeClass(r.status)}">${esc(r.status ?? 'unknown')}</span>`;
  const changesList =
    r.changes.length > 0
      ? `<ul>${r.changes.map((c) => `<li class="mono">${esc(c)}</li>`).join('')}</ul>`
      : '<p class="muted">No files listed in this report.</p>';
  const blockersList =
    r.blockers.length > 0
      ? `<ul>${r.blockers
          .map(
            (b) =>
              `<li><span class="badge ${b.type === 'manual' ? 'warn' : 'gray'}">${esc(b.type)}</span> ${esc(b.description)}${b.blocks_feature ? ` <span class="muted">(blocks ${esc(b.blocks_feature)})</span>` : ''}</li>`,
          )
          .join('')}</ul>`
      : '<p class="muted">No blockers reported.</p>';
  const testsBadge = r.tests.passed === true ? '<span class="badge pass">tests pass</span>' : r.tests.passed === false ? '<span class="badge fail">tests fail</span>' : '<span class="badge gray">tests unknown</span>';
  const faBlock =
    opts.failedApproaches.length > 0
      ? `
<h3>Failed Approaches</h3>
<p class="muted">${opts.failedApproaches.length} approach${opts.failedApproaches.length === 1 ? '' : 'es'} recorded for <span class="mono">${esc(r.feature_id ?? '(no feature_id)')}</span> in <span class="mono">failed-approaches.json</span>:</p>
<ul>${opts.failedApproaches
          .map(
            (e) =>
              `<li><span class="badge warn">tried</span> ${esc(e.approach ?? '(no approach text)')}<div class="muted">${esc(e.reason ?? '')}${e.tried_at ? ` · ${formatDate(e.tried_at)}` : ''}</div></li>`,
          )
          .join('')}</ul>
`
      : r.feature_id
        ? `<h3>Failed Approaches</h3><p class="muted">No recorded failed approaches for <span class="mono">${esc(r.feature_id)}</span>.</p>`
        : '';
  const kbList =
    r.kb_learnings.length > 0
      ? `<ul>${r.kb_learnings.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>`
      : '<p class="muted">No KB learnings recorded.</p>';
  const recBlock = `
<h3>Next Actions</h3>
<p><strong>Suggested next feature:</strong> ${r.recommendation.next_feature_id ? `<span class="mono">${esc(r.recommendation.next_feature_id)}</span>` : '<span class="muted">none</span>'}</p>
<p>${esc(r.recommendation.reasoning ?? '(no reasoning provided)')}</p>
${r.recommendation.risk_notes ? `<p class="muted"><strong>Risk:</strong> ${esc(r.recommendation.risk_notes)}</p>` : ''}
`;
  const rawJson = JSON.stringify(r.raw, null, 2);

  const body = `
<h1>${badge} ${esc(r.feature_id ?? '(no feature_id)')}</h1>
<p class="muted">${esc(r.project ?? '—')} · ${esc(r.nuc ?? '—')} · agent: <span class="mono">${esc(r.agent ?? '—')}</span> · prompt: <span class="mono">${esc(r.prompt_type ?? '—')}</span></p>
<div class="stats">
  <div class="stat"><div class="stat-num">${esc(formatDate(r.timestamp).split(' ')[0])}</div><div class="stat-lbl">Date</div></div>
  <div class="stat"><div class="stat-num">${esc(formatDuration(r.duration_minutes) || '—')}</div><div class="stat-lbl">Duration</div></div>
  <div class="stat"><div class="stat-num">${r.changes.length}</div><div class="stat-lbl">Files</div></div>
  <div class="stat"><div class="stat-num">${r.kb_learnings.length}</div><div class="stat-lbl">KB Items</div></div>
</div>

<div class="panel">
  <h3>Summary</h3>
  <p>${esc(r.summary ?? '(no summary)')}</p>
  ${testsBadge}
</div>

<h2>Work Done</h2>
<div class="panel">${changesList}</div>

<h2>Validation</h2>
<div class="panel">
  <p>${testsBadge} ${r.tests.ran ? 'tests were run' : 'tests were not run'}</p>
  ${r.tests.details ? `<pre>${esc(r.tests.details)}</pre>` : '<p class="muted">No test details recorded.</p>'}
</div>

<h2>Blockers</h2>
<div class="panel">${blockersList}</div>

${faBlock ? `<h2>Failed Approaches</h2><div class="panel">${faBlock}</div>` : ''}

<h2>Next Actions</h2>
<div class="panel">${recBlock}</div>

<h2>KB Learnings</h2>
<div class="panel">${kbList}</div>

<details>
<summary>Raw JSON (debug)</summary>
<pre>${esc(rawJson)}</pre>
</details>
`;
  return pageShell({ title: `${r.feature_id ?? r.filename} — Session Report`, body, nav: NAV_HTML });
}

export function renderBlockersPage(opts: {
  blocked: FeatureListEntry[];
  retry: FeatureListEntry[];
  available: FeatureListEntry[];
  stats: { total: number; completed: number; blocked: number; available: number };
  blockerReport: string | null;
}): string {
  const renderRow = (f: FeatureListEntry, prefix: string) => {
    const blockedBy = Array.isArray(f.blocked_by) ? f.blocked_by.join(', ') : f.blocked_by ?? '';
    const last = f.last_attempted ? ` · last: ${esc(formatDate(f.last_attempted))}` : '';
    const attempts = typeof f.attempt_count === 'number' ? ` · ${f.attempt_count} attempt${f.attempt_count === 1 ? '' : 's'}` : '';
    return `<a class="row" href="/reports/sessions" data-id="${esc(f.id)}">
<div class="row-title">${prefix} <span class="mono">${esc(f.id)}</span></div>
<div class="row-meta">${esc(f.project)} · ${esc(f.priority)}${attempts}${last}</div>
${f.description ? `<div class="row-meta">${esc(f.description)}</div>` : ''}
${blockedBy ? `<div class="row-meta muted">blocked by: ${esc(blockedBy)}</div>` : ''}
</a>`;
  };
  const section = (title: string, items: FeatureListEntry[], prefix: string) => {
    if (items.length === 0) return `<h2>${esc(title)}</h2><p class="muted">None.</p>`;
    return `<h2>${esc(title)} (${items.length})</h2>${items.map((f) => renderRow(f, prefix)).join('\n')}`;
  };
  const body = `
<h1>🚧 Blocker Dashboard</h1>
<p class="muted">Source of truth: <span class="mono">feature_list.json</span> (with optional <span class="mono">blocker-report.md</span> shown below).</p>
<div class="stats">
  <div class="stat"><div class="stat-num">${opts.stats.blocked}</div><div class="stat-lbl">Blocked</div></div>
  <div class="stat"><div class="stat-num">${opts.stats.available}</div><div class="stat-lbl">Available</div></div>
  <div class="stat"><div class="stat-num">${opts.stats.completed}</div><div class="stat-lbl">Completed</div></div>
  <div class="stat"><div class="stat-num">${opts.stats.total}</div><div class="stat-lbl">Total</div></div>
</div>
${section('Blocked features', opts.blocked, '<span class="badge fail">blocked</span>')}
${section('Failed and available for retry', opts.retry, '<span class="badge warn">retry</span>')}
${section('Available for dispatch', opts.available, '<span class="badge pass">ready</span>')}
${
  opts.blockerReport
    ? `<details><summary>blocker-report.md (raw)</summary><pre>${esc(opts.blockerReport)}</pre></details>`
    : ''
}
`;
  return pageShell({ title: 'Blocker Dashboard', body, nav: NAV_HTML });
}

export function computeBlockerBuckets(fl: FeatureList | null): {
  blocked: FeatureListEntry[];
  retry: FeatureListEntry[];
  available: FeatureListEntry[];
  stats: { total: number; completed: number; blocked: number; available: number };
} {
  if (!fl || !Array.isArray(fl.features)) {
    return {
      blocked: [],
      retry: [],
      available: [],
      stats: { total: 0, completed: 0, blocked: 0, available: 0 },
    };
  }
  const features = fl.features;
  const blocked: FeatureListEntry[] = [];
  const retry: FeatureListEntry[] = [];
  const available: FeatureListEntry[] = [];
  let completed = 0;
  for (const f of features) {
    if (f.passes) {
      completed += 1;
      continue;
    }
    const status = (f.status ?? '').toLowerCase();
    const attempts = typeof f.attempt_count === 'number' ? f.attempt_count : 0;
    if (status === 'blocked' || (Array.isArray(f.blocked_by) ? f.blocked_by.length > 0 : Boolean(f.blocked_by))) {
      blocked.push(f);
    } else if (attempts > 0) {
      retry.push(f);
    } else {
      available.push(f);
    }
  }
  blocked.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  retry.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  available.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
  return {
    blocked,
    retry,
    available,
    stats: {
      total: features.length,
      completed,
      blocked: blocked.length,
      available: available.length + retry.length,
    },
  };
}

function priorityOrder(p: string): number {
  const v = (p ?? '').toLowerCase();
  if (v === 'critical') return 0;
  if (v === 'high') return 1;
  if (v === 'medium') return 2;
  if (v === 'low') return 3;
  return 9;
}
