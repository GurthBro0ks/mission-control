import { NextResponse } from 'next/server';
import {
  getNormalizedBlockerDashboardData,
  type BlockerKind,
  type BlockerSeverity,
  type BlockerSource,
} from '@/lib/blockers';

function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function isSeverity(value: string): value is BlockerSeverity {
  return ['critical', 'high', 'medium', 'low', 'unknown'].includes(value);
}

function isKind(value: string): value is BlockerKind {
  return ['feature', 'harness'].includes(value);
}

function isSource(value: string): value is BlockerSource {
  return ['feature_list', 'blocker_report', 'blocker_cache', 'harness_log'].includes(value);
}

const severityRank: Record<BlockerSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  unknown: 4,
};

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const data = getNormalizedBlockerDashboardData();
    const { searchParams } = new URL(request.url);

    const minimumSeverityParam = (searchParams.get('minSeverity') || '').trim().toLowerCase();
    const kindParams = parseListParam(searchParams.get('kind'));
    const sourceParams = parseListParam(searchParams.get('source'));

    const minimumSeverity = isSeverity(minimumSeverityParam) ? minimumSeverityParam : null;
    const kindFilters = kindParams.filter(isKind);
    const sourceFilters = sourceParams.filter(isSource);

    const filteredBlockers = data.blockers.filter((blocker) => {
      if (minimumSeverity && severityRank[blocker.severity] > severityRank[minimumSeverity]) {
        return false;
      }

      if (kindFilters.length > 0 && !kindFilters.includes(blocker.kind)) {
        return false;
      }

      if (sourceFilters.length > 0 && !blocker.sources.some((source) => sourceFilters.includes(source))) {
        return false;
      }

      return true;
    });

    return NextResponse.json({
      generatedAt: data.generatedAt,
      filters: {
        minSeverity: minimumSeverity,
        kind: kindFilters,
        source: sourceFilters,
      },
      sources: data.sources,
      blockers: filteredBlockers,
      summary: data.summary,
      filteredCount: filteredBlockers.length,
      totalCount: data.blockers.length,
    }, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[blockers] GET error:', error);
    return NextResponse.json({ error: 'Failed to load blocker dashboard data' }, { status: 500 });
  }
}
