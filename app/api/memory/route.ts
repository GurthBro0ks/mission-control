import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MEMORY_DIRS = [
  '/home/slimy/ned-clawd/memory',
  '/home/slimy/ned-clawd/logs',
  '/home/slimy/ned-clawd/ops',
  '/home/slimy/ned-clawd/triggers',
];

interface MemoryFile {
  name: string;
  fullPath: string;
  lineCount: number;
  sizeKB: number;
  lastModified: string;
  category: 'core' | 'daily' | 'project' | 'incident' | 'trading' | 'config';
}

function getCategory(filename: string, fullPath: string): MemoryFile['category'] {
  const lower = filename.toLowerCase();

  // Core check
  if (filename === 'MEMORY.md' || lower.includes('core')) return 'core';

  // Daily check - date pattern in filename
  if (/\d{4}-\d{2}-\d{2}/.test(filename)) return 'daily';

  // Incident check
  if (lower.includes('incident') || lower.includes('recovery') || lower.includes('error') || lower.includes('alert')) return 'incident';

  // Trading check
  if (lower.includes('trade') || lower.includes('arb') || lower.includes('kalshi') || lower.includes('trading')) return 'trading';

  // Config check
  if (lower.includes('config') || lower.includes('setup') || lower.includes('.conf') || lower.includes('.ini')) return 'config';

  return 'project';
}

function getLineCount(filePath: string): number {
  try {
    const result = execSync(`wc -l < "${filePath}"`, { encoding: 'utf8' });
    return parseInt(result.trim()) || 0;
  } catch {
    return 0;
  }
}

function scanDirectory(dir: string, extensions: string[]): MemoryFile[] {
  const files: MemoryFile[] = [];

  if (!fs.existsSync(dir)) return files;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filename = entry.name;
      const ext = path.extname(filename).toLowerCase();

      // Only include specific extensions
      if (!extensions.includes(ext) && ext !== '') continue;

      const fullPath = path.join(dir, filename);

      try {
        const stats = fs.statSync(fullPath);

        files.push({
          name: filename,
          fullPath,
          lineCount: getLineCount(fullPath),
          sizeKB: Math.round(stats.size / 1024 * 100) / 100,
          lastModified: stats.mtime.toISOString(),
          category: getCategory(filename, fullPath),
        });
      } catch (e) {
        // Skip files we can't stat
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }

  return files;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const tree = searchParams.get('tree');

    // Return tree structure if requested
    if (tree === 'true') {
      interface TreeNode {
        name: string;
        type: 'folder' | 'file';
        path?: string;
        children?: TreeNode[];
        extension?: string;
      }

      function buildTree(dir: string, basePath: string): TreeNode[] {
        const nodes: TreeNode[] = [];

        if (!fs.existsSync(dir)) return nodes;

        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.join(basePath, entry.name);

            if (entry.isDirectory()) {
              const children = buildTree(fullPath, relativePath);
              if (children.length > 0 || ['memory', 'logs', 'ops', 'triggers'].includes(entry.name)) {
                nodes.push({
                  name: entry.name,
                  type: 'folder',
                  path: relativePath,
                  children,
                });
              }
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (['.md', '.txt', '.log', '.sh', '.json'].includes(ext)) {
                nodes.push({
                  name: entry.name,
                  type: 'file',
                  path: relativePath,
                  extension: ext,
                });
              }
            }
          }
        } catch (e) {
          // Skip inaccessible directories
        }

        // Sort: folders first, then files, alphabetically
        nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        return nodes;
      }

      const treeResult: TreeNode[] = [];

      for (const dir of MEMORY_DIRS) {
        const dirName = path.basename(dir);
        const children = buildTree(dir, dirName);
        if (children.length > 0) {
          treeResult.push({
            name: dirName,
            type: 'folder',
            path: dirName,
            children,
          });
        }
      }

      return NextResponse.json({ tree: treeResult });
    }

    const allFiles: MemoryFile[] = [];

    // Scan all memory directories
    for (const dir of MEMORY_DIRS) {
      const dirFiles = scanDirectory(dir, ['.md', '.txt', '.log', '.sh']);
      allFiles.push(...dirFiles);
    }

    // Sort by last modified (newest first)
    allFiles.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

    // If search query provided, search content
    if (search) {
      const results: Array<{
        filename: string;
        path: string;
        matchCount: number;
        snippets: string[];
      }> = [];

      const searchLower = search.toLowerCase();
      const searchLength = search.length;

      for (const file of allFiles) {
        try {
          const content = fs.readFileSync(file.fullPath, 'utf8');
          const lines = content.split('\n');

          const matches: string[] = [];
          let matchCount = 0;

          lines.forEach((line) => {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes(searchLower)) {
              matchCount++;

              // Get context (50 chars before/after)
              const matchIdx = lowerLine.indexOf(searchLower);
              const start = Math.max(0, matchIdx - 50);
              const end = Math.min(line.length, matchIdx + searchLength + 50);
              let snippet = line.slice(start, end);

              // Highlight search terms with ** markers
              const before = start > 0 ? '...' : '';
              const after = end < line.length ? '...' : '';
              const matchPart = line.slice(Math.max(0, matchIdx), Math.min(line.length, matchIdx + searchLength));
              snippet = before + line.slice(start, Math.max(0, matchIdx)) + '**' + matchPart + '**' + line.slice(matchIdx + searchLength, end) + after;

              matches.push(snippet);
            }
          });

          if (matchCount > 0) {
            results.push({
              filename: file.name,
              path: file.fullPath,
              matchCount,
              snippets: matches.slice(0, 3),
            });
          }
        } catch (e) {
          // Skip files we can't read
        }
      }

      return NextResponse.json({ files: allFiles, searchResults: results, search });
    }

    // Return file list
    const totalLines = allFiles.reduce((sum, f) => sum + f.lineCount, 0);
    const totalSizeKB = allFiles.reduce((sum, f) => sum + f.sizeKB, 0);

    return NextResponse.json({
      files: allFiles,
      totalFiles: allFiles.length,
      totalLines,
      totalSizeKB,
    });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json({ error: 'Failed to read memory' }, { status: 500 });
  }
}
