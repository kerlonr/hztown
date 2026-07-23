// Post-its colaborativos no mapa (mural estilo Gather/Miro):
// - o botao do HUD abre um mini compositor (texto + cor);
// - "Colar no mapa" entra em modo de colagem: o proximo clique no mapa cola;
// - todos veem os post-its; so o autor pode remover o seu;
// - Esc cancela a colagem.

const COLORS = ["yellow", "pink", "green", "blue", "violet"];

let socketRef = null;
let els = null;
let placing = null; // { text, color } enquanto espera o clique no mapa
let statusBeforePlacing = ""; // texto do pill de status antes do modo de colagem
let selfIdRef = () => null;
const notes = new Map(); // id -> { note, el }

export function isPlacingNote() {
  return Boolean(placing);
}

export function noteCount() {
  return notes.size;
}

export function initStickyNotes({ socket, elements, getSelfId, onChange }) {
  socketRef = socket;
  els = elements;
  selfIdRef = getSelfId;

  buildComposer();

  els.noteButton.addEventListener("click", () => {
    els.noteComposer.classList.toggle("open");
    if (els.noteComposer.classList.contains("open")) {
      els.noteText.focus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && placing) {
      cancelPlacement();
    }
  });

  // Cola no ponto clicado (o movimento do avatar checa isPlacingNote e ignora o clique).
  els.floorPlan.addEventListener("pointerdown", (event) => {
    if (!placing) return;
    const rect = els.floorPlan.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    socketRef.emit("note:add", { ...placing, x, y });
    cancelPlacement();
  });

  socket.on("note:added", (note) => {
    addNote(note);
    onChange?.();
  });

  socket.on("note:removed", (id) => {
    removeNote(id);
    onChange?.();
  });

  socket.on("note:moved", ({ id, x, y }) => {
    const entry = notes.get(id);
    if (!entry) return;
    entry.note.x = x;
    entry.note.y = y;
    entry.el.style.left = `${x}%`;
    entry.el.style.top = `${y}%`;
  });

  socket.on("space:ready", ({ notes: initial = [] }) => {
    clearNotes();
    for (const note of initial) addNote(note);
    onChange?.();
  });
}

function buildComposer() {
  let selectedColor = COLORS[0];

  COLORS.forEach((color, index) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = `note-swatch note-${color} ${index === 0 ? "active" : ""}`;
    swatch.setAttribute("aria-label", `Cor ${color}`);
    swatch.addEventListener("click", () => {
      selectedColor = color;
      els.noteSwatches.querySelectorAll(".note-swatch").forEach((other) => {
        other.classList.toggle("active", other === swatch);
      });
    });
    els.noteSwatches.append(swatch);
  });

  els.notePlace.addEventListener("click", () => {
    const text = els.noteText.value.trim();
    if (!text) {
      els.noteText.focus();
      return;
    }
    placing = { text: text.slice(0, 160), color: selectedColor };
    els.noteComposer.classList.remove("open");
    els.noteText.value = "";
    els.floorPlan.classList.add("placing-note");
    els.noteButton.classList.add("active");
    statusBeforePlacing = els.connectionStatus.textContent;
    els.connectionStatus.textContent = "Clique no mapa para colar o post-it (Esc cancela)";
  });

  els.noteCancel.addEventListener("click", () => {
    els.noteComposer.classList.remove("open");
  });
}

function cancelPlacement() {
  placing = null;
  els.floorPlan.classList.remove("placing-note");
  els.noteButton.classList.remove("active");
  els.connectionStatus.textContent = statusBeforePlacing || "LiveKit pronto";
}

function addNote(note) {
  if (notes.has(note.id)) return;

  const el = document.createElement("article");
  el.className = `sticky-note note-${COLORS.includes(note.color) ? note.color : "yellow"}`;
  el.style.left = `${note.x}%`;
  el.style.top = `${note.y}%`;
  // leve rotacao pseudo-aleatoria (estavel por id) para parecer mural de verdade
  const spin = (hashCode(note.id) % 7) - 3;
  el.style.setProperty("--spin", `${spin}deg`);

  const text = document.createElement("p");
  text.textContent = note.text;

  const author = document.createElement("small");
  author.textContent = note.name;

  el.append(text, author);

  if (note.userId === selfIdRef()) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "note-remove";
    remove.textContent = "×";
    remove.title = "Remover post-it";
    remove.setAttribute("aria-label", "Remover post-it");
    remove.addEventListener("click", () => socketRef.emit("note:remove", { id: note.id }));
    el.append(remove);
  }

  // clicar no post-it nao move o avatar; o autor pode arrasta-lo pelo mapa
  el.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (note.userId !== selfIdRef()) return;
    if (event.target.closest("button")) return;
    startNoteDrag(event, note, el);
  });

  els.notesLayer.append(el);
  notes.set(note.id, { note, el });
}

function startNoteDrag(event, note, el) {
  event.preventDefault();
  el.setPointerCapture(event.pointerId);
  el.classList.add("dragging");
  let moved = false;

  const toPercent = (ev) => {
    const rect = els.floorPlan.getBoundingClientRect();
    return {
      x: Math.max(2, Math.min(98, ((ev.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(2, Math.min(98, ((ev.clientY - rect.top) / rect.height) * 100))
    };
  };

  const onMove = (ev) => {
    moved = true;
    const pos = toPercent(ev);
    note.x = pos.x;
    note.y = pos.y;
    el.style.left = `${pos.x}%`;
    el.style.top = `${pos.y}%`;
  };

  const onUp = () => {
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.classList.remove("dragging");
    if (moved) socketRef.emit("note:move", { id: note.id, x: note.x, y: note.y });
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
}

function removeNote(id) {
  const entry = notes.get(id);
  if (!entry) return;
  entry.el.classList.add("leaving");
  window.setTimeout(() => entry.el.remove(), 180);
  notes.delete(id);
}

function clearNotes() {
  for (const { el } of notes.values()) el.remove();
  notes.clear();
}

function hashCode(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}
