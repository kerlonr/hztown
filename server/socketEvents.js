import { randomUUID } from "crypto";
import { sanitizeAvatar } from "./sanitizers.js";
import { publicUser } from "./spaceStore.js";

const MESSAGE_LIMIT = 120;

export function registerSocketHandlers(io, store) {
  io.on("connection", (socket) => {
    let currentSpaceId = null;

    socket.on("space:join", (profile) => {
      currentSpaceId = profile.spaceId || "projeto-gt";
      const space = store.getSpace(currentSpaceId);
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
        messages: store.getMessages(currentSpaceId)
      });
      socket.to(currentSpaceId).emit("presence:joined", publicUser(user));
    });

    socket.on("presence:update", (patch) => {
      if (!currentSpaceId) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
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

      const user = store.getSpace(currentSpaceId).get(socket.id);
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

      const messages = store.getMessages(currentSpaceId);
      messages.push(message);
      if (messages.length > MESSAGE_LIMIT) {
        messages.splice(0, messages.length - MESSAGE_LIMIT);
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
