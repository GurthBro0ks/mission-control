"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface FeedEntry {
  id: string;
  type: "chat" | "pulse" | "ops" | "incident" | "story";
  agent: string;
  icon: string;
  tags: string[];
  message: string;
  timestamp: string;
  expandable?: boolean;
  childCount?: number;
}

interface FeedCounts {
  all: number;
  chat: number;
  pulse: number;
  ops: number;
  incident: number;
  story: number;
}

type SpeedSetting = "slow" | "normal" | "fast";
type TypeFilter = "all" | "story" | "pulse" | "ops" | "incident";

const agentColors: Record<string, string> = {
  ned: "#22d3ee",
  gurth: "#a78bfa",
  garth: "#34d399",
  kieran: "#fbbf24",
  system: "#6b7280",
  rex: "#f97316",
  atlas: "#a855f7",
  sentinel: "#ef4444",
  git: "#84cc16",
  scout: "#06b6d4",
  query: "#eab308",
  cloud: "#3b82f6",
  pip: "#10b981",
};

const typeIcons: Record<string, string> = {
  chat: "💬",
  pulse: "📡",
  ops: "⚙️",
  incident: "🚨",
  story: "📖",
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 1 minute
  if (diff < 60000) {
    return "just now";
  }
  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  // More than 24 hours - show date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFullTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FeedPage() {
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [counts, setCounts] = useState<FeedCounts>({
    all: 0,
    chat: 0,
    pulse: 0,
    ops: 0,
    incident: 0,
    story: 0,
  });
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [speed, setSpeed] = useState<SpeedSetting>("normal");
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [newEntry, setNewEntry] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const limit = 50;

  // Fetch feed data
  const fetchFeed = useCallback(
    async (loadMore = false) => {
      try {
        const params = new URLSearchParams();
        params.set("limit", limit.toString());
        params.set("offset", loadMore ? offset.toString() : "0");
        if (typeFilter !== "all") {
          params.set("type", typeFilter);
        }
        if (selectedAgents.length > 0) {
          params.set("agent", selectedAgents.join(","));
        }

        const res = await fetch(`/mission-control/api/feed?${params.toString()}`);
        if (!res.ok) {
          setEntries(loadMore ? entries : []);
          setCounts({ all: 0, chat: 0, pulse: 0, ops: 0, incident: 0, story: 0 });
          setHasMore(false);
          return;
        }
        const data = await res.json();

        if (loadMore) {
          setEntries((prev) => [...prev, ...(data.entries || [])]);
        } else {
          setEntries(data.entries || []);
        }
        setCounts(data.counts || { all: 0, chat: 0, pulse: 0, ops: 0, incident: 0, story: 0 });
        setHasMore((data.entries || []).length === limit);
        setOffset(loadMore ? offset + limit : limit);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, selectedAgents, offset, limit]
  );

  // Initial fetch
  useEffect(() => {
    setLoading(true);
    fetchFeed();
  }, [typeFilter, selectedAgents]);

  // SSE for real-time updates
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource("/mission-control/api/sse");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "new_message" || data.type === "new_event") {
            // Add new entry at the top with animation
            const entry = data.data;
            if (entry) {
              setNewEntry(entry.id);
              setEntries((prev) => [entry, ...prev.slice(0, 99)]);

              // Clear animation flag after animation
              setTimeout(() => setNewEntry(null), 500);
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        // Reconnect after delay
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
    };
  }, []);

  // Auto-scroll based on speed setting
  useEffect(() => {
    if (speed === "fast") {
      const interval = setInterval(() => {
        if (feedRef.current) {
          feedRef.current.scrollTop += 1;
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [speed]);

  // Available agents
  const availableAgents = ["ned", "rex", "atlas", "sentinel", "git", "scout", "query", "cloud", "pip", "gurth", "garth", "kieran", "system"];

  // Toggle agent filter
  const toggleAgent = (agent: string) => {
    setSelectedAgents((prev) =>
      prev.includes(agent)
        ? prev.filter((a) => a !== agent)
        : [...prev, agent]
    );
  };

  // Load more entries
  const loadMore = () => {
    fetchFeed(true);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 180px)",
        background: "#0a0f14",
      }}
    >
      {/* Top Section - Filter Bar */}
      <div
        style={{
          padding: "12px 16px",
          background: "#111827",
          borderBottom: "1px solid #1e3a4a",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {/* Speed Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#6b7280" }}>Scroll:</span>
          {(["slow", "normal", "fast"] as SpeedSetting[]).map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: "4px 10px",
                fontSize: "10px",
                background: speed === s ? "#1e3a4a" : "#0a0a0f",
                color: speed === s ? "#22d3ee" : "#6b7280",
                border: `1px solid ${speed === s ? "#22d3ee" : "#1e3a4a"}`,
                borderRadius: "4px",
                cursor: "pointer",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Type Tabs */}
        <div style={{ display: "flex", gap: "4px" }}>
          {[
            { key: "all", label: "All", count: counts.all },
            { key: "story", label: "Stories", count: counts.story },
            { key: "pulse", label: "Pulse", count: counts.pulse },
            { key: "ops", label: "Ops", count: counts.ops },
            { key: "incident", label: "Incidents", count: counts.incident },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setTypeFilter(tab.key as TypeFilter)}
              style={{
                padding: "6px 14px",
                fontSize: "11px",
                background:
                  typeFilter === tab.key
                    ? "linear-gradient(180deg, #1e3a4a 0%, #111827 100%)"
                    : "transparent",
                color: typeFilter === tab.key ? "#e2e8f0" : "#6b7280",
                border: "none",
                borderBottom: `2px solid ${
                  typeFilter === tab.key ? "#22d3ee" : "transparent"
                }`,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontSize: "9px",
                  padding: "2px 5px",
                  background: "#0a0a0f",
                  borderRadius: "8px",
                  color: "#4b5563",
                }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Agent Pills */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {availableAgents.map((agent) => (
            <button
              key={agent}
              onClick={() => toggleAgent(agent)}
              style={{
                padding: "4px 10px",
                fontSize: "10px",
                background: selectedAgents.includes(agent)
                  ? `${agentColors[agent]}20`
                  : "#0a0a0f",
                color: selectedAgents.includes(agent)
                  ? agentColors[agent]
                  : "#6b7280",
                border: `1px solid ${
                  selectedAgents.includes(agent)
                    ? agentColors[agent]
                    : "#1e3a4a"
                }`,
                borderRadius: "12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: agentColors[agent],
                }}
              />
              {agent}
            </button>
          ))}
        </div>

        {/* Count Dots */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            fontSize: "10px",
            color: "#4b5563",
          }}
        >
          <span>
            <span style={{ color: "#e2e8f0" }}>{counts.chat}</span> messages
          </span>
          <span>
            <span style={{ color: "#a78bfa" }}>{counts.ops}</span> ops events
          </span>
          <span>
            <span style={{ color: "#f59e0b" }}>{counts.incident}</span> errors
          </span>
        </div>
      </div>

      {/* Main Section - Feed Entries */}
      <div
        ref={feedRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          background: "#0a1a0a",
        }}
      >
        {loading && entries.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "#4ade80",
              fontFamily: "monospace",
              fontSize: "13px",
            }}
          >
            Loading feed...
          </div>
        ) : entries.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "200px",
              color: "#4b5563",
              fontSize: "13px",
            }}
          >
            No feed entries yet
          </div>
        ) : (
          entries.map((entry, index) => (
            <div
              key={entry.id}
              style={{
                display: "flex",
                gap: "12px",
                padding: "12px",
                background: "#0a0a0f",
                borderRadius: "6px",
                border: "1px solid #1e3a4a",
                animation:
                  entry.id === newEntry
                    ? "slideIn 0.3s ease-out"
                    : undefined,
              }}
            >
              {/* Agent Icon */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  background: "#111827",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                {entry.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: agentColors[entry.agent] || "#e2e8f0",
                    }}
                  >
                    {entry.agent}
                  </span>
                  <span style={{ fontSize: "10px", color: "#4b5563" }}>
                    {typeIcons[entry.type]}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      color: "#4b5563",
                      marginLeft: "auto",
                    }}
                    title={formatFullTime(entry.timestamp)}
                  >
                    {formatTime(entry.timestamp)}
                  </span>
                </div>

                {/* Tags */}
                {entry.tags.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "4px",
                      marginBottom: "6px",
                    }}
                  >
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: "9px",
                          padding: "2px 6px",
                          background: "#1e3a4a",
                          borderRadius: "4px",
                          color: "#6b7280",
                          textTransform: "uppercase",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Message */}
                <div
                  style={{
                    fontSize: "13px",
                    color: "#4ade80",
                    fontFamily: "var(--font-jetbrains), monospace",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {entry.message}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <button
            onClick={loadMore}
            style={{
              padding: "12px",
              background: "#111827",
              border: "1px solid #1e3a4a",
              borderRadius: "6px",
              color: "#6b7280",
              fontSize: "12px",
              cursor: "pointer",
              marginTop: "8px",
            }}
          >
            Load more
          </button>
        )}
      </div>

      {/* Bottom Section - Send Bar */}
      <div
        style={{
          padding: "12px 16px",
          background: "#111827",
          borderTop: "1px solid #1e3a4a",
          display: "flex",
          gap: "12px",
        }}
      >
        <input
          type="text"
          placeholder="Send a message to the feed..."
          onKeyDown={async (e) => {
            if (e.key === "Enter" && e.currentTarget.value.trim()) {
              const message = e.currentTarget.value.trim();
              const channel =
                typeFilter === "incident"
                  ? "incident"
                  : typeFilter === "pulse"
                  ? "pulse"
                  : typeFilter === "story"
                  ? "story"
                  : "all";

              try {
                await fetch("/mission-control/api/comms", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    from: "user",
                    message,
                    channel,
                  }),
                });
                e.currentTarget.value = "";
                fetchFeed();
              } catch (err) {
                console.error("Failed to send message:", err);
              }
            }
          }}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: "#0a0a0f",
            border: "1px solid #1e3a4a",
            borderRadius: "6px",
            color: "#e2e8f0",
            fontSize: "13px",
            outline: "none",
          }}
        />
        <Link
          href="/comms"
          style={{
            padding: "10px 16px",
            background: "#1e3a4a",
            border: "none",
            borderRadius: "6px",
            color: "#22d3ee",
            fontSize: "12px",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          Open Chat
        </Link>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        input::placeholder {
          color: #4b5563;
        }
        input:focus {
          border-color: #22d3ee !important;
          box-shadow: 0 0 0 2px #22d3ee20;
        }
        button:hover {
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
