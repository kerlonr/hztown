import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const spaces = new Map();

app.use(express.static(path.join(__dirname, "public")));

function getSpace(spaceId) {
  if (!spaces.has(spaceId)) {
    spaces.set(spaceId, new Map());
  }
  return spaces.get(spaceId);
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    color: user.color,
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
      users: Array.from(space.values()).map(publicUser)
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

    socket.to(currentSpaceId).emit("presence:updated", publicUser(user));
    socket.emit("presence:self", publicUser(user));
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
    }

    if (user) {
      console.log(`${user.name} saiu de ${currentSpaceId}`);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Projeto GT rodando na porta ${PORT}`);
});
