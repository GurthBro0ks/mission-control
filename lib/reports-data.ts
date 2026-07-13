import { promises as fs } from 'fs';
import * as path from 'path';

// Locations of the source-of-truth artefacts the report renderer reads.
// All read-only; nothing in here writes anywhere.

const SESSIONS_DIRS = [
  '/home/slimy/kb/raw/sessions',
  '/home/slimy/slimy-kb/raw/sessions',
  '/home/slimy/kb-game/raw/sessions',
];

const FAILED_APPROACHES_PATHS = [
  '/home/slimy/failed-approaches.json',
  '/home/slimy/slimy-harness/failed-approaches.json',
];

const FEATURE_LIST_PATHS = [
  '/home/slimy/feature_list.json',
];

const BLOCKER_REPORT_PATHS = [
  '/home/slimy/blocker-report.md',
  '/home/slimy/slimy-harness/blocker-report.md',
];

const HARNESS_VERSION_JSON_PATHS = [
  '/home/slimy/slimy-harness/version.json',
];

const HARNESS_VERSION_FILE_PATHS = [
  '/home/slimy/slimy-harness/VERSION',
];

const SESSION_REPORT_EXAMPLE =
  '/home/slimy/slimy-harness/sequencer/session-report.example.json';

const SESSION_REPORT_SCHEMA =
  '/home/slimy/slimy-harness/sequencer/session-report.schema.json';

export interface SessionReportSummary {
  filename: string;
  filepath: string;
  session_id: string | null;
  agent: string | null;
  nuc: string | null;
  project: string | null;
  feature_id: string | null;
  prompt_type: string | null;
  status: string | null;
  summary: string | null;
  timestamp: string | null;
  duration_minutes: number | null;
  attempt_count: number;
  parse_error?: string;
}

export interface SessionReport extends SessionReportSummary {
  raw: Record<string, unknown>;
  changes: string[];
  tests: {
    ran: boolean | null;
    passed: boolean | null;
    label: string | null;
    details: string | null;
    checks: Array<{
      id: string;
      name: string;
      status: string;
      display: string;
      passed: number | null;
      failed: number | null;
      total: number | null;
      source_artifact: string;
    }>;
  };
  artifacts: {
    proof_files_total: number;
    displayed_count: number;
    displayed_files: string[];
    filter_explanation: string | null;
  } | null;
  next_action: string | null;
  run_id: string | null;
  subject_id: string | null;
  pushed: boolean | null;
  production_storage_state: string | null;
  underlying_functional_qa: string | null;
  manual_qa_status: string | null;
  operator_qa: string | null;
  blockers: Array<{
    type: string;
    description: string;
    blocks_feature: string | null;
  }>;
  recommendation: {
    next_feature_id: string | null;
    reasoning: string | null;
    risk_notes: string | null;
  };
  kb_learnings: string[];
}

export interface FeatureListEntry {
  id: string;
  project: string;
  description: string;
  priority: string;
  passes: boolean;
  status?: string;
  risk?: string;
  attempt_count?: number;
  blocked_by?: string | string[];
  last_attempted?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface FeatureList {
  features: FeatureListEntry[];
  [key: string]: unknown;
}

export interface FailedApproachEntry {
  feature_id?: string;
  approach?: string;
  reason?: string;
  tried_at?: string;
  [key: string]: unknown;
}

export interface FailedApproaches {
  version?: number;
  entries: FailedApproachEntry[];
}

export interface HarnessVersionInfo {
  name: string;
  version: string;
  status: string | null;
  date: string | null;
  public_report_url: string | null;
  source_path: string;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function getSessionsDir(): Promise<string | null> {
  for (const d of SESSIONS_DIRS) {
    if (await pathExists(d)) return d;
  }
  return null;
}

export async function listSessionReports(): Promise<SessionReportSummary[]> {
  const dir = await getSessionsDir();
  if (!dir) return [];
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: SessionReportSummary[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const filepath = path.join(dir, name);
    try {
      const text = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(text);
      const summary: SessionReportSummary = {
        filename: name,
        filepath,
        session_id: data.session_id ?? null,
        agent: data.agent ?? null,
        nuc: data.nuc ?? null,
        project: data.project ?? null,
        feature_id: data.feature_id ?? null,
        prompt_type: data.prompt_type ?? null,
        status: data.status ?? null,
        summary: data.summary ?? null,
        timestamp: data.timestamp ?? null,
        duration_minutes: typeof data.duration_minutes === 'number' ? data.duration_minutes : null,
        attempt_count: typeof data.attempt_count === 'number' ? data.attempt_count : 0,
      };
      out.push(summary);
    } catch (err) {
      out.push({
        filename: name,
        filepath,
        session_id: null,
        agent: null,
        nuc: null,
        project: null,
        feature_id: null,
        prompt_type: null,
        status: null,
        summary: null,
        timestamp: null,
        duration_minutes: null,
        attempt_count: 0,
        parse_error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  out.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    return tb - ta;
  });
  return out;
}

export async function getSessionReport(filename: string): Promise<SessionReport | null> {
  if (filename.includes('/') || filename.includes('..')) return null;
  const dir = await getSessionsDir();
  const candidates: string[] = [];
  if (dir) candidates.push(path.join(dir, filename));
  candidates.push(path.join('/home/slimy/slimy-harness/sequencer', filename));
  for (const filepath of candidates) {
    if (!(await pathExists(filepath))) continue;
    const text = await fs.readFile(filepath, 'utf8');
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }
    const d = data as Record<string, unknown>;
    return {
      filename,
      filepath,
      session_id: typeof d.session_id === 'string' ? d.session_id : null,
      agent: typeof d.agent === 'string' ? d.agent : null,
      nuc: typeof d.nuc === 'string' ? d.nuc : null,
      project: typeof d.project === 'string' ? d.project : null,
      feature_id: typeof d.feature_id === 'string' ? d.feature_id : null,
      prompt_type: typeof d.prompt_type === 'string' ? d.prompt_type : null,
      status: typeof d.status === 'string' ? d.status : null,
      summary: typeof d.summary === 'string' ? d.summary : null,
      timestamp: typeof d.timestamp === 'string' ? d.timestamp : null,
      duration_minutes: typeof d.duration_minutes === 'number' ? d.duration_minutes : null,
      attempt_count: typeof d.attempt_count === 'number' ? d.attempt_count : 0,
      raw: d,
      changes: Array.isArray(d.changes) ? d.changes.filter((x) => typeof x === 'string') : [],
      tests: {
        ran: typeof d.tests === 'object' && d.tests !== null && 'ran' in d.tests ? Boolean((d.tests as { ran: unknown }).ran) : null,
        passed: typeof d.tests === 'object' && d.tests !== null && 'passed' in d.tests ? Boolean((d.tests as { passed: unknown }).passed) : null,
        label: typeof d.tests === 'object' && d.tests !== null && 'label' in d.tests && typeof (d.tests as { label: unknown }).label === 'string'
          ? (d.tests as { label: string }).label
          : null,
        details: typeof d.tests === 'object' && d.tests !== null && 'details' in d.tests && typeof (d.tests as { details: unknown }).details === 'string'
          ? (d.tests as { details: string }).details
          : null,
        checks: typeof d.tests === 'object' && d.tests !== null && 'checks' in d.tests && Array.isArray((d.tests as { checks: unknown }).checks)
          ? (d.tests as { checks: unknown[] }).checks.map((check) => {
              const item = check as Record<string, unknown>;
              return {
                id: typeof item.id === 'string' ? item.id : 'unknown',
                name: typeof item.name === 'string' ? item.name : 'Validation check',
                status: typeof item.status === 'string' ? item.status : 'UNKNOWN',
                display: typeof item.display === 'string' ? item.display : '',
                passed: typeof item.passed === 'number' ? item.passed : null,
                failed: typeof item.failed === 'number' ? item.failed : null,
                total: typeof item.total === 'number' ? item.total : null,
                source_artifact: typeof item.source_artifact === 'string' ? item.source_artifact : '',
              };
            })
          : [],
      },
      artifacts: typeof d.artifacts === 'object' && d.artifacts !== null
        ? {
            proof_files_total: typeof (d.artifacts as Record<string, unknown>).proof_files_total === 'number'
              ? (d.artifacts as { proof_files_total: number }).proof_files_total
              : 0,
            displayed_count: typeof (d.artifacts as Record<string, unknown>).displayed_count === 'number'
              ? (d.artifacts as { displayed_count: number }).displayed_count
              : 0,
            displayed_files: Array.isArray((d.artifacts as Record<string, unknown>).displayed_files)
              ? ((d.artifacts as { displayed_files: unknown[] }).displayed_files).filter((item): item is string => typeof item === 'string')
              : [],
            filter_explanation: typeof (d.artifacts as Record<string, unknown>).filter_explanation === 'string'
              ? (d.artifacts as { filter_explanation: string }).filter_explanation
              : null,
          }
        : null,
      next_action: typeof d.next_action === 'string' ? d.next_action : null,
      run_id: typeof d.run_id === 'string' ? d.run_id : null,
      subject_id: typeof d.subject_id === 'string' ? d.subject_id : null,
      pushed: typeof d.pushed === 'boolean' ? d.pushed : null,
      production_storage_state: typeof d.production_storage_state === 'string' ? d.production_storage_state : null,
      underlying_functional_qa: typeof d.underlying_functional_qa === 'string' ? d.underlying_functional_qa : null,
      manual_qa_status: typeof d.manual_qa_status === 'string' ? d.manual_qa_status : null,
      operator_qa: typeof d.operator_qa === 'string' ? d.operator_qa : null,
      blockers: Array.isArray(d.blockers)
        ? d.blockers.map((b) => {
            const o = b as { type?: string; description?: string; blocks_feature?: string | null };
            return {
              type: typeof o.type === 'string' ? o.type : 'unknown',
              description: typeof o.description === 'string' ? o.description : '',
              blocks_feature: typeof o.blocks_feature === 'string' ? o.blocks_feature : null,
            };
          })
        : [],
      recommendation: {
        next_feature_id:
          typeof d.recommendation === 'object' && d.recommendation !== null && 'next_feature_id' in d.recommendation
            ? (d.recommendation as { next_feature_id: string | null }).next_feature_id ?? null
            : null,
        reasoning:
          typeof d.recommendation === 'object' && d.recommendation !== null && 'reasoning' in d.recommendation
            ? (d.recommendation as { reasoning: string }).reasoning ?? null
            : null,
        risk_notes:
          typeof d.recommendation === 'object' && d.recommendation !== null && 'risk_notes' in d.recommendation
            ? (d.recommendation as { risk_notes: string }).risk_notes ?? null
            : null,
      },
      kb_learnings: Array.isArray(d.kb_learnings) ? d.kb_learnings.filter((x) => typeof x === 'string') : [],
    };
  }
  return null;
}

export async function getFailedApproaches(): Promise<FailedApproaches> {
  for (const p of FAILED_APPROACHES_PATHS) {
    if (!(await pathExists(p))) continue;
    try {
      const text = await fs.readFile(p, 'utf8');
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown }).entries)) {
        return parsed as FailedApproaches;
      }
    } catch {
      // ignore
    }
  }
  return { version: 1, entries: [] };
}

export async function getFailedApproachesForFeature(featureId: string | null): Promise<FailedApproachEntry[]> {
  if (!featureId) return [];
  const all = await getFailedApproaches();
  return all.entries.filter((e) => e.feature_id === featureId);
}

export async function getFeatureList(): Promise<FeatureList | null> {
  for (const p of FEATURE_LIST_PATHS) {
    if (!(await pathExists(p))) continue;
    try {
      const text = await fs.readFile(p, 'utf8');
      const data = JSON.parse(text);
      if (data && typeof data === 'object' && Array.isArray((data as { features?: unknown }).features)) {
        return data as FeatureList;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function getBlockerReport(): Promise<string | null> {
  for (const p of BLOCKER_REPORT_PATHS) {
    if (await pathExists(p)) {
      try {
        return await fs.readFile(p, 'utf8');
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function getHarnessVersionInfo(): Promise<HarnessVersionInfo | null> {
  for (const p of HARNESS_VERSION_JSON_PATHS) {
    if (!(await pathExists(p))) continue;
    try {
      const text = await fs.readFile(p, 'utf8');
      const data = JSON.parse(text) as Record<string, unknown>;
      const version = typeof data.version === 'string' ? data.version : null;
      if (!version) continue;
      return {
        name: typeof data.name === 'string' ? data.name : 'slimy-harness',
        version,
        status: typeof data.status === 'string' ? data.status : null,
        date: typeof data.date === 'string' ? data.date : null,
        public_report_url: typeof data.public_report_url === 'string' ? data.public_report_url : null,
        source_path: p,
      };
    } catch {
      // ignore
    }
  }

  for (const p of HARNESS_VERSION_FILE_PATHS) {
    if (!(await pathExists(p))) continue;
    try {
      const version = (await fs.readFile(p, 'utf8')).trim();
      if (!version) continue;
      return {
        name: 'slimy-harness',
        version,
        status: null,
        date: null,
        public_report_url: null,
        source_path: p,
      };
    } catch {
      // ignore
    }
  }

  return null;
}

export async function getExampleSessionReport(): Promise<SessionReport | null> {
  if (!(await pathExists(SESSION_REPORT_EXAMPLE))) return null;
  return getSessionReport('session-report.example.json');
}

export function getSessionReportSchemaPath(): string {
  return SESSION_REPORT_SCHEMA;
}
