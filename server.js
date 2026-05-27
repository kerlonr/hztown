import express from "express";
import http from "http";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { AccessToken } from "livekit-server-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const spaces = new Map();
const spaceMessages = new Map();

app.use(express.static(path.join(__dirname, "public")));
app.use(
  "/vendor/livekit-client",
  express.static(path.join(__dirname, "node_modules", "livekit-client", "dist"))
);

app.get("/api/livekit-token", async (req, res) => {
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    res.status(503).json({
      error:
        "LiveKit nao configurado. Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET."
    });
    return;
  }

  const room = sanitizeLiveKitId(req.query.room, "tec-hq-team");
  const identity = sanitizeLiveKitId(req.query.identity, `guest-${randomUUID()}`);
  const name = String(req.query.name || "Convidado").trim().slice(0, 28);

  try {
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name,
      ttl: "2h"
    });

    token.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true
    });

    res.json({
      url: LIVEKIT_URL,
      token: await token.toJwt()
    });
  } catch (error) {
    console.error("Falha ao gerar token LiveKit", error);
    res.status(500).json({ error: "Nao foi possivel gerar o token LiveKit." });
  }
});

function getSpace(spaceId) {
  if (!spaces.has(spaceId)) {
    spaces.set(spaceId, new Map());
  }
  return spaces.get(spaceId);
}

function getSpaceMessages(spaceId) {
  if (!spaceMessages.has(spaceId)) {
    spaceMessages.set(spaceId, []);
  }
  return spaceMessages.get(spaceId);
}

function sanitizeLiveKitId(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 96);
  return text || fallback;
}

function sanitizeAvatar(value) {
  const avatar = String(value || "").trim();
  if (avatar.startsWith("default:")) {
    return avatar.slice(0, 48);
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/.test(avatar)) {
    return avatar.slice(0, 180000);
  }
  return "";
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    color: user.color,
    avatar: user.avatar,
    x: user.x,
    y: user.y,
    channel: user.channel,
    inVoice: user.inVoice,
    muted: user.muted
  };
}

io.on("connection", (socket) => {
  let currentSpaceId = null;

  socket.on("space:join", (profile) => {
    currentSpaceId = profile.spaceId || "tec-hq";
    const space = getSpace(currentSpaceId);
    const user = {
      id: socket.id,
      name: profile.name?.trim()?.slice(0, 28) || "Convidado",
      color: profile.color || "#7c5cff",
      avatar: sanitizeAvatar(profile.avatar),
      x: Number.isFinite(profile.x) ? profile.x : 42,
      y: Number.isFinite(profile.y) ? profile.y : 50,
      channel: profile.channel || "team",
      inVoice: false,
      muted: false
    };

    space.set(socket.id, user);
    socket.join(currentSpaceId);
    socket.emit("space:ready", {
      selfId: socket.id,
      users: Array.from(space.values()).map(publicUser),
      messages: getSpaceMessages(currentSpaceId)
    });
    socket.to(currentSpaceId).emit("presence:joined", publicUser(user));
  });

  socket.on("presence:update", (patch) => {
    if (!currentSpaceId) return;

    const space = getSpace(currentSpaceId);
    const user = space.get(socket.id);
    if (!user) return;

    if (Number.isFinite(patch.x)) user.x = Math.max(0, Math.min(100, patch.x));
    if (Number.isFinite(patch.y)) user.y = Math.max(0, Math.min(100, patch.y));
    if (typeof patch.channel === "string") user.channel = patch.channel.slice(0, 32);
    if (typeof patch.inVoice === "boolean") user.inVoice = patch.inVoice;
    if (typeof patch.muted === "boolean") user.muted = patch.muted;
    if (typeof patch.avatar === "string") user.avatar = sanitizeAvatar(patch.avatar);

    socket.to(currentSpaceId).emit("presence:updated", publicUser(user));
    socket.emit("presence:self", publicUser(user));
  });

  socket.on("chat:send", (payload) => {
    if (!currentSpaceId) return;

    const space = getSpace(currentSpaceId);
    const user = space.get(socket.id);
    if (!user) return;

    const text = String(payload?.text || "").trim().slice(0, 800);
    const channel = String(payload?.channel || user.channel || "team").slice(0, 32);
    if (!text) return;

    const message = {
      id: randomUUID(),
      userId: socket.id,
      name: user.name,
      color: user.color,
      avatar: user.avatar,
      channel,
      text,
      createdAt: Date.now()
    };

    const messages = getSpaceMessages(currentSpaceId);
    messages.push(message);
    if (messages.length > 120) {
      messages.splice(0, messages.length - 120);
    }

    io.to(currentSpaceId).emit("chat:message", message);
  });

  socket.on("rtc:offer", ({ to, description }) => {
    io.to(to).emit("rtc:offer", { from: socket.id, description });
  });

  socket.on("rtc:answer", ({ to, description }) => {
    io.to(to).emit("rtc:answer", { from: socket.id, description });
  });

  socket.on("rtc:ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("rtc:ice-candidate", { from: socket.id, candidate });
  });

  socket.on("disconnect", () => {
    if (!currentSpaceId) return;

    const space = getSpace(currentSpaceId);
    const user = space.get(socket.id);
    space.delete(socket.id);
    socket.to(currentSpaceId).emit("presence:left", socket.id);

    if (space.size === 0) {
      spaces.delete(currentSpaceId);
      spaceMessages.delete(currentSpaceId);
    }

    if (user) {
      console.log(`${user.name} saiu de ${currentSpaceId}`);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Projeto GT rodando na porta ${PORT}`);
});
