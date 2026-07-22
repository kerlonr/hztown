// Catalogo de escritorios (pequeno / medio / grande) e fonte unica da
// geometria de cada um, em % do mapa (x e y de 0 a 100).
// - mapScene.js desenha piso, paredes e moveis a partir daqui;
// - sceneFx.js anima detalhes (LEDs, vapor de cafe, telas);
// - o movimento (app.js) usa isBlocked() para colisao.
// Visual e fisica nunca saem de sincronia porque leem os mesmos dados.

export const BOUNDS = { x1: 8, y1: 12, x2: 92, y2: 88 };

// Paletas de carpete por sala: [base, claro, escuro] + cor do rotulo.
const CARPETS = {
  indigo: { colors: ["#2f3560", "#3a4173", "#262b4e"], tint: "#b4bcff" },
  green: { colors: ["#24473e", "#2d574c", "#1d3a33"], tint: "#8ff0cd" },
  rose: { colors: ["#462c3d", "#54374a", "#382332"], tint: "#ffb3c4" },
  violet: { colors: ["#3a2c52", "#473764", "#2d2240"], tint: "#d4bfff" },
  amber: { colors: ["#4a3a22", "#5a482c", "#3a2d19"], tint: "#ffe08f" }
};

// ---------------------------------------------------------------------------
// PEQUENO — "Startup Studio": um loft aberto com sala de reuniao e cabine de foco.
// ---------------------------------------------------------------------------
const SMALL = {
  id: "small",
  label: "Startup",
  tagline: "Loft aberto · 2 salas",
  spaceId: "hz-small",
  livekitRoom: "hz-small-space",
  spawn: { x: 36, y: 30 },
  lounge: { id: "lounge", label: "Lounge", tint: "#ffe08f", labelAt: { x: 13, y: 58 }, target: { x: 25, y: 70 } },
  rooms: [
    { id: "meet", label: "Meet", rect: { x1: 58, y1: 20, x2: 88, y2: 46 }, target: { x: 64, y: 33 }, carpet: CARPETS.indigo },
    { id: "focus", label: "Foco", rect: { x1: 58, y1: 52, x2: 88, y2: 80 }, target: { x: 66, y: 66 }, carpet: CARPETS.violet }
  ],
  walls: [
    { axis: "h", y: 20, x1: 58, x2: 88 },
    { axis: "h", y: 46, x1: 58, x2: 88 },
    { axis: "v", x: 58, y1: 20, y2: 28.5 },
    { axis: "v", x: 58, y1: 37.5, y2: 46 },
    { axis: "v", x: 88, y1: 20, y2: 46 },
    { axis: "h", y: 52, x1: 58, x2: 88 },
    { axis: "h", y: 80, x1: 58, x2: 88 },
    { axis: "v", x: 58, y1: 52, y2: 61.5 },
    { axis: "v", x: 58, y1: 70.5, y2: 80 },
    { axis: "v", x: 88, y1: 52, y2: 80 }
  ],
  furniture: [
    { type: "window", x: 14, w: 9 },
    { type: "neon", x: 44, w: 9 },
    { type: "window", x: 72, w: 9 },
    { type: "kitchen", x: 13, y: 14, w: 13, h: 5, solid: true },
    { type: "whiteboard", x: 30, y: 13.4, w: 9, h: 3.4 },
    { type: "server-rack", x: 41, y: 14, w: 4, h: 8, solid: true },
    { type: "desk", x: 14, y: 28, w: 16, h: 6.5, monitors: 4, solid: true },
    { type: "desk", x: 14, y: 40, w: 16, h: 6.5, monitors: 4, solid: true },
    { type: "table", cx: 76, cy: 33, rx: 4, solid: true },
    { type: "desk", x: 78, y: 56, w: 6, h: 6, monitors: 1, solid: true },
    { type: "desk", x: 78, y: 68, w: 6, h: 6, monitors: 1, solid: true },
    { type: "rug-round", cx: 22, cy: 70, rx: 6.5 },
    { type: "sofa-h", x: 14, y: 62, w: 12, h: 5, solid: true },
    { type: "coffee", x: 18, y: 69.5, w: 4, h: 4, solid: true },
    { type: "arcade", x: 44, y: 72, w: 4, h: 6, solid: true },
    { type: "plant", x: 9, y: 48 },
    { type: "plant", x: 52, y: 14 },
    { type: "plant", x: 90, y: 85 },
    { type: "plant", x: 35, y: 84 },
    { type: "mat", x: 47, y: 87, w: 5, h: 2.5 }
  ]
};

// ---------------------------------------------------------------------------
// MEDIO — "Tech Office": tres salas + lounge (layout classico do HZTown).
// ---------------------------------------------------------------------------
const MEDIUM = {
  id: "medium",
  label: "Tech Office",
  tagline: "3 salas + lounge",
  spaceId: "hz-medium",
  livekitRoom: "hz-medium-space",
  spawn: { x: 30, y: 43 },
  lounge: { id: "lounge", label: "Lounge", tint: "#ffe08f", labelAt: { x: 13, y: 67 }, target: { x: 37, y: 80 } },
  rooms: [
    { id: "team", label: "Team", rect: { x1: 12, y1: 20, x2: 53, y2: 64 }, target: { x: 30, y: 43 }, carpet: CARPETS.indigo },
    { id: "daily", label: "Daily", rect: { x1: 53, y1: 20, x2: 88, y2: 64 }, target: { x: 70, y: 56 }, carpet: CARPETS.green },
    { id: "focus", label: "Focus", rect: { x1: 53, y1: 66, x2: 88, y2: 92 }, target: { x: 70, y: 78 }, carpet: CARPETS.rose }
  ],
  walls: [
    { axis: "h", y: 20, x1: 12, x2: 88 },
    { axis: "v", x: 12, y1: 20, y2: 64 },
    { axis: "v", x: 88, y1: 20, y2: 64 },
    { axis: "v", x: 88, y1: 66, y2: 88 },
    { axis: "v", x: 53, y1: 20, y2: 37.5 },
    { axis: "v", x: 53, y1: 46.5, y2: 64 },
    { axis: "h", y: 64, x1: 12, x2: 29 },
    { axis: "h", y: 64, x1: 36, x2: 53 },
    { axis: "h", y: 64, x1: 53, x2: 67 },
    { axis: "h", y: 64, x1: 74, x2: 88 },
    { axis: "h", y: 66, x1: 53, x2: 67 },
    { axis: "h", y: 66, x1: 74, x2: 88 },
    { axis: "v", x: 53, y1: 66, y2: 71.5 },
    { axis: "v", x: 53, y1: 82.5, y2: 88 }
  ],
  furniture: [
    { type: "window", x: 20, w: 8 },
    { type: "neon", x: 44, w: 9 },
    { type: "window", x: 64, w: 8 },
    { type: "desk", x: 22, y: 32, w: 13.7, h: 6.9, monitors: 3, solid: true },
    { type: "desk", x: 22, y: 48, w: 13.7, h: 6.9, monitors: 3, solid: true },
    { type: "table", cx: 70, cy: 41, rx: 5.1, solid: true },
    { type: "desk", x: 60, y: 74, w: 6.6, h: 6.3, monitors: 1, solid: true },
    { type: "desk", x: 76, y: 74, w: 6.6, h: 6.3, monitors: 1, solid: true },
    { type: "server-rack", x: 84.5, y: 68.5, w: 3, h: 9, solid: true },
    { type: "rug-round", cx: 31, cy: 78, rx: 6.6 },
    { type: "sofa-h", x: 15, y: 70, w: 12.5, h: 5, solid: true },
    { type: "sofa-v", x: 15, y: 75, w: 3.1, h: 13, solid: true },
    { type: "coffee", x: 28, y: 76, w: 4.3, h: 4.4, solid: true },
    { type: "bookshelf", x: 38, y: 67.5, w: 11.3, h: 5.6, solid: true },
    { type: "arcade", x: 44.5, y: 75, w: 3.8, h: 5.5, solid: true },
    { type: "plant", x: 9, y: 14 },
    { type: "plant", x: 90, y: 14 },
    { type: "plant", x: 9, y: 86 },
    { type: "plant", x: 50, y: 85 },
    { type: "plant", x: 56, y: 23 },
    { type: "mat", x: 48, y: 88, w: 4.3, h: 2.5 }
  ]
};

// ---------------------------------------------------------------------------
// GRANDE — "Tech Campus": quatro salas ao redor de um cafe central.
// ---------------------------------------------------------------------------
const LARGE = {
  id: "large",
  label: "Tech Campus",
  tagline: "4 salas + cafe central",
  spaceId: "hz-large",
  livekitRoom: "hz-large-space",
  spawn: { x: 50, y: 60 },
  lounge: { id: "lounge", label: "Cafe", tint: "#ffe08f", labelAt: { x: 44, y: 53 }, target: { x: 50, y: 58 } },
  rooms: [
    { id: "dev", label: "Dev", rect: { x1: 12, y1: 20, x2: 40, y2: 52 }, target: { x: 35.5, y: 35 }, carpet: CARPETS.indigo },
    { id: "design", label: "Design", rect: { x1: 12, y1: 56, x2: 40, y2: 84 }, target: { x: 33, y: 74 }, carpet: CARPETS.green },
    { id: "meet", label: "Meet", rect: { x1: 60, y1: 20, x2: 88, y2: 48 }, target: { x: 63.5, y: 34 }, carpet: CARPETS.rose },
    { id: "war", label: "War Room", rect: { x1: 60, y1: 52, x2: 88, y2: 84 }, target: { x: 63.5, y: 75 }, carpet: CARPETS.violet }
  ],
  walls: [
    // Dev (porta a direita)
    { axis: "h", y: 20, x1: 12, x2: 40 },
    { axis: "h", y: 52, x1: 12, x2: 40 },
    { axis: "v", x: 12, y1: 20, y2: 52 },
    { axis: "v", x: 40, y1: 20, y2: 31.5 },
    { axis: "v", x: 40, y1: 40.5, y2: 52 },
    // Design (porta a direita)
    { axis: "h", y: 56, x1: 12, x2: 40 },
    { axis: "h", y: 84, x1: 12, x2: 40 },
    { axis: "v", x: 12, y1: 56, y2: 84 },
    { axis: "v", x: 40, y1: 56, y2: 65.5 },
    { axis: "v", x: 40, y1: 74.5, y2: 84 },
    // Meet (porta a esquerda)
    { axis: "h", y: 20, x1: 60, x2: 88 },
    { axis: "h", y: 48, x1: 60, x2: 88 },
    { axis: "v", x: 88, y1: 20, y2: 48 },
    { axis: "v", x: 60, y1: 20, y2: 29.5 },
    { axis: "v", x: 60, y1: 38.5, y2: 48 },
    // War Room (porta a esquerda)
    { axis: "h", y: 52, x1: 60, x2: 88 },
    { axis: "h", y: 84, x1: 60, x2: 88 },
    { axis: "v", x: 88, y1: 52, y2: 84 },
    { axis: "v", x: 60, y1: 52, y2: 63.5 },
    { axis: "v", x: 60, y1: 72.5, y2: 84 }
  ],
  furniture: [
    { type: "window", x: 14, w: 10 },
    { type: "neon", x: 46, w: 8 },
    { type: "window", x: 76, w: 10 },
    // Dev
    { type: "desk", x: 15, y: 26, w: 16, h: 6, monitors: 4, solid: true },
    { type: "desk", x: 15, y: 38, w: 16, h: 6, monitors: 4, solid: true },
    { type: "plant", x: 14, y: 47 },
    // Design
    { type: "whiteboard", x: 20, y: 57.4, w: 10, h: 3.4 },
    { type: "desk", x: 16, y: 62, w: 8, h: 5.5, monitors: 2, solid: true },
    { type: "desk", x: 28, y: 62, w: 8, h: 5.5, monitors: 2, solid: true },
    { type: "plant", x: 14, y: 80 },
    // Meet
    { type: "whiteboard", x: 66, y: 21.4, w: 10, h: 3.4 },
    { type: "table", cx: 74, cy: 33, rx: 5, solid: true },
    // War Room
    { type: "screen-wall", x: 64, y: 53.2, w: 20, h: 3.6 },
    { type: "table-long", x: 66, y: 62, w: 16, h: 6, solid: true },
    { type: "plant", x: 85, y: 80 },
    // Cafe central
    { type: "kitchen", x: 43, y: 14, w: 14, h: 5, solid: true },
    { type: "vending", x: 55, y: 24, w: 3.5, h: 5.5, solid: true },
    { type: "cafe-table", cx: 46, cy: 36, rx: 2.2, solid: true },
    { type: "cafe-table", cx: 53, cy: 44, rx: 2.2, solid: true },
    { type: "rug-round", cx: 50, cy: 58, rx: 5 },
    { type: "pingpong", x: 44, y: 70, w: 11, h: 7, solid: true },
    { type: "server-rack", x: 41, y: 24, w: 3.5, h: 7, solid: true },
    { type: "plant", x: 41, y: 86 },
    { type: "plant", x: 58, y: 86 },
    { type: "mat", x: 47.5, y: 87, w: 5, h: 2.5 }
  ]
};

export const MAPS = { small: SMALL, medium: MEDIUM, large: LARGE };
export const MAP_ORDER = ["small", "medium", "large"];

// ----- mapa ativo -----

let activeId = "medium";
let solidRects = [];

export function setActiveMap(id) {
  activeId = MAPS[id] ? id : "medium";
  solidRects = buildSolids(MAPS[activeId]);
}

export function activeMap() {
  return MAPS[activeId];
}

export function activeMapId() {
  return activeId;
}

// Sala privada onde a posicao esta (ou null em area aberta).
export function roomFromPosition(x, y) {
  for (const room of activeMap().rooms) {
    const r = room.rect;
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) return room.id;
  }
  return null;
}

// Rotulo amigavel de um canal (sala ou lounge) do mapa ativo.
export function channelLabel(id) {
  const map = activeMap();
  if (id === map.lounge.id) return map.lounge.label;
  return map.rooms.find((room) => room.id === id)?.label || map.lounge.label;
}

// Ponto de caminhada de um canal (usado pelos botoes de area).
export function channelTarget(id) {
  const map = activeMap();
  if (id === map.lounge.id) return map.lounge.target;
  return map.rooms.find((room) => room.id === id)?.target || map.spawn;
}

// ----- colisao -----

// Meia-espessura das paredes e "raio" do personagem, em % (eixos separados
// porque o mapa nao e quadrado).
const WALL_HALF_X = 0.7;
const WALL_HALF_Y = 1.1;
const PLAYER_RX = 1.3;
const PLAYER_RY = 1.8;

function buildSolids(map) {
  const rects = [];

  for (const seg of map.walls) {
    if (seg.axis === "h") {
      rects.push({ x1: seg.x1, x2: seg.x2, y1: seg.y - WALL_HALF_Y, y2: seg.y + WALL_HALF_Y });
    } else {
      rects.push({ x1: seg.x - WALL_HALF_X, x2: seg.x + WALL_HALF_X, y1: seg.y1, y2: seg.y2 });
    }
  }

  for (const item of map.furniture) {
    if (!item.solid) continue;
    if (item.rx) {
      // circulo vira retangulo aproximado (mesas redondas incluem as cadeiras)
      const ry = item.rx * 1.6; // proporcao do mapa (16:10)
      rects.push({ x1: item.cx - item.rx - 0.6, x2: item.cx + item.rx + 0.6, y1: item.cy - ry - 1, y2: item.cy + ry + 1 });
    } else {
      rects.push({ x1: item.x, x2: item.x + item.w, y1: item.y, y2: item.y + item.h });
    }
  }

  return rects;
}

// A posicao (x, y) e o pe do personagem. Retorna true se colidir com algo.
export function isBlocked(x, y) {
  if (x < BOUNDS.x1 || x > BOUNDS.x2 || y < BOUNDS.y1 || y > BOUNDS.y2) return true;
  for (const r of solidRects) {
    if (
      x > r.x1 - PLAYER_RX &&
      x < r.x2 + PLAYER_RX &&
      y > r.y1 - PLAYER_RY &&
      y < r.y2 + PLAYER_RY
    ) {
      return true;
    }
  }
  return false;
}

// mapa padrao ate o app escolher
setActiveMap("medium");
