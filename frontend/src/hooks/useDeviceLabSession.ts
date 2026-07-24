'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_ORIGIN } from '../lib/api';

interface StartParams {
  url: string;
  deviceId: string;
  orientation: 'portrait' | 'landscape';
  browserEngine?: 'chromium' | 'firefox' | 'webkit';
}

interface StartAck {
  ok: boolean;
  url?: string;
  browserEngine?: string;
  error?: string;
}

export type DeviceLabInputAction =
  | { type: 'click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'key'; key: string }
  | { type: 'scroll'; deltaX: number; deltaY: number }
  | { type: 'navigate'; url: string }
  | { type: 'back' | 'forward' | 'reload' };

export interface ConsoleLogEntry {
  level: string;
  text: string;
  ts: number;
}

export interface NetworkRequestEntry {
  id: number;
  method: string;
  url: string;
  resourceType: string;
  status: number | null;
  errorText: string | null;
  ts: number;
}

export interface ElementCrumb {
  tag: string;
  id: string | null;
  classes: string[];
}

export interface MatchedCssRule {
  selector: string;
  declarations: { prop: string; value: string }[];
  source: string;
}

export interface InspectedElement {
  tag: string;
  id: string | null;
  classes: string[];
  rect: { x: number; y: number; width: number; height: number };
  ancestors: ElementCrumb[];
  matchedRules: MatchedCssRule[];
  margin: { top: string; right: string; bottom: string; left: string };
  padding: { top: string; right: string; bottom: string; left: string };
  border: { top: string; right: string; bottom: string; left: string };
  style: {
    display: string;
    position: string;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    textAlign: string;
    zIndex: string;
  };
  outerHTMLPreview: string;
}

export interface StorageCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

export interface StorageSnapshot {
  localStorage: [string, string][];
  sessionStorage: [string, string][];
  cookies: StorageCookie[];
}

export interface PerformanceMetrics {
  domContentLoaded: number | null;
  loadEvent: number | null;
  ttfb: number | null;
  firstPaint: number | null;
  firstContentfulPaint: number | null;
  resourceCount: number;
  totalTransferBytes: number;
  byType: Record<string, number>;
}

export interface MemoryInfo {
  available: boolean;
  usedJSHeapSize?: number;
  totalJSHeapSize?: number;
  jsHeapSizeLimit?: number;
}

export interface SourceFile {
  url: string;
  status: number;
  contentType: string;
  text: string;
}

const MAX_LOG_ENTRIES = 300;

/**
 * Owns one live Playwright session over a dedicated socket.io namespace: a
 * real browser tab actually loads the URL, and every tap/keystroke/scroll
 * we forward runs against that same page, so the site behaves exactly like
 * it would on a real device instead of showing a static mockup.
 */
export function useDeviceLabSession() {
  const socketRef = useRef<Socket | null>(null);
  const lastStartRef = useRef<StartParams | null>(null);
  const [connected, setConnected] = useState(false);
  const [frame, setFrame] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [networkRequests, setNetworkRequests] = useState<NetworkRequestEntry[]>([]);
  const [domHtml, setDomHtml] = useState('');
  const [inspected, setInspected] = useState<InspectedElement | null>(null);
  const [storage, setStorage] = useState<StorageSnapshot | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [source, setSource] = useState<SourceFile | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const runStart = useCallback((socket: Socket, params: StartParams) => {
    return new Promise<StartAck>((resolve) => {
      setStarting(true);
      setError('');
      socket.emit('start', params, (ack: StartAck) => {
        setStarting(false);
        if (!ack?.ok) setError(ack?.error || 'Failed to start device session');
        else setCurrentUrl(ack.url || params.url);
        resolve(ack);
      });
    });
  }, []);

  useEffect(() => {
    const socket = io(`${API_ORIGIN}/device-lab`, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    let hadConnectedBefore = false;

    socket.on('connect', () => {
      setConnected(true);
      // A dropped connection (dev-server restart, brief network hiccup)
      // otherwise strands the user on a dead frame with no way back short
      // of manually pressing Go again — silently resume where they were.
      if (hadConnectedBefore && lastStartRef.current) {
        runStart(socket, lastStartRef.current);
      }
      hadConnectedBefore = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('device-lab:frame', (payload: { image: string; url: string }) => {
      setFrame(payload.image);
      setCurrentUrl(payload.url);
    });
    socket.on('device-lab:navigated', (payload: { url: string }) => {
      setCurrentUrl(payload.url);
    });
    socket.on('device-lab:error', (payload: { message: string }) => {
      setError(payload.message);
    });
    socket.on('device-lab:console', (payload: ConsoleLogEntry) => {
      setConsoleLogs((prev) => [...prev.slice(-(MAX_LOG_ENTRIES - 1)), payload]);
    });
    socket.on(
      'device-lab:network',
      (payload: {
        id: number;
        phase: 'request' | 'response' | 'failed';
        method?: string;
        url?: string;
        resourceType?: string;
        status?: number;
        errorText?: string;
        ts: number;
      }) => {
        setNetworkRequests((prev) => {
          if (payload.phase === 'request') {
            const next: NetworkRequestEntry = {
              id: payload.id,
              method: payload.method || 'GET',
              url: payload.url || '',
              resourceType: payload.resourceType || 'other',
              status: null,
              errorText: null,
              ts: payload.ts,
            };
            return [...prev.slice(-(MAX_LOG_ENTRIES - 1)), next];
          }
          return prev.map((entry) =>
            entry.id === payload.id
              ? {
                  ...entry,
                  status: payload.phase === 'response' ? payload.status ?? null : entry.status,
                  errorText: payload.phase === 'failed' ? payload.errorText || 'Failed' : entry.errorText,
                }
              : entry
          );
        });
      }
    );
    socket.on('device-lab:dom', (payload: { html: string }) => {
      setDomHtml(payload.html);
    });
    socket.on('device-lab:inspect', (payload: InspectedElement | null) => {
      setInspected(payload);
    });
    socket.on('device-lab:storage', (payload: StorageSnapshot) => {
      setStorage(payload);
    });
    socket.on('device-lab:performance', (payload: PerformanceMetrics) => {
      setPerformanceMetrics(payload);
    });
    socket.on('device-lab:memory', (payload: MemoryInfo) => {
      setMemory(payload);
    });
    socket.on('device-lab:source', (payload: SourceFile) => {
      setSource(payload);
      setSourceLoading(false);
    });

    return () => {
      socket.emit('stop');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [runStart]);

  const start = useCallback(
    (params: StartParams) => {
      const socket = socketRef.current;
      if (!socket) return Promise.resolve<StartAck>({ ok: false, error: 'Not connected to device lab session server' });
      lastStartRef.current = params;
      setFrame('');
      setConsoleLogs([]);
      setNetworkRequests([]);
      setDomHtml('');
      setInspected(null);
      setStorage(null);
      setPerformanceMetrics(null);
      setMemory(null);
      setSource(null);
      return runStart(socket, params);
    },
    [runStart]
  );

  const sendInput = useCallback((action: DeviceLabInputAction) => {
    socketRef.current?.emit('input', action);
  }, []);

  const inspectDom = useCallback(() => {
    socketRef.current?.emit('inspect-dom');
  }, []);

  const inspectAt = useCallback((x: number, y: number) => {
    socketRef.current?.emit('inspect-at', { x, y });
  }, []);

  const clearInspected = useCallback(() => setInspected(null), []);

  const inspectStorage = useCallback(() => {
    socketRef.current?.emit('inspect-storage');
  }, []);

  const inspectPerformance = useCallback(() => {
    socketRef.current?.emit('inspect-performance');
  }, []);

  const inspectMemory = useCallback(() => {
    socketRef.current?.emit('inspect-memory');
  }, []);

  const fetchSource = useCallback((url: string) => {
    setSourceLoading(true);
    setSource(null);
    socketRef.current?.emit('fetch-source', { url });
  }, []);

  return {
    connected,
    frame,
    currentUrl,
    starting,
    error,
    start,
    sendInput,
    consoleLogs,
    networkRequests,
    domHtml,
    inspectDom,
    inspected,
    inspectAt,
    clearInspected,
    storage,
    inspectStorage,
    performanceMetrics,
    inspectPerformance,
    memory,
    inspectMemory,
    source,
    sourceLoading,
    fetchSource,
  };
}
