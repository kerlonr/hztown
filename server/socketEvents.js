import { randomUUID } from "crypto";
import { sanitizeAvatar, sanitizeName, sanitizeSpaceId, sanitizeText } from "./sanitizers.js";
import { publicUser } from "./spaceStore.js";

const MESSAGE_LIMIT = 120;
const NOTE_LIMIT = 60; // post-its por espaco; acima disso o mais antigo sai
const EVENT_LIMIT = 200; // eventos de agenda por espaco
const DESK_NOTE_LIMIT = 20; // recados por mesa
// Uniao das salas de todos os tamanhos de escritorio (ver public/js/core/mapGeometry.js).
const ALLOWED_CHANNELS = new Set(["lounge", "team", "daily", "focus", "meet", "dev", "design", "war"]);
const ALLOWED_REACTIONS = new Set(["👋", "❤️", "😂", "🎉", "👍", "🔥"]);
const ALLOWED_NOTE_COLORS = new Set(["yellow", "pink", "green", "blue", "violet"]);
const ALLOWED_DESK_DECORS = new Set(["", "🌵", "☕", "📚", "🏆", "🎧", "🐈"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// Limites simples por socket para conter flood de eventos.
const RATE_LIMITS = {
  "presence:update": { tokens: 30, intervalMs: 1000 },
  "chat:send": { tokens: 5, intervalMs: 3000 },
  "reaction:send": { tokens: 8, intervalMs: 2000 },
  "note:add": { tokens: 4, intervalMs: 5000 },
  "note:remove": { tokens: 10, intervalMs: 5000 },
  "event:add": { tokens: 5, intervalMs: 10000 },
  "event:remove": { tokens: 10, intervalMs: 10000 },
  "desk:update": { tokens: 10, intervalMs: 5000 },
  "desk:note": { tokens: 5, intervalMs: 10000 },
  "room:lock": { tokens: 5, intervalMs: 5000 }
};

// Identificador curto de mesa (ex.: "team-a") vindo do cliente.
function sanitizeDeskId(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24);
}

function publicDesk(desk) {
  return { deskId: desk.deskId, owner: desk.owner, decor: desk.decor, notes: desk.notes };
}

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
      currentSpaceId = sanitizeSpaceId(profile?.spaceId, "hz-medium");
      const space = store.getSpace(currentSpaceId);
      const channel = ALLOWED_CHANNELS.has(profile?.channel) ? profile.channel : "lounge";
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
        messages: store.getMessages(currentSpaceId),
        notes: store.getNotes(currentSpaceId),
        events: store.getEvents(currentSpaceId),
        desks: Array.from(store.getDesks(currentSpaceId).values()).map(publicDesk),
        roomLocks: Array.from(store.getRoomLocks(currentSpaceId).values())
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

    // Post-its do mural: qualquer um cola, so o autor remove.
    socket.on("note:add", (payload) => {
      if (!currentSpaceId || !allow("note:add")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      if (!user) return;

      const text = sanitizeText(payload?.text, 160);
      if (!text) return;

      const note = {
        id: randomUUID(),
        userId: socket.id,
        name: user.name,
        color: ALLOWED_NOTE_COLORS.has(payload?.color) ? payload.color : "yellow",
        x: clampCoord(payload?.x, 50),
        y: clampCoord(payload?.y, 50),
        text,
        createdAt: Date.now()
      };

      const notes = store.getNotes(currentSpaceId);
      notes.push(note);
      // mural rotativo: estourou o limite, o mais antigo sai
      while (notes.length > NOTE_LIMIT) {
        const removed = notes.shift();
        io.to(currentSpaceId).emit("note:removed", removed.id);
      }

      io.to(currentSpaceId).emit("note:added", note);
    });

    socket.on("note:remove", (payload) => {
      if (!currentSpaceId || !allow("note:remove")) return;

      const notes = store.getNotes(currentSpaceId);
      const index = notes.findIndex((note) => note.id === payload?.id);
      if (index === -1 || notes[index].userId !== socket.id) return;

      notes.splice(index, 1);
      io.to(currentSpaceId).emit("note:removed", payload.id);
    });

    // --- Agenda compartilhada do espaco ---
    socket.on("event:add", (payload) => {
      if (!currentSpaceId || !allow("event:add")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const title = sanitizeText(payload?.title, 80);
      const date = String(payload?.date || "");
      const time = String(payload?.time || "");
      if (!user || !title || !DATE_RE.test(date)) return;

      const events = store.getEvents(currentSpaceId);
      if (events.length >= EVENT_LIMIT) return;

      const event = {
        id: randomUUID(),
        userId: socket.id,
        name: user.name,
        date,
        time: TIME_RE.test(time) ? time : "",
        title,
        createdAt: Date.now()
      };
      events.push(event);
      io.to(currentSpaceId).emit("event:added", event);
    });

    socket.on("event:remove", (payload) => {
      if (!currentSpaceId || !allow("event:remove")) return;

      const events = store.getEvents(currentSpaceId);
      const index = events.findIndex((event) => event.id === payload?.id);
      if (index === -1 || events[index].userId !== socket.id) return;

      events.splice(index, 1);
      io.to(currentSpaceId).emit("event:removed", payload.id);
    });

    // --- Mesas: reivindicar, liberar, decorar e deixar recados ---
    // Regra: mesa livre pode ser reivindicada; so o dono atual (pelo nome)
    // pode liberar, decorar ou limpar recados.
    socket.on("desk:update", (payload) => {
      if (!currentSpaceId || !allow("desk:update")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const deskId = sanitizeDeskId(payload?.deskId);
      if (!user || !deskId) return;

      const desks = store.getDesks(currentSpaceId);
      const desk = desks.get(deskId) || { deskId, owner: "", decor: "", notes: [] };
      const isOwner = desk.owner && desk.owner === user.name;
      const action = payload?.action;

      if (action === "claim" && (!desk.owner || isOwner)) {
        desk.owner = user.name;
      } else if (action === "release" && isOwner) {
        desk.owner = "";
        desk.decor = "";
        desk.notes = [];
      } else if (action === "decor" && isOwner && ALLOWED_DESK_DECORS.has(payload?.decor)) {
        desk.decor = payload.decor;
      } else {
        return;
      }

      desks.set(deskId, desk);
      io.to(currentSpaceId).emit("desk:updated", publicDesk(desk));
    });

    socket.on("desk:note", (payload) => {
      if (!currentSpaceId || !allow("desk:note")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const deskId = sanitizeDeskId(payload?.deskId);
      const text = sanitizeText(payload?.text, 140);
      if (!user || !deskId || !text) return;

      const desks = store.getDesks(currentSpaceId);
      const desk = desks.get(deskId);
      if (!desk || !desk.owner) return; // recado so em mesa com dono

      desk.notes.push({ id: randomUUID(), from: user.name, text, at: Date.now() });
      if (desk.notes.length > DESK_NOTE_LIMIT) {
        desk.notes.splice(0, desk.notes.length - DESK_NOTE_LIMIT);
      }
      io.to(currentSpaceId).emit("desk:updated", publicDesk(desk));
    });

    socket.on("desk:note:remove", (payload) => {
      if (!currentSpaceId || !allow("desk:update")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const desk = store.getDesks(currentSpaceId).get(sanitizeDeskId(payload?.deskId));
      if (!user || !desk) return;

      const index = desk.notes.findIndex((note) => note.id === payload?.id);
      if (index === -1) return;
      const note = desk.notes[index];
      // quem escreveu ou o dono da mesa pode apagar o recado
      if (note.from !== user.name && desk.owner !== user.name) return;

      desk.notes.splice(index, 1);
      io.to(currentSpaceId).emit("desk:updated", publicDesk(desk));
    });

    // --- Salas privadas (trancadas) ---
    socket.on("room:lock", (payload) => {
      if (!currentSpaceId || !allow("room:lock")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const roomId = String(payload?.roomId || "");
      if (!user || !ALLOWED_CHANNELS.has(roomId) || roomId === "lounge") return;

      const locks = store.getRoomLocks(currentSpaceId);
      const current = locks.get(roomId);
      const wantLock = Boolean(payload?.locked);

      // qualquer um tranca uma sala aberta; so quem trancou destranca
      if (wantLock && !current?.locked) {
        locks.set(roomId, { roomId, locked: true, by: user.name });
      } else if (!wantLock && current?.locked && current.by === user.name) {
        locks.set(roomId, { roomId, locked: false, by: "" });
      } else {
        return;
      }

      io.to(currentSpaceId).emit("room:updated", locks.get(roomId));
    });

    socket.on("reaction:send", (payload) => {
      if (!currentSpaceId || !allow("reaction:send")) return;

      const user = store.getSpace(currentSpaceId).get(socket.id);
      const emoji = typeof payload?.emoji === "string" ? payload.emoji : "";
      if (!user || !ALLOWED_REACTIONS.has(emoji)) return;

      io.to(currentSpaceId).emit("reaction:new", { userId: socket.id, emoji });
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
