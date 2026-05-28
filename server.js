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
const server = http.createServer(app);
const io = new Server(server);
const store = createSpaceStore();

const config = {
  port: process.env.PORT || 3000,
  livekitUrl: process.env.LIVEKIT_URL,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET
};

app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/vendor/livekit-client",
  express.static(path.join(__dirname, "node_modules", "livekit-client", "dist"))
);

registerLiveKitTokenRoute(app, config);
registerSocketHandlers(io, store);

server.listen(config.port, "0.0.0.0", () => {
  console.log(`Projeto GT rodando na porta ${config.port}`);
});
