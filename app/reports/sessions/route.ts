import { getHarnessVersionInfo, listSessionReports, getSessionsDir } from '@/lib/reports-data';
import { requireOwnerReportAccess } from '@/lib/owner-auth';
import { renderSessionListPage } from '@/lib/reports-renderer';

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

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await requireOwnerReportAccess(request);
    if ('response' in auth) return auth.response;

    const [versionInfo, sessions, dir] = await Promise.all([getHarnessVersionInfo(), listSessionReports(), getSessionsDir()]);
    return htmlResponse(renderSessionListPage({ sessions, dir, versionInfo }));
  } catch (err) {
    return htmlResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reports Error</title></head><body><h1>Reports error</h1><pre>${String(err)}</pre></body></html>`,
      500,
    );
  }
}

export async function HEAD(request: Request): Promise<Response> {
  return GET(request);
}
