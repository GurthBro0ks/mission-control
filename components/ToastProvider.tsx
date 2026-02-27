"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Toast {
  id: string;
  type: "proposal" | "mission" | "step" | "completion" | "failure";
  message: string;
  timestamp: Date;
}

const TOAST_COLORS: Record<Toast["type"], string> = {
  proposal: "#f59e0b",
  mission: "#22d3ee",
  step: "#a78bfa",
  completion: "#4ade80",
  failure: "#ef4444",
};

const TOAST_ICONS: Record<Toast["type"], string> = {
  proposal: "📋",
  mission: "🚀",
  step: "⚡",
  completion: "✅",
  failure: "❌",
};

const MAX_TOASTS = 3;
const AUTO_DISMISS_MS = 5000;

export default function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: Toast["type"], message: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = {
        id,
        type,
        message,
        timestamp: new Date(),
      };

      setToasts((prev) => {
        const updated = [newToast, ...prev];
        return updated.slice(0, MAX_TOASTS);
      });

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        dismissToast(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [dismissToast]
  );

  useEffect(() => {
    // Connect to SSE
    eventSourceRef.current = new EventSource("/mission-control/api/sse");

    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, data: payload } = data;

        if (type === "proposal") {
          const msg = payload?.title
            ? `Proposal: ${payload.title}`
            : "New proposal created";
          addToast("proposal", msg);
        } else if (type === "mission") {
          const msg =
            payload?.status === "completed"
              ? `Mission completed: ${payload.title || "Mission"}`
              : `Mission started: ${payload.title || "Mission"}`;
          addToast("mission", msg);
        } else if (type === "step") {
          const status = payload?.status || "running";
          const msg =
            status === "completed"
              ? `Step completed: ${payload?.title || "Step"}`
              : status === "failed"
              ? `Step failed: ${payload?.title || "Step"}`
              : `Step running: ${payload?.title || "Step"}`;
          const toastType = status === "failed" ? "failure" : status === "completed" ? "completion" : "step";
          addToast(toastType, msg);
        } else if (type === "task_update") {
          const msg = payload?.title
            ? `Task: ${payload.title}`
            : "Task updated";
          addToast("step", msg);
        }
      } catch (e) {
        // Ignore parse errors for ping/connected messages
      }
    };

    eventSourceRef.current.onerror = () => {
      // Reconnect automatically
      eventSourceRef.current?.close();
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          eventSourceRef.current = new EventSource("/mission-control/api/sse");
        }
      }, 3000);
    };

    return () => {
      eventSourceRef.current?.close();
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "16px",
        right: "16px",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          onClick={() => dismissToast(toast.id)}
          style={{
            background: "#1a1a2e",
            color: "#e5e5e5",
            padding: "10px 14px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            border: `1px solid ${TOAST_COLORS[toast.type]}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            fontFamily: "monospace",
            cursor: "pointer",
            pointerEvents: "auto",
            animation: "slideIn 0.3s ease-out",
            minWidth: "200px",
            maxWidth: "320px",
          }}
        >
          <span style={{ fontSize: "16px" }}>
            {TOAST_ICONS[toast.type]}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: TOAST_COLORS[toast.type] }}>
              {toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}
            </div>
            <div style={{ color: "#9ca3af", fontSize: "11px" }}>
              {toast.message}
            </div>
          </div>
          <div
            style={{
              fontSize: "10px",
              color: "#6b7280",
            }}
          >
            {toast.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <style jsx>{`
            @keyframes slideIn {
              from {
                opacity: 0;
                transform: translateX(100%);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>
        </div>
      ))}
    </div>
  );
}
