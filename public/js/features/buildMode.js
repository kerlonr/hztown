// Modo Construir: cada um monta o proprio ambiente colocando moveis no mapa
// (mesa propria, sofa, planta, estante, arcade...). Sincronizado para todos.
// - botao "Construir" liga o modo: aparece a paleta de moveis;
// - com um movel selecionado, clique no mapa coloca;
// - seus moveis ganham alcas: arraste para mover, x para remover;
// - quem cria e o unico que move/remove (regra tambem no servidor);
// - a mesa colocada mostra plaquinha "Mesa de <voce>".

import { PROP_SIZES, paintProps } from "../ui/mapScene.js";

export const PROP_PALETTE = [
  { kind: "desk", label: "Minha mesa", emoji: "🖥️" },
  { kind: "sofa", label: "Sofa", emoji: "🛋️" },
  { kind: "plant", label: "Planta", emoji: "🪴" },
  { kind: "rug", label: "Tapete", emoji: "🟠" },
  { kind: "bookshelf", label: "Estante", emoji: "📚" },
  { kind: "arcade", label: "Arcade", emoji: "🕹️" },
  { kind: "cafe-table", label: "Mesinha", emoji: "☕" },
  { kind: "pingpong", label: "Ping-pong", emoji: "🏓" }
];

let socketRef = null;
let els = null;
let getName = () => "";
let onChange = null;
let building = false;
let selectedKind = "desk";
const props = new Map(); // id -> prop

export function isBuilding() {
  return building;
}

export function propCount() {
  return props.size;
}

export function initBuildMode({ socket, elements, getSelfName, onPropsChange }) {
  socketRef = socket;
  els = elements;
  getName = getSelfName;
  onChange = onPropsChange;

  buildPalette();

  els.buildButton.addEventListener("click", () => setBuilding(!building));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && building) setBuilding(false);
  });

  // colocar movel: clique no mapa com o modo ativo
  els.floorPlan.addEventListener("pointerdown", (event) => {
    if (!building || event.button !== 0) return;
    if (event.target.closest(".prop-handle")) return;
    const rect = els.floorPlan.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    socketRef.emit("prop:add", {
      kind: selectedKind,
      x: Math.max(3, Math.min(97, x)),
      y: Math.max(3, Math.min(97, y))
    });
  });

  socket.on("space:ready", ({ props: initial = [] }) => {
    props.clear();
    for (const prop of initial) props.set(prop.id, prop);
    renderProps();
  });

  socket.on("prop:added", (prop) => {
    props.set(prop.id, prop);
    renderProps();
  });

  socket.on("prop:moved", ({ id, x, y }) => {
    const prop = props.get(id);
    if (!prop) return;
    prop.x = x;
    prop.y = y;
    renderProps();
  });

  socket.on("prop:removed", (id) => {
    props.delete(id);
    renderProps();
  });
}

function setBuilding(active) {
  building = active;
  els.buildButton.classList.toggle("active", active);
  els.buildPalette.classList.toggle("open", active);
  els.floorPlan.classList.toggle("building", active);
  renderHandles();
}

function buildPalette() {
  for (const item of PROP_PALETTE) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `palette-item ${item.kind === selectedKind ? "active" : ""}`;
    button.dataset.kind = item.kind;
    button.innerHTML = "";

    const emoji = document.createElement("span");
    emoji.className = "palette-emoji";
    emoji.textContent = item.emoji;
    const label = document.createElement("small");
    label.textContent = item.label;
    button.append(emoji, label);

    button.addEventListener("click", () => {
      selectedKind = item.kind;
      els.buildPalette.querySelectorAll(".palette-item").forEach((other) => {
        other.classList.toggle("active", other === button);
      });
    });
    els.buildPalette.append(button);
  }
}

// ----- renderizacao -----
export function renderProps() {
  if (!els) return;
  paintProps(els.propsCanvas, Array.from(props.values()));
  renderMarkers();
  renderHandles();
  onChange?.();
}

// Plaquinha "Mesa de X" nas mesas colocadas pelos usuarios.
function renderMarkers() {
  els.propMarkers.innerHTML = "";
  for (const prop of props.values()) {
    if (prop.kind !== "desk") continue;
    const size = PROP_SIZES.desk;
    const marker = document.createElement("span");
    marker.className = "desk-marker prop-desk-marker";
    marker.textContent = `Mesa de ${String(prop.owner).split(/\s+/)[0]}`;
    marker.style.left = `${prop.x}%`;
    marker.style.top = `${prop.y - size.h / 2}%`;
    els.propMarkers.append(marker);
  }
}

// Alcas de edicao (so no modo construir e so nos seus moveis).
function renderHandles() {
  els.propHandles.innerHTML = "";
  if (!building) return;

  const myName = getName();
  for (const prop of props.values()) {
    if (prop.owner !== myName) continue;
    const size = PROP_SIZES[prop.kind] || { w: 6, h: 6 };

    const handle = document.createElement("div");
    handle.className = "prop-handle";
    handle.style.left = `${prop.x - size.w / 2}%`;
    handle.style.top = `${prop.y - size.h / 2}%`;
    handle.style.width = `${size.w}%`;
    handle.style.height = `${size.h}%`;
    handle.title = "Arraste para mover";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "prop-remove";
    remove.textContent = "×";
    remove.title = "Remover movel";
    remove.addEventListener("click", (event) => {
      event.stopPropagation();
      socketRef.emit("prop:remove", { id: prop.id });
    });
    handle.append(remove);

    handle.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      if (event.target.closest("button")) return;
      startPropDrag(event, prop, handle, size);
    });

    els.propHandles.append(handle);
  }
}

function startPropDrag(event, prop, handle, size) {
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  handle.classList.add("dragging");
  let moved = false;

  const onMove = (ev) => {
    moved = true;
    const rect = els.floorPlan.getBoundingClientRect();
    prop.x = Math.max(3, Math.min(97, ((ev.clientX - rect.left) / rect.width) * 100));
    prop.y = Math.max(3, Math.min(97, ((ev.clientY - rect.top) / rect.height) * 100));
    handle.style.left = `${prop.x - size.w / 2}%`;
    handle.style.top = `${prop.y - size.h / 2}%`;
    paintProps(els.propsCanvas, Array.from(props.values()));
  };

  const onUp = () => {
    handle.removeEventListener("pointermove", onMove);
    handle.removeEventListener("pointerup", onUp);
    handle.removeEventListener("pointercancel", onUp);
    handle.classList.remove("dragging");
    if (moved) {
      socketRef.emit("prop:move", { id: prop.id, x: prop.x, y: prop.y });
      renderProps();
    }
  };

  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);
}
