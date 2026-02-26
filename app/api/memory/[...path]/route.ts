import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const BASE_DIRS = [
  '/home/slimy/ned-clawd/memory',
  '/home/slimy/ned-clawd/logs',
  '/home/slimy/ned-clawd',
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathParts } = await params;
    const relativePath = pathParts.join('/');
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get('raw') === 'true';

    // Bug 6 fix: Resolve path and validate against allowlist
    // Start from base memory directory and resolve
    let requestedPath = relativePath;

    // Fix: If BASE_DIR includes 'memory/', strip leading 'memory/' from request path
    // This fixes double 'memory' path issue (e.g., /memory/memory/file.md)
    if (requestedPath.startsWith('memory/')) {
      requestedPath = requestedPath.slice(7); // Remove 'memory/' prefix
    }

    console.log('Resolving:', relativePath, '→', requestedPath);

    const resolvedPath = path.resolve('/home/slimy/ned-clawd/memory', requestedPath);

    // SECURITY: Verify resolved path starts with an allowed directory
    const isAllowed = BASE_DIRS.some(dir => resolvedPath.startsWith(dir));

    if (!isAllowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const content = fs.readFileSync(resolvedPath, 'utf8');
    const stats = fs.statSync(resolvedPath);

    // If raw mode, return plain text
    if (raw) {
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `inline; filename="${path.basename(resolvedPath)}"`,
        },
      });
    }

    return NextResponse.json({
      content,
      filename: path.basename(resolvedPath),
      path: resolvedPath,
      lines: content.split('\n').length,
      modified: stats.mtime.toISOString(),
      size: stats.size,
    });
  } catch (error) {
    console.error('Memory file error:', error);
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
  }
}
