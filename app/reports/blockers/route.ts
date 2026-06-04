import {
  getFeatureList,
  getBlockerReport,
  getHarnessVersionInfo,
} from '@/lib/reports-data';
import { computeBlockerBuckets, renderBlockersPage } from '@/lib/reports-renderer';

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
    const [versionInfo, fl, blockerReport] = await Promise.all([
      getHarnessVersionInfo(),
      getFeatureList(),
      getBlockerReport(),
    ]);
    const buckets = computeBlockerBuckets(fl);
    return htmlResponse(
      renderBlockersPage({
        blocked: buckets.blocked,
        retry: buckets.retry,
        available: buckets.available,
        stats: buckets.stats,
        blockerReport,
        versionInfo,
      }),
    );
  } catch (err) {
    return htmlResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reports Error</title></head><body><h1>Reports error</h1><pre>${String(err)}</pre></body></html>`,
      500,
    );
  }
}
