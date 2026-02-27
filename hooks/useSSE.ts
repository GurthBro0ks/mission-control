"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

interface SSEEvent {
  type: string;
  file?: string;
  data?: any;
}

export function useSSE() {
  const [event, setEvent] = useState<SSEEvent | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(() => {
    const eventSource = new EventSource('/mission-control/api/sse');

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvent(data);
      } catch {
        // Keep-alive or non-JSON
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      
      // Exponential backoff: 1s, 2s, 4s, 8s... max 30s
      const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 30000);
      attemptRef.current++;
      
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    eventSource.onopen = () => {
      attemptRef.current = 0;
    };

    return eventSource;
  }, []);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      eventSource.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return event;
}

// Hook that refetches data when file changes match a pattern
export function useAutoRefresh(
  dataKey: string,
  fetchFn: () => Promise<void>,
  event: SSEEvent | null
) {
  useEffect(() => {
    if (!event) return;
    
    if (event.type === 'file_change' && event.file) {
      // Match if the changed file relates to our data key
      const matches = 
        (dataKey === 'tasks' && event.file.includes('taskboard')) ||
        (dataKey === 'agents' && event.file.includes('team')) ||
        (dataKey === 'calendar' && event.file.includes('calendar')) ||
        (dataKey === 'memory' && event.file.endsWith('.md'));
      
      if (matches) {
        fetchFn();
      }
    }
  }, [event, dataKey, fetchFn]);
}
