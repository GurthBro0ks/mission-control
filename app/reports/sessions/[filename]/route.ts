import {
  getSessionReport,
  getFailedApproachesForFeature,
  getExampleSessionReport,
  getHarnessVersionInfo,
} from '@/lib/reports-data';
import { renderSessionDetailPage } from '@/lib/reports-renderer';

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
): Promise<Response> {
  try {
    const { filename } = await params;
    if (!filename || filename.length === 0) {
      return htmlResponse('Missing filename', 400);
    }
    const decoded = decodeURIComponent(filename);
    const [versionInfo, report, example] = await Promise.all([
      getHarnessVersionInfo(),
      getSessionReport(decoded),
      getExampleSessionReport(),
    ]);
    const failedApproaches = await getFailedApproachesForFeature(
      report ? report.feature_id : null,
    );
    return htmlResponse(
      renderSessionDetailPage({
        report,
        failedApproaches,
        example,
        filename: decoded,
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
