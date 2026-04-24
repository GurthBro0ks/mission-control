import fs from 'fs';
import path from 'path';

const FEATURE_LIST_PATH = '/home/slimy/feature_list.json';
const BLOCKER_REPORT_PATH = '/home/slimy/blocker-report.md';
const BLOCKER_CACHE_PATH = '/home/slimy/.last-blocker-report.md';
const HARNESS_LOG_DIR = '/home/slimy/harness-logs';

export type BlockerPriority = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type BlockerSeverity = 'critical' | 'high' | 'medium' | 'low' | 'unknown';
export type BlockerStatus = 'blocked' | 'open' | 'resolved' | 'unknown';
export type BlockerKind = 'feature' | 'harness';
export type BlockerSource = 'feature_list' | 'blocker_report' | 'blocker_cache' | 'harness_log';
export type BlockerAgeBucket = 'fresh' | 'stale' | 'critical' | 'unknown';

interface RawFeature {
  id?: string;
  project?: string;
  description?: string;
  priority?: string;
  risk?: string;
  notes?: string;
  status?: string;
  passes?: boolean;
  blocked_by?: string[];
  last_attempted?: string | null;
}

interface FeatureListPayload {
  features?: RawFeature[];
}

interface BlockerRecordSeed {
  id: string;
  featureId: string | null;
  kind: BlockerKind;
  title: string;
  project: string | null;
  priority: BlockerPriority;
  severity: BlockerSeverity;
  status: BlockerStatus;
  blockedBy: string[];
  risk: string;
  owner: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  notes: string | null;
  sources: Set<BlockerSource>;
  evidence: string[];
}

export interface NormalizedBlockerRecord {
  id: string;
  featureId: string | null;
  kind: BlockerKind;
  title: string;
  project: string | null;
  priority: BlockerPriority;
  severity: BlockerSeverity;
  status: BlockerStatus;
  blockedBy: string[];
  risk: string;
  owner: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  ageHours: number | null;
  ageBucket: BlockerAgeBucket;
  notes: string | null;
  sources: BlockerSource[];
  evidence: string[];
}

export interface BlockerSourceState {
  path: string;
  exists: boolean;
  updatedAt: string | null;
}

export interface BlockerSummary {
  total: number;
  byKind: Record<BlockerKind, number>;
  byStatus: Record<BlockerStatus, number>;
  bySeverity: Record<BlockerSeverity, number>;
  bySource: Record<BlockerSource, number>;
  staleCount: number;
  criticalAgeCount: number;
}

export interface BlockerDashboardData {
  generatedAt: string;
  sources: {
    featureList: BlockerSourceState;
    blockerReport: BlockerSourceState;
    blockerCache: BlockerSourceState;
    harnessLog: BlockerSourceState;
  };
  blockers: NormalizedBlockerRecord[];
  summary: BlockerSummary;
}

interface ParsedReport {
  timestamp: string | null;
  rows: Array<{
    featureId: string;
    project: string | null;
    blockedBy: string[];
    priority: BlockerPriority;
  }>;
}

interface HarnessError {
  message: string;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  count: number;
}

const PRIORITY_RANK: Record<BlockerPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

const SEVERITY_RANK: Record<BlockerSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

function readUtf8(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function getSourceState(filePath: string): BlockerSourceState {
  try {
    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      exists: true,
      updatedAt: stats.mtime.toISOString(),
    };
  } catch {
    return {
      path: filePath,
      exists: false,
      updatedAt: null,
    };
  }
}

function normalizePriority(value: string | undefined): BlockerPriority {
  if (!value) return 'unknown';
  const lowered = value.trim().toLowerCase();
  if (lowered === 'critical' || lowered === 'high' || lowered === 'medium' || lowered === 'low') {
    return lowered;
  }
  return 'unknown';
}

function normalizeStatus(value: string | undefined): BlockerStatus {
  if (!value) return 'unknown';
  const lowered = value.trim().toLowerCase();
  if (lowered === 'blocked') return 'blocked';
  if (lowered === 'open') return 'open';
  if (lowered === 'resolved' || lowered === 'completed') return 'resolved';
  return 'unknown';
}

function normalizeSeverity(priority: BlockerPriority, blockedBy: string[]): BlockerSeverity {
  if (blockedBy.some((entry) => entry.includes('human-action-required'))) {
    return 'critical';
  }
  if (blockedBy.some((entry) => entry.startsWith('manual:'))) {
    return priority === 'unknown' ? 'high' : priority;
  }
  return priority;
}

function getAgeHoursFromIso(isoTimestamp: string | null, nowMs: number): number | null {
  if (!isoTimestamp) return null;
  const timestampMs = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestampMs)) return null;
  const diffMs = Math.max(0, nowMs - timestampMs);
  return Number((diffMs / (1000 * 60 * 60)).toFixed(1));
}

function getAgeBucket(ageHours: number | null): BlockerAgeBucket {
  if (ageHours === null) return 'unknown';
  if (ageHours >= 72) return 'critical';
  if (ageHours >= 24) return 'stale';
  return 'fresh';
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (value && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

function earliestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) <= Date.parse(b) ? a : b;
}

function latestIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function splitBlockedBy(cell: string): string[] {
  return cell
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseReportTimestamp(markdown: string): string | null {
  const headerMatch = markdown.match(/^#\s+Blocker Report\s+—\s+(.+)$/m);
  if (!headerMatch) return null;

  const raw = headerMatch[1].trim();
  const utcMatch = raw.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+UTC$/);
  if (utcMatch) {
    return `${utcMatch[1]}T${utcMatch[2]}:00Z`;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function extractMarkdownSection(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const startIndex = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (startIndex === -1) return [];

  const section: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## ')) break;
    section.push(line);
  }
  return section;
}

function parseMarkdownTable(sectionLines: string[]): string[][] {
  const tableLines = sectionLines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));

  if (tableLines.length < 3) return [];

  const rows = tableLines
    .slice(2)
    .map((line) => line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, idx, arr) => !(idx === 0 && cell === '') && !(idx === arr.length - 1 && cell === ''))
    )
    .filter((cells) => cells.length > 0);

  return rows;
}

function parseBlockerReport(filePath: string): ParsedReport {
  const markdown = readUtf8(filePath);
  if (!markdown) {
    return { timestamp: null, rows: [] };
  }

  const sectionLines = extractMarkdownSection(markdown, 'Tasks Needing Human Action (8)');
  const dynamicSectionLines = sectionLines.length > 0
    ? sectionLines
    : (() => {
        const lines = markdown.split('\n');
        const dynamicStart = lines.findIndex((line) => /^##\s+Tasks Needing Human Action\s+\(\d+\)$/.test(line.trim()));
        if (dynamicStart === -1) return [];
        const result: string[] = [];
        for (let index = dynamicStart + 1; index < lines.length; index += 1) {
          const line = lines[index];
          if (line.startsWith('## ')) break;
          result.push(line);
        }
        return result;
      })();

  const tableRows = parseMarkdownTable(dynamicSectionLines);
  const rows = tableRows
    .map((cells) => {
      const [featureIdRaw, projectRaw, blockedByRaw, priorityRaw] = cells;
      const featureId = (featureIdRaw || '').trim();
      if (!featureId) return null;
      return {
        featureId,
        project: firstNonEmpty(projectRaw ?? null),
        blockedBy: splitBlockedBy(blockedByRaw || ''),
        priority: normalizePriority(priorityRaw),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return {
    timestamp: parseReportTimestamp(markdown),
    rows,
  };
}

function getLatestLoopLogPath(): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(HARNESS_LOG_DIR);
  } catch {
    return null;
  }

  const loopLogs = files
    .filter((name) => /^loop-\d{8}\.log$/.test(name))
    .sort();

  if (loopLogs.length === 0) return null;
  return path.join(HARNESS_LOG_DIR, loopLogs[loopLogs.length - 1]);
}

function parseHarnessErrors(logContent: string): HarnessError[] {
  const errorMap = new Map<string, HarnessError>();
  let activeTimestamp: string | null = null;

  for (const rawLine of logContent.split('\n')) {
    const line = rawLine.trimEnd();
    const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/);
    if (timestampMatch) {
      const parsed = Date.parse(timestampMatch[1]);
      activeTimestamp = Number.isFinite(parsed) ? new Date(parsed).toISOString() : activeTimestamp;
    }

    const scriptErrorMatch = line.match(/notify-blockers\.sh:\s+line\s+\d+:\s+(.+?)\s*$/);
    const autoSequenceErrorMatch = line.match(/\[auto-sequence\]\s+ERROR:\s+(.+?)\s*$/);
    const message = scriptErrorMatch?.[1] || autoSequenceErrorMatch?.[1];
    if (!message) continue;

    const current = errorMap.get(message);
    if (!current) {
      errorMap.set(message, {
        message,
        firstSeenAt: activeTimestamp,
        lastSeenAt: activeTimestamp,
        count: 1,
      });
      continue;
    }

    current.count += 1;
    current.firstSeenAt = earliestIso(current.firstSeenAt, activeTimestamp);
    current.lastSeenAt = latestIso(current.lastSeenAt, activeTimestamp);
  }

  return Array.from(errorMap.values());
}

function toHarnessBlockerId(message: string): string {
  const slug = message
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return `harness:${slug || 'log-error'}`;
}

function mergeSource(seed: BlockerRecordSeed, source: BlockerSource): void {
  seed.sources.add(source);
}

function mergeBlockedBy(seed: BlockerRecordSeed, blockedBy: string[]): void {
  const merged = new Set([...seed.blockedBy, ...blockedBy]);
  seed.blockedBy = Array.from(merged).sort();
}

function parseFeatureList(): RawFeature[] {
  const raw = readUtf8(FEATURE_LIST_PATH);
  if (!raw) return [];

  try {
    const payload = JSON.parse(raw) as FeatureListPayload;
    return payload.features ?? [];
  } catch {
    return [];
  }
}

function seedFromFeature(feature: RawFeature): BlockerRecordSeed | null {
  const featureId = feature.id?.trim();
  if (!featureId) return null;

  const blockedBy = Array.isArray(feature.blocked_by)
    ? feature.blocked_by.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  const status = normalizeStatus(feature.status);
  if (feature.passes === true || status === 'resolved') return null;

  const isBlocked = blockedBy.length > 0 || status === 'blocked';
  if (!isBlocked) return null;

  const priority = normalizePriority(feature.priority);
  const severity = normalizeSeverity(priority, blockedBy);
  const lastSeenAt = firstNonEmpty(feature.last_attempted ?? null);

  return {
    id: `feature:${featureId}`,
    featureId,
    kind: 'feature',
    title: firstNonEmpty(feature.description ?? null) ?? featureId,
    project: firstNonEmpty(feature.project ?? null),
    priority,
    severity,
    status: 'blocked',
    blockedBy: blockedBy.length > 0 ? blockedBy : ['status:blocked'],
    risk: firstNonEmpty(feature.risk ?? null) ?? 'unknown',
    owner: null,
    firstSeenAt: lastSeenAt,
    lastSeenAt,
    notes: firstNonEmpty(feature.notes ?? null),
    sources: new Set<BlockerSource>(['feature_list']),
    evidence: ['feature_list.json blocked entry'],
  };
}

function mergeReportRows(
  blockers: Map<string, BlockerRecordSeed>,
  report: ParsedReport,
  source: BlockerSource
): void {
  for (const row of report.rows) {
    const blockerId = `feature:${row.featureId}`;
    const existing = blockers.get(blockerId);

    if (!existing) {
      const severity = normalizeSeverity(row.priority, row.blockedBy);
      blockers.set(blockerId, {
        id: blockerId,
        featureId: row.featureId,
        kind: 'feature',
        title: row.featureId,
        project: row.project,
        priority: row.priority,
        severity,
        status: 'blocked',
        blockedBy: row.blockedBy,
        risk: 'unknown',
        owner: null,
        firstSeenAt: report.timestamp,
        lastSeenAt: report.timestamp,
        notes: null,
        sources: new Set<BlockerSource>([source]),
        evidence: [`${source} markdown table row`],
      });
      continue;
    }

    mergeSource(existing, source);
    mergeBlockedBy(existing, row.blockedBy);
    existing.project = firstNonEmpty(existing.project, row.project);
    existing.priority = PRIORITY_RANK[row.priority] < PRIORITY_RANK[existing.priority] ? row.priority : existing.priority;
    existing.severity = SEVERITY_RANK[normalizeSeverity(row.priority, row.blockedBy)] < SEVERITY_RANK[existing.severity]
      ? normalizeSeverity(row.priority, row.blockedBy)
      : existing.severity;
    existing.firstSeenAt = source === 'blocker_cache'
      ? earliestIso(existing.firstSeenAt, report.timestamp)
      : existing.firstSeenAt;
    existing.lastSeenAt = source === 'blocker_report'
      ? latestIso(existing.lastSeenAt, report.timestamp)
      : existing.lastSeenAt;
    existing.evidence.push(`${source} confirms blocker`);
  }
}

function mergeHarnessErrors(blockers: Map<string, BlockerRecordSeed>, errors: HarnessError[], logPath: string): void {
  for (const issue of errors) {
    const blockerId = toHarnessBlockerId(issue.message);
    const existing = blockers.get(blockerId);

    if (!existing) {
      blockers.set(blockerId, {
        id: blockerId,
        featureId: null,
        kind: 'harness',
        title: issue.message,
        project: 'slimy-harness/sequencer',
        priority: 'high',
        severity: 'high',
        status: 'blocked',
        blockedBy: [issue.message],
        risk: 'high',
        owner: null,
        firstSeenAt: issue.firstSeenAt,
        lastSeenAt: issue.lastSeenAt,
        notes: null,
        sources: new Set<BlockerSource>(['harness_log']),
        evidence: [`${path.basename(logPath)} (${issue.count} occurrences)`],
      });
      continue;
    }

    mergeSource(existing, 'harness_log');
    mergeBlockedBy(existing, [issue.message]);
    existing.firstSeenAt = earliestIso(existing.firstSeenAt, issue.firstSeenAt);
    existing.lastSeenAt = latestIso(existing.lastSeenAt, issue.lastSeenAt);
    existing.evidence.push(`${path.basename(logPath)} (${issue.count} occurrences)`);
  }
}

function buildSummary(blockers: NormalizedBlockerRecord[]): BlockerSummary {
  const summary: BlockerSummary = {
    total: blockers.length,
    byKind: {
      feature: 0,
      harness: 0,
    },
    byStatus: {
      blocked: 0,
      open: 0,
      resolved: 0,
      unknown: 0,
    },
    bySeverity: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      unknown: 0,
    },
    bySource: {
      feature_list: 0,
      blocker_report: 0,
      blocker_cache: 0,
      harness_log: 0,
    },
    staleCount: 0,
    criticalAgeCount: 0,
  };

  for (const blocker of blockers) {
    summary.byKind[blocker.kind] += 1;
    summary.byStatus[blocker.status] += 1;
    summary.bySeverity[blocker.severity] += 1;

    for (const source of blocker.sources) {
      summary.bySource[source] += 1;
    }

    if (blocker.ageBucket === 'stale') summary.staleCount += 1;
    if (blocker.ageBucket === 'critical') summary.criticalAgeCount += 1;
  }

  return summary;
}

export function getNormalizedBlockerDashboardData(): BlockerDashboardData {
  const nowIso = new Date().toISOString();
  const nowMs = Date.parse(nowIso);

  const blockerSeeds = new Map<string, BlockerRecordSeed>();

  for (const feature of parseFeatureList()) {
    const seed = seedFromFeature(feature);
    if (!seed) continue;
    blockerSeeds.set(seed.id, seed);
  }

  const blockerReport = parseBlockerReport(BLOCKER_REPORT_PATH);
  mergeReportRows(blockerSeeds, blockerReport, 'blocker_report');

  const blockerCache = parseBlockerReport(BLOCKER_CACHE_PATH);
  mergeReportRows(blockerSeeds, blockerCache, 'blocker_cache');

  const latestLoopLogPath = getLatestLoopLogPath();
  if (latestLoopLogPath) {
    const harnessLog = readUtf8(latestLoopLogPath);
    if (harnessLog) {
      const errors = parseHarnessErrors(harnessLog);
      mergeHarnessErrors(blockerSeeds, errors, latestLoopLogPath);
    }
  }

  const blockers = Array.from(blockerSeeds.values())
    .map((seed): NormalizedBlockerRecord => {
      const primarySeenAt = firstNonEmpty(seed.firstSeenAt, seed.lastSeenAt);
      const ageHours = getAgeHoursFromIso(primarySeenAt, nowMs);
      return {
        id: seed.id,
        featureId: seed.featureId,
        kind: seed.kind,
        title: seed.title,
        project: seed.project,
        priority: seed.priority,
        severity: seed.severity,
        status: seed.status,
        blockedBy: seed.blockedBy,
        risk: seed.risk,
        owner: seed.owner,
        firstSeenAt: seed.firstSeenAt,
        lastSeenAt: seed.lastSeenAt,
        ageHours,
        ageBucket: getAgeBucket(ageHours),
        notes: seed.notes,
        sources: Array.from(seed.sources).sort(),
        evidence: Array.from(new Set(seed.evidence)),
      };
    })
    .sort((left, right) => {
      const severityDiff = SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity];
      if (severityDiff !== 0) return severityDiff;

      const priorityDiff = PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const leftAge = left.ageHours ?? -1;
      const rightAge = right.ageHours ?? -1;
      if (leftAge !== rightAge) return rightAge - leftAge;

      return left.id.localeCompare(right.id);
    });

  return {
    generatedAt: nowIso,
    sources: {
      featureList: getSourceState(FEATURE_LIST_PATH),
      blockerReport: getSourceState(BLOCKER_REPORT_PATH),
      blockerCache: getSourceState(BLOCKER_CACHE_PATH),
      harnessLog: latestLoopLogPath ? getSourceState(latestLoopLogPath) : {
        path: path.join(HARNESS_LOG_DIR, 'loop-*.log'),
        exists: false,
        updatedAt: null,
      },
    },
    blockers,
    summary: buildSummary(blockers),
  };
}
