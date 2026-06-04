import {
  listSessionReports,
  getFeatureList,
} from '@/lib/reports-data';
import { computeBlockerBuckets, renderIndexPage } from '@/lib/reports-renderer';

export const dynamic = 'force-dynamic';

function htmlResponse(body: string, status: number = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(): Promise<Response> {
  try {
    const [sessions, fl] = await Promise.all([
      listSessionReports(),
      getFeatureList(),
    ]);
    const buckets = computeBlockerBuckets(fl);
    return htmlResponse(
      renderIndexPage({
        sessionCount: sessions.length,
        blockedCount: buckets.stats.blocked,
        availableCount: buckets.stats.available,
        totalFeatures: buckets.stats.total,
      }),
    );
  } catch (err) {
    return htmlResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reports Error</title></head><body><h1>Reports error</h1><pre>${String(err)}</pre></body></html>`,
      500,
    );
  }
}
