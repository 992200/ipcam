const express = require("express");
const WebSocket = require("ws");
const os = require("os");
const path = require("path");

const app = express();
// Use Render's assigned port in production, fall back to 5000 locally.
const PORT = process.env.PORT || 5000;

/* 🔹 Serve built React app (for Render / production) */
const clientBuildPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientBuildPath));

/* 🔹 API to send device IP to React */
app.get("/ip", (req, res) => {
  const nets = os.networkInterfaces();
  let ip = "Unknown";

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        ip = net.address;
        break;
      }
    }
  }

  res.json({ ip, port: PORT });
});

/* 🔹 Viewer page */
app.get("/view", (req, res) => {
  res.send(`
    <html>
      <body style="font-family:Arial;text-align:center">
        <h2>📺 Live Camera Feed</h2>
        <img id="img" width="480"/>
        <script>
          const proto = location.protocol === "https:" ? "wss://" : "ws://";
          const ws = new WebSocket(proto + location.host);
          ws.onmessage = e => {
            if (e.data instanceof Blob) {
              document.getElementById("img").src =
                URL.createObjectURL(e.data);
            }
          };
        </script>
      </body>
    </html>
  `);
});

/* 🔹 Start server */
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("📡 IP Camera running");

  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        console.log(`➡ Viewer URL: http://${net.address}:${PORT}/view`);
      }
    }
  }
});

/* 🔹 WebSocket for video frames */
const wss = new WebSocket.Server({ server });
let clients = [];

wss.on("connection", ws => {
  clients.push(ws);

  ws.on("message", data => {
    clients.forEach(c => {
      if (c !== ws && c.readyState === 1) {
        c.send(data);
      }
    });
  });

  ws.on("close", () => {
    clients = clients.filter(c => c !== ws);
  });
});

/* 🔹 Root route falls back to React app (SPA) */
app.get("/", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});
