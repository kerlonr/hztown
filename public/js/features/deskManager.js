// Mesas e salas estilo Gather Town, via clique direito no mapa:
// - clique direito numa MESA: reivindicar como sua, decorar, deixar recado
//   para o dono, liberar;
// - clique direito numa SALA: tornar privada (trancada) ou publica.
// Estado sincronizado pelo servidor (desk:updated / room:updated).
// Mesas com dono ganham uma plaquinha no mapa com decoracao e recados.

import { activeMap, roomFromPosition } from "../core/mapGeometry.js";

export const DESK_DECORS = ["🌵", "☕", "📚", "🏆", "🎧", "🐈"];

let socketRef = null;
let els = null;
let getName = () => "";
let onRoomsChanged = null;
const desks = new Map(); // deskId -> { deskId, owner, decor, notes }
const roomLocks = new Map(); // roomId -> { locked, by }
let popoverDeskId = null;

export function isRoomLocked(roomId) {
  return Boolean(roomLocks.get(roomId)?.locked);
}

export function roomLockOwner(roomId) {
  return roomLocks.get(roomId)?.by || "";
}

export function deskInfo(deskId) {
  return desks.get(deskId) || null;
}

// Mesa (com id) do mapa ativo naquela posicao em %, ou null.
export function deskAt(x, y) {
  for (const item of activeMap().furniture) {
    if (item.type !== "desk" || !item.id) continue;
    if (x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h) {
      return item;
    }
  }
  return null;
}

export function initDeskManager({ socket, elements, getSelfName, onRoomLocksChanged }) {
  socketRef = socket;
  els = elements;
  getName = getSelfName;
  onRoomsChanged = onRoomLocksChanged;

  // clique direito no mapa abre o menu contextual (mesa ou sala)
  els.floorPlan.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    const rect = els.floorPlan.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    const desk = deskAt(x, y);
    if (desk) {
      openDeskPopover(desk, event.clientX, event.clientY);
      return;
    }
    const roomId = roomFromPosition(x, y);
    if (roomId) {
      openRoomPopover(roomId, event.clientX, event.clientY);
      return;
    }
    closePopover();
  });

  document.addEventListener("pointerdown", (event) => {
    if (!els.mapPopover.contains(event.target)) closePopover();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();
  });

  socket.on("space:ready", ({ desks: initial = [], roomLocks: locks = [] }) => {
    desks.clear();
    for (const desk of initial) desks.set(desk.deskId, desk);
    roomLocks.clear();
    for (const lock of locks) roomLocks.set(lock.roomId, lock);
    renderDeskMarkers();
    onRoomsChanged?.();
  });

  socket.on("desk:updated", (desk) => {
    desks.set(desk.deskId, desk);
    renderDeskMarkers();
    if (popoverDeskId === desk.deskId) {
      const item = findDeskItem(desk.deskId);
      if (item) fillDeskPopover(item); // atualiza o popover aberto
    }
  });

  socket.on("room:updated", (lock) => {
    roomLocks.set(lock.roomId, lock);
    onRoomsChanged?.();
  });
}

function findDeskItem(deskId) {
  return activeMap().furniture.find((item) => item.type === "desk" && item.id === deskId) || null;
}

// ----- plaquinhas das mesas no mapa -----
export function renderDeskMarkers() {
  if (!els) return;
  els.deskMarkers.innerHTML = "";
  for (const item of activeMap().furniture) {
    if (item.type !== "desk" || !item.id) continue;
    const desk = desks.get(item.id);
    if (!desk?.owner) continue;

    const marker = document.createElement("div");
    marker.className = "desk-marker";
    marker.style.left = `${item.x + item.w / 2}%`;
    marker.style.top = `${item.y}%`;

    const label = document.createElement("span");
    label.textContent = `${desk.decor ? `${desk.decor} ` : ""}${firstName(desk.owner)}`;
    marker.append(label);

    if (desk.notes.length > 0) {
      const badge = document.createElement("span");
      badge.className = "desk-badge";
      badge.textContent = String(desk.notes.length);
      badge.title = `${desk.notes.length} recado(s)`;
      marker.append(badge);
    }

    marker.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      openDeskPopover(item, event.clientX, event.clientY);
    });

    els.deskMarkers.append(marker);
  }
}

function firstName(name) {
  return String(name).split(/\s+/)[0];
}

// ----- popover de mesa -----
function openDeskPopover(item, clientX, clientY) {
  popoverDeskId = item.id;
  fillDeskPopover(item);
  positionPopover(clientX, clientY);
}

function fillDeskPopover(item) {
  const desk = desks.get(item.id) || { owner: "", decor: "", notes: [] };
  const myName = getName();
  const isOwner = desk.owner && desk.owner === myName;
  const pop = els.mapPopover;
  pop.innerHTML = "";

  const title = document.createElement("strong");
  title.className = "pop-title";
  title.textContent = item.label || "Mesa";
  pop.append(title);

  const status = document.createElement("small");
  status.className = "pop-status";
  status.textContent = desk.owner
    ? isOwner
      ? "Sua mesa"
      : `Mesa de ${desk.owner}`
    : "Mesa livre";
  pop.append(status);

  // acoes de posse
  const actions = document.createElement("div");
  actions.className = "pop-actions";
  if (!desk.owner) {
    actions.append(
      popButton("Tornar minha mesa", () =>
        socketRef.emit("desk:update", { deskId: item.id, action: "claim" })
      )
    );
  } else if (isOwner) {
    actions.append(
      popButton("Liberar mesa", () =>
        socketRef.emit("desk:update", { deskId: item.id, action: "release" })
      )
    );
  }
  if (actions.childElementCount > 0) pop.append(actions);

  // decoracao (so o dono customiza a propria mesa)
  if (isOwner) {
    const decorLabel = document.createElement("small");
    decorLabel.className = "pop-label";
    decorLabel.textContent = "Decorar mesa";
    pop.append(decorLabel);

    const decorRow = document.createElement("div");
    decorRow.className = "pop-decors";
    for (const decor of DESK_DECORS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `pop-decor ${desk.decor === decor ? "active" : ""}`;
      button.textContent = decor;
      button.addEventListener("click", () =>
        socketRef.emit("desk:update", {
          deskId: item.id,
          action: "decor",
          decor: desk.decor === decor ? "" : decor
        })
      );
      decorRow.append(button);
    }
    pop.append(decorRow);
  }

  // recados
  if (desk.owner) {
    const notesLabel = document.createElement("small");
    notesLabel.className = "pop-label";
    notesLabel.textContent = `Recados (${desk.notes.length})`;
    pop.append(notesLabel);

    if (desk.notes.length > 0) {
      const list = document.createElement("div");
      list.className = "pop-notes";
      for (const note of desk.notes) {
        const row = document.createElement("div");
        row.className = "pop-note";

        const body = document.createElement("div");
        const text = document.createElement("p");
        text.textContent = note.text;
        const from = document.createElement("small");
        from.textContent = note.from;
        body.append(text, from);
        row.append(body);

        if (note.from === myName || isOwner) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "note-remove";
          remove.textContent = "×";
          remove.title = "Apagar recado";
          remove.addEventListener("click", () =>
            socketRef.emit("desk:note:remove", { deskId: item.id, id: note.id })
          );
          row.append(remove);
        }
        list.append(row);
      }
      pop.append(list);
    }

    // deixar recado (para mesa dos outros ou ate para a propria)
    const form = document.createElement("form");
    form.className = "pop-form";
    const input = document.createElement("input");
    input.maxLength = 140;
    input.placeholder = isOwner ? "Lembrete para voce..." : `Recado para ${firstName(desk.owner)}...`;
    const send = document.createElement("button");
    send.type = "submit";
    send.className = "primary-button";
    send.textContent = "Deixar";
    form.append(input, send);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      socketRef.emit("desk:note", { deskId: item.id, text });
      input.value = "";
    });
    pop.append(form);
  }
}

// ----- popover de sala (privada/publica) -----
function openRoomPopover(roomId, clientX, clientY) {
  popoverDeskId = null;
  const room = activeMap().rooms.find((r) => r.id === roomId);
  if (!room) return;

  const lock = roomLocks.get(roomId);
  const locked = Boolean(lock?.locked);
  const myName = getName();
  const pop = els.mapPopover;
  pop.innerHTML = "";

  const title = document.createElement("strong");
  title.className = "pop-title";
  title.textContent = `Sala ${room.label}`;
  pop.append(title);

  const status = document.createElement("small");
  status.className = "pop-status";
  status.textContent = locked ? `🔒 Privada (por ${lock.by})` : "🌐 Publica";
  pop.append(status);

  const actions = document.createElement("div");
  actions.className = "pop-actions";
  if (!locked) {
    actions.append(
      popButton("Tornar privada 🔒", () =>
        socketRef.emit("room:lock", { roomId, locked: true })
      )
    );
  } else if (lock.by === myName) {
    actions.append(
      popButton("Tornar publica 🌐", () =>
        socketRef.emit("room:lock", { roomId, locked: false })
      )
    );
  } else {
    const hint = document.createElement("small");
    hint.className = "pop-status";
    hint.textContent = `So ${lock.by} pode destrancar.`;
    actions.append(hint);
  }
  pop.append(actions);

  positionPopover(clientX, clientY);
}

// ----- infra do popover -----
function popButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function positionPopover(clientX, clientY) {
  const pop = els.mapPopover;
  pop.classList.add("open");
  const width = 250;
  const left = Math.min(clientX, window.innerWidth - width - 12);
  const top = Math.min(clientY, window.innerHeight - 260);
  pop.style.left = `${Math.max(8, left)}px`;
  pop.style.top = `${Math.max(8, top)}px`;
}

export function closePopover() {
  popoverDeskId = null;
  els.mapPopover.classList.remove("open");
}
