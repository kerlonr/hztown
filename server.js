import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { registerLiveKitTokenRoute } from "./server/livekitTokenRoute.js";
import { createSpaceStore } from "./server/spaceStore.js";
import { registerSocketHandlers } from "./server/socketEvents.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e6 // 1 MB protege contra payloads abusivos
});
const store = createSpaceStore();

const config = {
  port: process.env.PORT || 3000,
  livekitUrl: process.env.LIVEKIT_URL,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET
};

// Content Security Policy permissiva o suficiente para LiveKit (wss/https) e Socket.IO.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'self' ws: wss: https:"
].join("; ");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  // Libera camera, microfone e captura de tela apenas para a propria origem.
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), display-capture=(self), geolocation=(), browsing-topics=()"
  );
  res.setHeader("Content-Security-Policy", CSP);
  next();
});

app.use(
  express.static(path.join(__dirname, "public"), {
    setHeaders(res, filePath) {
      // O service worker precisa revalidar para entregar atualizacoes.
      if (filePath.endsWith("sw.js")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  })
);
app.use(
  "/vendor/livekit-client",
  express.static(path.join(__dirname, "node_modules", "livekit-client", "dist"), {
    immutable: true,
    maxAge: "7d"
  })
);

registerLiveKitTokenRoute(app, config);
registerSocketHandlers(io, store);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`HZTown rodando na porta ${config.port}`);
});
