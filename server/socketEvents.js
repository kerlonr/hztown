import { randomUUID } from "crypto";
import { sanitizeAvatar, sanitizeName, sanitizeSpaceId, sanitizeText } from "./sanitizers.js";
import { publicUser } from "./spaceStore.js";

const MESSAGE_LIMIT = 120;
const ALLOWED_CHANNELS = new Set(["team", "daily", "focus"]);

// Limites simples por socket para conter flood de eventos.
const RATE_LIMITS = {
  "presence:update": { tokens: 30, intervalMs: 1000 },
  "chat:send": { tokens: 5, intervalMs: 3000 }
};

function createRateLimiter() {
  const buckets = new Map();
  return (event) => {
    const limit = RATE_LIMITS[event];
    if (!limit) return true;

    const now = Date.now();
    const bucket = buckets.get(event) || { count: 0, resetAt: now + limit.intervalMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + limit.intervalMs;
    }
    bucket.count += 1;
    buckets.set(event, bucket);
    return bucket.count <= limit.tokens;
  };
}

export function registerSocketHandlers(io, store) {
  io.on("connection", (socket) => {
    let currentSpaceId = null;
    const allow = createRateLimiter();

    socket.on("space:join", (profile) => {
      if (currentSpaceId) return; // ja entrou neste socket
      currentSpaceId = sanitizeSpaceId(profile?.spaceId, "tec-hq");
      const space = store.getSpace(currentSpaceId);
      const channel = ALLOWED_CHANNELS.has(profile?.channel) ? profile.channel : "team";
      const user = {
        id: socket.id,
        name: sanitizeName(profile?.name),
        color: typeof profile?.color === "string" ? profile.color.slice(0, 24) : "#7c5cff",
        avatar: sanitizeAvatar(profile?.avatar),
        x: clampCoord(profile?.x, 42),
        y: clampCoord(profile?.y, 50),
        channel,
        inVoice: false,
        muted: false
      };

      space.set(socket.id, user);
      socket.join(currentSpaceId);
      socket.emit("space:ready", {
        selfId: socket.id,
        users: Array.from(space.values()).map(publicUser),
        messages: store.getMessages(currentSpaceId)
      });
      socket.to(currentSpaceId).emit("presence:joined", publicUser(user));
    });

    socket.on("presence:update", (patch) => {
      if (!currentSpaceId || !patch || !allow("presence:update")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      if (!user) return;

      if (Number.isFinite(patch.x)) user.x = Math.max(0, Math.min(100, patch.x));
      if (Number.isFinite(patch.y)) user.y = Math.max(0, Math.min(100, patch.y));
      if (typeof patch.channel === "string" && ALLOWED_CHANNELS.has(patch.channel)) {
        user.channel = patch.channel;
      }
      if (typeof patch.inVoice === "boolean") user.inVoice = patch.inVoice;
      if (typeof patch.muted === "boolean") user.muted = patch.muted;
      if (typeof patch.avatar === "string") user.avatar = sanitizeAvatar(patch.avatar);
      if (typeof patch.name === "string") user.name = sanitizeName(patch.name, user.name);

      socket.to(currentSpaceId).emit("presence:updated", publicUser(user));
      socket.emit("presence:self", publicUser(user));
    });

    socket.on("chat:send", (payload) => {
      if (!currentSpaceId || !allow("chat:send")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      if (!user) return;

      const text = sanitizeText(payload?.text, 800);
      const channel = ALLOWED_CHANNELS.has(payload?.channel) ? payload.channel : user.channel;
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

      const messages = store.getMessages(currentSpaceId);
      messages.push(message);
      if (messages.length > MESSAGE_LIMIT) {
        messages.splice(0, messages.length - MESSAGE_LIMIT);
      }

      io.to(currentSpaceId).emit("chat:message", message);
    });

    socket.on("disconnect", () => {
      if (!currentSpaceId) return;

      const space = store.getSpace(currentSpaceId);
      const user = space.get(socket.id);
      space.delete(socket.id);
      socket.to(currentSpaceId).emit("presence:left", socket.id);

      if (space.size === 0) {
        store.deleteSpace(currentSpaceId);
      }

      if (user) {
        console.log(`${user.name} saiu de ${currentSpaceId}`);
      }
    });
  });
}

function clampCoord(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, value));
}
