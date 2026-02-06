import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  const [serverInfo, setServerInfo] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImgUrl, setViewerImgUrl] = useState(null);
  const viewerWsRef = useRef(null);

  /* 🔹 Fetch IP from backend */
  useEffect(() => {
    // Vite dev proxy forwards this to the Express server.
    fetch("/ip")
      .then(res => res.json())
      .then(data => setServerInfo(data))
      .catch(() => {});
  }, []);

  const backendHost = useMemo(() => {
    // If you opened the site via an IP (e.g. 192.168.x.x), use that same host.
    // If you're on localhost, fall back to the IP returned by the server.
    const h = window.location.hostname;
    if (h && h !== "localhost" && h !== "127.0.0.1") return h;
    if (serverInfo?.ip && serverInfo.ip !== "Unknown") return serverInfo.ip;
    return "localhost";
  }, [serverInfo?.ip]);

  const isDev = import.meta.env.DEV;

  const viewerUrl = useMemo(() => {
    if (isDev) {
      // Local dev: React on Vite (5173), backend on Express (5000).
      const port = serverInfo?.port ?? 5000;
      return `http://${backendHost}:${port}/view`;
    }
    // Render / production: everything is on the same host.
    return `${window.location.origin}/view`;
  }, [isDev, backendHost, serverInfo?.port]);

  const wsUrl = useMemo(() => {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    if (isDev) {
      const port = serverInfo?.port ?? 5000;
      return `${wsProtocol}//${backendHost}:${port}`;
    }

    // In production on Render, backend shares host/port with the frontend.
    return `${wsProtocol}//${window.location.host}`;
  }, [isDev, backendHost, serverInfo?.port]);

  const startBroadcasting = async () => {
    if (wsRef.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;

    if (!wsUrl) return;
    wsRef.current = new WebSocket(wsUrl);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    intervalRef.current = setInterval(() => {
      if (!videoRef.current.videoWidth) return;

      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      ctx.drawImage(videoRef.current, 0, 0);

      canvas.toBlob(blob => {
        if (wsRef.current.readyState === 1) {
          wsRef.current.send(blob);
        }
      }, "image/jpeg", 0.6);
    }, 150);
  };

  // Inline viewer (shows the same feed, without leaving the website)
  useEffect(() => {
    if (!viewerOpen || !wsUrl) return;

    const ws = new WebSocket(wsUrl);
    viewerWsRef.current = ws;

    ws.onmessage = e => {
      if (e.data instanceof Blob) {
        const nextUrl = URL.createObjectURL(e.data);
        setViewerImgUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          return nextUrl;
        });
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      viewerWsRef.current = null;
      setViewerImgUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [viewerOpen, wsUrl]);

  return (
    <div className="app">
      <h2>📷 IP Camera</h2>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{ width: "320px", border: "2px solid #22c55e" }}
      />

      <br /><br />

      <button onClick={startBroadcasting}>
        Start Broadcasting
      </button>

      {serverInfo && viewerUrl && (
        <div style={{ marginTop: "15px" }}>
          <p><b>Viewer URL:</b></p>
          <code>{viewerUrl}</code>
          <div style={{ marginTop: "10px" }}>
            <button onClick={() => setViewerOpen(v => !v)}>
              {viewerOpen ? "Hide Viewer Here" : "Show Viewer Here"}
            </button>
            <span style={{ marginLeft: "10px" }}>
              <a href={viewerUrl} target="_blank" rel="noreferrer">
                Open viewer in new tab
              </a>
            </span>
          </div>
        </div>
      )}

      {viewerOpen && (
        <div className="viewer">
          <h3>Live Viewer (inside the website)</h3>
          <img
            src={viewerImgUrl ?? ""}
            alt="Live camera feed"
            width="480"
          />
        </div>
      )}
    </div>
  );
}
