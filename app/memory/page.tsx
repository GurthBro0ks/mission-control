"use client";

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TreeNode {
  name: string;
  type: 'folder' | 'file';
  path?: string;
  children?: TreeNode[];
  extension?: string;
}

interface MemoryFile {
  name: string;
  fullPath: string;
  lineCount: number;
  sizeKB: number;
  lastModified: string;
  category: 'core' | 'daily' | 'project' | 'incident' | 'trading' | 'config';
}

interface SearchResult {
  filename: string;
  path: string;
  matchCount: number;
  snippets: string[];
}

const CATEGORY_COLORS: Record<string, string> = {
  core: '#22d3ee',
  daily: '#a78bfa',
  project: '#4ade80',
  incident: '#f87171',
  trading: '#fbbf24',
  config: '#94a3b8',
};

const FILE_ICONS: Record<string, string> = {
  '.md': '📝',
  '.txt': '📄',
  '.log': '📋',
  '.sh': '⚡',
  '.json': '📋',
  default: '📄',
};

function getFileIcon(ext: string): string {
  return FILE_ICONS[ext] || FILE_ICONS.default;
}

// Time ago helper
function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minute${Math.floor(seconds / 60) > 1 ? 's' : ''} ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
  return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
}

// Get status color based on age
function getStatusColor(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (minutes < 5) return '#22c55e'; // green
  if (minutes < 15) return '#fbbf24'; // amber
  return '#ef4444'; // red
}

// Detect heartbeat file
function isHeartbeatFile(content: string): { isHeartbeat: boolean; type: string; timestamp: string } | null {
  const trimmed = content.trim();
  // Check if it's a single line ISO timestamp
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (trimmed.includes('\n')) return null;

  if (!isoPattern.test(trimmed)) return null;

  // Determine type from path or content hints
  let type = 'System';
  const lower = trimmed.toLowerCase();
  if (lower.includes('trade') || lower.includes('kalshi')) type = 'Trading';
  else if (lower.includes('alert') || lower.includes('incident')) type = 'Alert';
  else if (lower.includes('sync') || lower.includes('ops')) type = 'Ops';

  return { isHeartbeat: true, type, timestamp: trimmed };
}

export default function MemoryPage() {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['memory', 'logs', 'ops', 'triggers']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isRaw, setIsRaw] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [stats, setStats] = useState({ totalFiles: 0, totalLines: 0, totalSizeKB: 0 });

  // Load tree structure
  useEffect(() => {
    fetch('/api/memory?tree=true')
      .then(res => res.json())
      .then(data => {
        setTree(data.tree || []);
      })
      .catch(err => console.error('Error loading tree:', err));
  }, []);

  // Load stats
  useEffect(() => {
    fetch('/api/memory')
      .then(res => res.json())
      .then(data => {
        setStats({
          totalFiles: data.totalFiles || 0,
          totalLines: data.totalLines || 0,
          totalSizeKB: data.totalSizeKB || 0,
        });
      })
      .catch(err => console.error('Error loading stats:', err));
  }, []);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      fetch(`/api/memory?search=${encodeURIComponent(search)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data.searchResults || []);
        })
        .catch(err => console.error('Search error:', err));
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Load file content
  const loadFile = async (path: string, rawMode?: boolean) => {
    try {
      const useRaw = rawMode ?? isRaw;
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const res = await fetch(`/api/memory/${encodedPath}?raw=${useRaw}`);
      if (!res.ok) throw new Error('File not found');
      if (useRaw) {
        const text = await res.text();
        setFileContent(text);
      } else {
        const data = await res.json();
        setFileContent(data.content);
      }
      setSelectedFile(path.split('/').pop() || null);
      setSelectedPath(path);
    } catch (err) {
      console.error('Error loading file:', err);
      setFileContent('Error loading file: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path || node.name);
    const isSelected = selectedPath === node.path;

    if (node.type === 'folder') {
      return (
        <div key={node.path || node.name}>
          <div
            onClick={() => toggleFolder(node.path || node.name)}
            style={{
              padding: '6px 8px',
              paddingLeft: `${depth * 16 + 8}px`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '13px',
              background: isSelected ? '#1a1a2e' : 'transparent',
            }}
          >
            <span style={{ color: '#fbbf24' }}>{isExpanded ? '📂' : '📁'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>
              {node.name}
            </span>
          </div>
          {isExpanded && node.children?.map(child => renderTreeNode(child, depth + 1))}
        </div>
      );
    }

    // File node
    const ext = node.extension || '';
    return (
      <div
        key={node.path}
        onClick={() => loadFile(node.path!)}
        style={{
          padding: '6px 8px',
          paddingLeft: `${depth * 16 + 8}px`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          borderRadius: '4px',
          color: isSelected ? '#fff' : '#9ca3af',
          fontSize: '13px',
          background: isSelected ? '#22d3ee20' : 'transparent',
          borderLeft: isSelected ? '2px solid #22d3ee' : '2px solid transparent',
        }}
      >
        <span>{getFileIcon(ext)}</span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>
          {node.name}
        </span>
      </div>
    );
  };

  // Render log file with syntax highlighting
  const renderLogContent = (content: string) => {
    // Pre-process content to split concatenated JSON
    // Split } { (concatenated JSON objects)
    let processed = content.replace(/\}\s*\{/g, '}\n{');
    // Split } followed by uppercase (JSON followed by text)
    processed = processed.replace(/\}([A-Z])/g, '}\n$1');

    const lines = processed.split('\n');

    return (
      <pre className="whitespace-pre-wrap" style={{ fontFamily: 'monospace', fontSize: '13px', wordBreak: 'break-word', margin: 0 }}>
        {lines.map((line, idx) => {
          // Check if line starts with JSON object
          if (line.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(line.trim());
              const pretty = JSON.stringify(parsed, null, 2);
              // Syntax highlighting: keys=cyan, strings=green, numbers=amber
              const highlighted = pretty
                .replace(/"([^"]+)":/g, '<span style="color: #22d3ee">"$1"</span>:')
                .replace(/: "([^"]+)"/g, ': <span style="color: #22c55e">"$1"</span>')
                .replace(/: (\d+)/g, ': <span style="color: #fbbf24">$1</span>')
                .replace(/: (true|false)/g, ': <span style="color: #a78bfa">$1</span>')
                .replace(/: (null)/g, ': <span style="color: #6b7280">$1</span>');
              return (
                <div key={idx} style={{ display: 'flex', minHeight: '20px' }}>
                  <span style={{ width: '40px', color: '#4b5563', textAlign: 'right', paddingRight: '12px', userSelect: 'none', flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span style={{ color: '#e2e8f0' }} dangerouslySetInnerHTML={{ __html: highlighted }} />
                </div>
              );
            } catch {
              // Not valid JSON, fall through to regular rendering
            }
          }

          // Regular line rendering
          // Highlight timestamps in [YYYY-MM-DD HH:MM:SS] format
          const timestampMatch = line.match(/\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]/);

          // Keywords
          const errorKeywords = ['Method Not Allowed', 'failed', 'error', 'Error', 'ERROR', 'fatal', 'FATAL'];
          const successKeywords = ['completed', 'success', 'SUCCESS', 'completed successfully'];
          const infoKeywords = ['claimed', 'routed', 'Claimed', 'Routed'];

          const hasError = errorKeywords.some(kw => line.includes(kw));
          const hasSuccess = successKeywords.some(kw => line.includes(kw));
          const hasInfo = infoKeywords.some(kw => line.includes(kw));

          let lineColor = '#e2e8f0';
          if (hasError) lineColor = '#f87171';
          else if (hasSuccess) lineColor = '#22c55e';
          else if (hasInfo) lineColor = '#fbbf24';

          return (
            <div key={idx} style={{ display: 'flex', minHeight: '20px' }}>
              <span style={{ width: '40px', color: '#4b5563', textAlign: 'right', paddingRight: '12px', userSelect: 'none', flexShrink: 0 }}>
                {idx + 1}
              </span>
              <span style={{ color: lineColor }}>
                {timestampMatch ? (
                  <>
                    <span style={{ color: '#22d3ee' }}>{timestampMatch[0]}</span>
                    {line.slice(timestampMatch[0].length)}
                  </>
                ) : line}
              </span>
            </div>
          );
        })}
      </pre>
    );
  };

  // Render JSON with syntax highlighting
  const renderJsonContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      const pretty = JSON.stringify(parsed, null, 2);

      // Simple syntax highlighting
      const highlighted = pretty
        .replace(/"([^"]+)":/g, '<span style="color: #22d3ee">"$1"</span>:') // keys
        .replace(/: "([^"]+)"/g, ': <span style="color: #22c55e">"$1"</span>') // strings
        .replace(/: (\d+)/g, ': <span style="color: #fbbf24">$1</span>') // numbers
        .replace(/: (true|false)/g, ': <span style="color: #a78bfa">$1</span>'); // booleans

      return (
        <pre
          style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      );
    } catch {
      return <pre style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</pre>;
    }
  };

  // Render shell script with syntax highlighting
  const renderShContent = (content: string) => {
    const lines = content.split('\n');

    return (
      <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
        {lines.map((line, idx) => {
          // Highlight comments
          let displayLine = line;
          const commentIdx = line.indexOf('#');
          let beforeComment = line;
          let comment = '';

          if (commentIdx !== -1) {
            beforeComment = line.slice(0, commentIdx);
            comment = line.slice(commentIdx);
          }

          // Highlight variables $VAR or ${VAR}
          const variablePattern = /(\$\{?\w+\}?)/g;
          const beforeVars = beforeComment.split(variablePattern);

          return (
            <div key={idx} style={{ display: 'flex', minHeight: '20px' }}>
              <span style={{ width: '40px', color: '#4b5563', textAlign: 'right', paddingRight: '12px', userSelect: 'none', flexShrink: 0 }}>
                {idx + 1}
              </span>
              <span>
                {beforeVars.map((part, i) => {
                  if (part.startsWith('$')) {
                    return <span key={i} style={{ color: '#22d3ee' }}>{part}</span>;
                  }
                  return <span key={i}>{part}</span>;
                })}
                {comment && <span style={{ color: '#22c55e' }}>{comment}</span>}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Render heartbeat file as card
  const renderHeartbeatCard = (content: string, fileName: string) => {
    const info = isHeartbeatFile(content);
    if (!info) return null;

    const statusColor = getStatusColor(info.timestamp);

    return (
      <div style={{
        background: '#0a0a0f',
        border: '1px solid #1a1a2e',
        borderRadius: '12px',
        padding: '24px',
        maxWidth: '400px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{ fontSize: '32px' }}>🕐</span>
          <div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>Last {info.type} Heartbeat</div>
            <div style={{ color: '#e2e8f0', fontSize: '18px', fontWeight: 'bold' }}>{fileName}</div>
          </div>
        </div>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ color: '#22d3ee', fontSize: '13px', marginBottom: '4px' }}>Timestamp</div>
          <div style={{ color: '#e2e8f0', fontSize: '16px', fontFamily: 'monospace' }}>{info.timestamp}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#6b7280', fontSize: '13px', marginBottom: '4px' }}>Relative</div>
            <div style={{ color: '#e2e8f0', fontSize: '14px' }}>{timeAgo(info.timestamp)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#6b7280', fontSize: '13px' }}>Status</span>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
            }} />
          </div>
        </div>
      </div>
    );
  };

  // Determine file type and render appropriately
  const renderContent = () => {
    if (!fileContent || !selectedFile) return null;

    const ext = selectedFile.split('.').pop()?.toLowerCase() || '';

    // Check for heartbeat file (.txt with ISO timestamp)
    if (ext === 'txt') {
      const heartbeatInfo = isHeartbeatFile(fileContent);
      if (heartbeatInfo) {
        return renderHeartbeatCard(fileContent, selectedFile);
      }
    }

    // Raw mode
    if (isRaw) {
      return (
        <pre style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {fileContent}
        </pre>
      );
    }

    // Smart rendering by type
    switch (ext) {
      case 'log':
        return renderLogContent(fileContent);
      case 'json':
        return renderJsonContent(fileContent);
      case 'sh':
        return renderShContent(fileContent);
      case 'md':
        return (
          <div className="markdown-content" style={{ color: '#e2e8f0', fontSize: '14px', lineHeight: '1.6' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{fileContent}</ReactMarkdown>
          </div>
        );
      default:
        return (
          <pre style={{ color: '#e2e8f0', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {fileContent}
          </pre>
        );
    }
  };

  const currentExt = selectedFile?.split('.').pop()?.toLowerCase() || '';

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
      {/* Sidebar */}
      <div style={{
        width: '240px',
        flexShrink: 0,
        borderRight: '1px solid #1a1a2e',
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0f',
        overflow: 'hidden',
      }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1a1a2e' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#22d3ee', margin: 0, marginBottom: '4px' }}>
            🧠 Memory Bank
          </h2>
          <div style={{ fontSize: '11px', color: '#6b7280' }}>
            {stats.totalFiles} files · {stats.totalSizeKB.toLocaleString()} KB
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px', borderBottom: '1px solid #1a1a2e' }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search..."
            style={{
              width: '100%',
              background: '#1a1a2e',
              border: 'none',
              borderRadius: '6px',
              color: '#e2e8f0',
              padding: '8px 10px',
              fontSize: '12px',
              outline: 'none',
            }}
          />
        </div>

        {/* File Tree */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {tree.map(node => renderTreeNode(node))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {/* Search Results */}
        {isSearching && searchResults.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ color: '#22d3ee', fontSize: '14px', marginBottom: '12px' }}>
              🔍 Search Results ({searchResults.length})
            </h3>
            {searchResults.map((result, idx) => (
              <div
                key={idx}
                onClick={() => loadFile(result.path)}
                style={{
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{result.filename}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>{result.matchCount} matches</span>
                </div>
                {result.snippets.map((snippet, mIdx) => (
                  <div key={mIdx} style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {snippet.split(/(\*\*.*?\*\*)/g).map((part, i) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={i} style={{ color: '#fbbf24' }}>{part.slice(2, -2)}</strong>;
                      }
                      return part;
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* File Viewer */}
        {selectedFile && fileContent !== null ? (
          <div>
            <button
              onClick={() => { setSelectedFile(null); setFileContent(null); setSelectedPath(null); }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#22d3ee',
                cursor: 'pointer',
                fontSize: '14px',
                marginBottom: '12px',
                padding: 0,
              }}
            >
              ← Back to files
            </button>

            <div style={{
              background: '#0a0a0f',
              border: '1px solid #1a1a2e',
              borderRadius: '8px',
              padding: '20px',
              minHeight: '300px',
            }}>
              <div style={{ marginBottom: '16px', borderBottom: '1px solid #1a1a2e', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '24px' }}>{getFileIcon('.' + currentExt)}</span>
                  <span style={{ fontWeight: 'bold', color: '#e2e8f0' }}>{selectedFile}</span>
                  {currentExt !== 'txt' && (
                    <span style={{ fontSize: '12px', color: '#6b7280', marginLeft: '12px' }}>
                      {fileContent.split('\n').length} lines
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    const newRaw = !isRaw;
                    setIsRaw(newRaw);
                    if (selectedPath) loadFile(selectedPath, newRaw);
                  }}
                  style={{
                    background: isRaw ? '#22d3ee' : '#1a1a2e',
                    border: 'none',
                    color: isRaw ? '#000' : '#e2e8f0',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  {isRaw ? '📄 Rendered' : '📝 Raw'}
                </button>
              </div>

              {renderContent()}
            </div>

            <style>{`
              .markdown-content h1 { color: #22d3ee; font-size: 24px; margin: 16px 0 8px; }
              .markdown-content h2 { color: #a78bfa; font-size: 20px; margin: 14px 0 6px; }
              .markdown-content h3 { color: #e2e8f0; font-size: 16px; margin: 12px 0 4px; }
              .markdown-content h4 { color: #9ca3af; font-size: 14px; margin: 10px 0 4px; }
              .markdown-content p { margin: 8px 0; }
              .markdown-content ul, .markdown-content ol { margin: 8px 0; padding-left: 20px; color: #9ca3af; }
              .markdown-content li { margin: 4px 0; }
              .markdown-content code { background: #1a1a2e; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
              .markdown-content pre { background: #1a1a2e; padding: 12px; border-radius: 8px; overflow-x: auto; }
              .markdown-content pre code { background: transparent; padding: 0; }
              .markdown-content blockquote { border-left: 3px solid #22d3ee; margin: 8px 0; padding-left: 12px; color: #6b7280; }
              .markdown-content a { color: #22d3ee; }
              .markdown-content hr { border: none; border-top: 1px solid #1a1a2e; margin: 16px 0; }
              .markdown-content table { border-collapse: collapse; width: 100%; margin: 8px 0; }
              .markdown-content th, .markdown-content td { border: 1px solid #1a1a2e; padding: 8px; text-align: left; }
              .markdown-content th { background: #1a1a2e; }
            `}</style>
          </div>
        ) : !isSearching ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '60px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>Select a file from the sidebar</div>
            <div style={{ fontSize: '13px' }}>Browse your memory bank folders</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
