// Cenario do escritorio em pixel art, desenhado num canvas de baixa resolucao
// e ampliado com image-rendering: pixelated (estilo Gather Town).
// Tudo (paredes, salas, moveis) vem do mapa passado — a mesma fonte da colisao.
// sceneFx.js reutiliza os helpers exportados para animar detalhes por cima.

import { activeMap } from "../core/mapGeometry.js";

export const SCENE_W = 512;
export const SCENE_H = 320;

// Converte % do mapa para pixels do canvas.
export const X = (pct) => Math.round((pct / 100) * SCENE_W);
export const Y = (pct) => Math.round((pct / 100) * SCENE_H);
const XW = (pct) => Math.round((pct / 100) * SCENE_W); // larguras
const YH = (pct) => Math.round((pct / 100) * SCENE_H); // alturas

// Area do piso e faixa da parede externa superior (onde ficam janelas e neon).
export const FLOOR = { x1: X(6), y1: Y(9), x2: X(94), y2: Y(91) };
export const WALL_BAND = { y: FLOOR.y1 - 16, h: 12 };

// Retangulos em px das telas de monitor de uma bancada (sceneFx pisca eles).
export function monitorScreens(item) {
  const x = X(item.x);
  const y = Y(item.y);
  const w = XW(item.w);
  const screens = [];
  const gap = w / item.monitors;
  for (let i = 0; i < item.monitors; i += 1) {
    const mx = Math.round(x + gap * i + gap / 2 - 5);
    screens.push({ x: mx + 1, y: y + 5, w: 8, h: 5 });
  }
  return screens;
}

// Tamanhos (em % do mapa) dos moveis que os usuarios colocam no modo construir.
// x/y do prop e o CENTRO do movel.
export const PROP_SIZES = {
  desk: { w: 7, h: 6 },
  plant: { w: 2, h: 3 },
  sofa: { w: 12.5, h: 5 },
  rug: { w: 10, h: 16 },
  bookshelf: { w: 11, h: 5.6 },
  arcade: { w: 4, h: 6 },
  "cafe-table": { w: 5, h: 8 },
  pingpong: { w: 11, h: 7 }
};

// Redesenha a camada de moveis dos usuarios (canvas proprio, sempre limpo).
export function paintProps(canvas, props) {
  if (!canvas) return;
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  // desenha de cima para baixo para a sobreposicao parecer natural
  const sorted = [...props].sort((a, b) => a.y - b.y);
  for (const prop of sorted) {
    const size = PROP_SIZES[prop.kind];
    if (!size) continue;
    const x = X(prop.x - size.w / 2);
    const y = Y(prop.y - size.h / 2);
    const w = Math.round((size.w / 100) * SCENE_W);
    const h = Math.round((size.h / 100) * SCENE_H);
    switch (prop.kind) {
      case "desk":
        desk(g, x, y, w, h, 1);
        break;
      case "plant":
        plant(g, X(prop.x) - 3, Y(prop.y));
        break;
      case "sofa":
        sofa(g, x, y, w, h, "#b3593a");
        break;
      case "rug": {
        const r = Math.round(w / 2);
        circle(g, X(prop.x), Y(prop.y), r, "#8a6a2a");
        circle(g, X(prop.x), Y(prop.y), r - 6, "#a8842f");
        circle(g, X(prop.x), Y(prop.y), Math.floor(r / 2) - 1, "#8a6a2a");
        break;
      }
      case "bookshelf":
        bookshelf(g, x, y, w, h);
        break;
      case "arcade":
        arcade(g, x, y, w, h);
        break;
      case "cafe-table":
        cafeTable(g, X(prop.x), Y(prop.y), Math.round(w / 2) - 6);
        break;
      case "pingpong":
        pingpong(g, x, y, w, h);
        break;
    }
  }
}

// Pseudo-aleatorio deterministico: o mapa fica identico para todos os clientes.
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function paintMapScene(canvas, map = activeMap()) {
  if (!canvas) return;
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  paintVoid(g);
  paintWoodFloor(g);
  for (const room of map.rooms) {
    carpet(g, room.rect, room.carpet.colors);
  }
  paintWallShadows(g, map); // profundidade: paredes projetam sombra no piso
  paintWalls(g, map);
  paintFurniture(g, map);
}

// Contorno padrao dos moveis (roxo-escuro, consistente com os personagens).
const OUTLINE = "#15111f";

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function circle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y += 1) {
    const span = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - span, cy + y, span * 2, 1);
  }
}

// ----- fundo externo (fora do escritorio) -----
function paintVoid(g) {
  rect(g, 0, 0, SCENE_W, SCENE_H, "#0a0c12");
  const rnd = mulberry32(7);
  g.fillStyle = "rgba(129, 140, 248, 0.10)";
  for (let i = 0; i < 46; i += 1) {
    g.fillRect(Math.floor(rnd() * SCENE_W), Math.floor(rnd() * SCENE_H), 1, 1);
  }
}

// ----- piso de madeira com tabuas -----
function paintWoodFloor(g) {
  const { x1, y1, x2, y2 } = FLOOR;
  const rnd = mulberry32(42);
  const tones = ["#54402d", "#5b4531", "#4e3a29", "#604a35"];
  const plankH = 10;

  for (let y = y1; y < y2; y += plankH) {
    const rowOffset = (Math.floor((y - y1) / plankH) % 2) * 24;
    for (let x = x1; x < x2; x += 48) {
      const tone = tones[Math.floor(rnd() * tones.length)];
      rect(g, x, y, Math.min(48, x2 - x), Math.min(plankH, y2 - y), tone);
    }
    // emendas suaves + brilho no topo de cada tabua (luz de cima)
    rect(g, x1, y, x2 - x1, 1, "#41301f");
    rect(g, x1, y + 1, x2 - x1, 1, "rgba(255, 255, 255, 0.035)");
    for (let x = x1 + rowOffset; x < x2; x += 48) {
      rect(g, x, y, 1, Math.min(plankH, y2 - y), "#41301f");
    }
  }
}

// ----- carpete de uma sala -----
function carpet(g, roomRect, [base, light, dark]) {
  const pad = 6;
  const x1 = X(roomRect.x1) + pad;
  const y1 = Y(roomRect.y1) + pad;
  const w = X(roomRect.x2) - X(roomRect.x1) - pad * 2;
  const h = Y(Math.min(roomRect.y2, 91)) - Y(roomRect.y1) - pad * 2;
  rect(g, x1, y1, w, h, base);
  rect(g, x1, y1, w, 2, light);
  rect(g, x1, y1, 2, h, light);
  rect(g, x1, y1 + h - 2, w, 2, dark);
  rect(g, x1 + w - 2, y1, 2, h, dark);
  g.fillStyle = light;
  for (let y = y1 + 8; y < y1 + h - 8; y += 12) {
    for (let x = x1 + 8 + ((y / 12) % 2) * 6; x < x1 + w - 8; x += 12) {
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

// Sombras projetadas pelas paredes (luz vinda de cima/esquerda).
function paintWallShadows(g, map) {
  g.fillStyle = "rgba(0, 0, 0, 0.20)";
  // parede externa superior
  g.fillRect(FLOOR.x1, FLOOR.y1, FLOOR.x2 - FLOOR.x1, 4);
  for (const seg of map.walls) {
    if (seg.axis === "h") {
      g.fillRect(X(seg.x1), Y(seg.y) + 3, X(seg.x2) - X(seg.x1), 3);
    } else {
      g.fillRect(X(seg.x) + 2, Y(seg.y1), 3, Y(seg.y2) - Y(seg.y1));
    }
  }
}

// ----- paredes externas + divisorias do mapa -----
function paintWalls(g, map) {
  const { x1, y1, x2, y2 } = FLOOR;
  const wallTop = "#3a4256";
  const wallFace = "#262c3c";
  const wallDark = "#181d29";

  // parede externa de cima com "altura" (pseudo profundidade)
  rect(g, x1 - 6, y1 - 16, x2 - x1 + 12, 12, wallFace);
  rect(g, x1 - 6, y1 - 16, x2 - x1 + 12, 3, wallTop);
  rect(g, x1 - 6, y1 - 4, x2 - x1 + 12, 4, wallDark);
  // laterais e base externas
  rect(g, x1 - 6, y1 - 16, 6, y2 - y1 + 22, wallFace);
  rect(g, x2, y1 - 16, 6, y2 - y1 + 22, wallFace);
  rect(g, x1 - 6, y2, x2 - x1 + 12, 6, wallFace);
  rect(g, x1 - 6, y2, x2 - x1 + 12, 2, wallTop);

  // divisorias internas (mesma geometria usada na colisao)
  for (const seg of map.walls) {
    if (seg.axis === "h") {
      rect(g, X(seg.x1), Y(seg.y) - 3, X(seg.x2) - X(seg.x1), 6, wallFace);
      rect(g, X(seg.x1), Y(seg.y) - 3, X(seg.x2) - X(seg.x1), 1, wallTop);
    } else {
      rect(g, X(seg.x) - 2, Y(seg.y1), 4, Y(seg.y2) - Y(seg.y1), wallFace);
      rect(g, X(seg.x) - 2, Y(seg.y1), 1, Y(seg.y2) - Y(seg.y1), wallTop);
    }
  }
}

// ----- mobiliario -----
function paintFurniture(g, map) {
  for (const item of map.furniture) {
    switch (item.type) {
      case "desk":
        desk(g, X(item.x), Y(item.y), XW(item.w), YH(item.h), item.monitors);
        break;
      case "table":
        roundTable(g, X(item.cx), Y(item.cy), XW(item.rx));
        break;
      case "cafe-table":
        cafeTable(g, X(item.cx), Y(item.cy), XW(item.rx));
        break;
      case "table-long":
        tableLong(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "rug-round": {
        const cx = X(item.cx);
        const cy = Y(item.cy);
        const r = XW(item.rx);
        circle(g, cx, cy, r, "#8a6a2a");
        circle(g, cx, cy, r - 6, "#a8842f");
        circle(g, cx, cy, Math.floor(r / 2) - 1, "#8a6a2a");
        break;
      }
      case "sofa-h":
        sofa(g, X(item.x), Y(item.y), XW(item.w), YH(item.h), "#b3593a");
        break;
      case "sofa-v":
        sofaVertical(g, X(item.x), Y(item.y), XW(item.w), YH(item.h), "#b3593a");
        break;
      case "coffee": {
        const w = XW(item.w);
        const h = YH(item.h);
        rect(g, X(item.x), Y(item.y), w, h, "#5d4430");
        rect(g, X(item.x), Y(item.y), w, 3, "#75573d");
        rect(g, X(item.x) + 2, Y(item.y) + 2, 4, 4, "#e8e4da"); // caneca
        break;
      }
      case "bookshelf":
        bookshelf(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "kitchen":
        kitchen(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "server-rack":
        serverRack(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "whiteboard":
        whiteboard(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "screen-wall":
        screenWall(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "arcade":
        arcade(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "vending":
        vending(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "pingpong":
        pingpong(g, X(item.x), Y(item.y), XW(item.w), YH(item.h));
        break;
      case "window":
        wallWindow(g, X(item.x), XW(item.w));
        break;
      case "neon":
        neonSign(g, X(item.x), XW(item.w));
        break;
      case "plant":
        plant(g, X(item.x), Y(item.y));
        break;
      case "mat": {
        const w = XW(item.w);
        rect(g, X(item.x), Y(item.y), w, YH(item.h), "#3d4658");
        rect(g, X(item.x), Y(item.y), w, 1, "#4d586e");
        break;
      }
    }
  }
}

function desk(g, x, y, w, h, monitors) {
  rect(g, x + 2, y + h - 2, w, 4, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#7a5637");
  rect(g, x, y, w, 3, "#94693f");
  rect(g, x, y + h - 3, w, 3, "#5d4128");
  const gap = w / monitors;
  for (let i = 0; i < monitors; i += 1) {
    const mx = Math.round(x + gap * i + gap / 2 - 5);
    rect(g, mx, y + 4, 10, 7, "#11141d");
    rect(g, mx + 1, y + 5, 8, 5, "#7dd3fc");
    rect(g, mx + 1, y + 5, 8, 2, "#bae6fd");
    rect(g, mx + 4, y + 11, 2, 2, "#11141d");
  }
}

function roundTable(g, cx, cy, r) {
  circle(g, cx + 2, cy + 3, r, "rgba(0,0,0,0.35)");
  circle(g, cx, cy, r + 1, OUTLINE);
  circle(g, cx, cy, r, "#7a5637");
  circle(g, cx, cy, r - 3, "#94693f");
  circle(g, cx, cy, r - 8, "#7a5637");
  const chairs = [
    [cx - r - 8, cy - 4], [cx + r + 2, cy - 4],
    [cx - 4, cy - r - 9], [cx - 4, cy + r + 3]
  ];
  for (const [x, y] of chairs) {
    rect(g, x, y, 8, 8, "#33404f");
    rect(g, x, y, 8, 2, "#455568");
  }
  rect(g, cx - 5, cy - 3, 10, 6, "#d7dbe2");
  rect(g, cx - 4, cy - 2, 8, 3, "#5eead4");
}

function cafeTable(g, cx, cy, r) {
  circle(g, cx + 1, cy + 2, r, "rgba(0,0,0,0.35)");
  circle(g, cx, cy, r, "#94693f");
  circle(g, cx, cy, r - 3, "#b3854f");
  // banquinhos
  rect(g, cx - r - 6, cy - 2, 5, 5, "#33404f");
  rect(g, cx + r + 2, cy - 2, 5, 5, "#33404f");
  // caneca
  rect(g, cx - 2, cy - 2, 3, 3, "#e8e4da");
}

function tableLong(g, x, y, w, h) {
  rect(g, x + 2, y + h - 2, w, 4, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#3c4356");
  rect(g, x, y, w, 3, "#4d5670");
  rect(g, x, y + h - 3, w, 3, "#2b3142");
  // notebooks
  for (let i = 0; i < 3; i += 1) {
    const nx = x + 8 + i * Math.floor((w - 20) / 2);
    rect(g, nx, y + Math.floor(h / 2) - 3, 9, 5, "#d7dbe2");
    rect(g, nx + 1, y + Math.floor(h / 2) - 2, 7, 3, "#5eead4");
  }
  // cadeiras nos dois lados
  for (let i = 0; i < 3; i += 1) {
    const cxp = x + 8 + i * Math.floor((w - 20) / 2);
    rect(g, cxp, y - 9, 8, 7, "#33404f");
    rect(g, cxp, y + h + 2, 8, 7, "#33404f");
  }
}

function sofa(g, x, y, w, h, color) {
  rect(g, x + 2, y + h - 2, w, 4, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, color);
  rect(g, x, y, w, 4, shade(color, 22));
  rect(g, x, y + h - 3, w, 3, shade(color, -24));
  rect(g, x, y, 5, h, shade(color, -12));
  rect(g, x + w - 5, y, 5, h, shade(color, -12));
  rect(g, x + 8, y + 5, (w - 16) / 2 - 1, h - 9, shade(color, 10));
  rect(g, x + 8 + (w - 16) / 2 + 1, y + 5, (w - 16) / 2 - 1, h - 9, shade(color, 10));
}

function sofaVertical(g, x, y, w, h, color) {
  rect(g, x + 2, y + 2, w, h, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, color);
  rect(g, x, y, 4, h, shade(color, 22));
  rect(g, x + w - 3, y, 3, h, shade(color, -24));
  rect(g, x + 4, y + 6, w - 8, h - 12, shade(color, 10));
}

function bookshelf(g, x, y, w, h) {
  rect(g, x + 2, y + h, w, 3, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#3a2917");
  rect(g, x, y, w, 2, "#63482e");
  rect(g, x, y, 2, h, "#63482e");
  rect(g, x + w - 2, y, 2, h, "#2b1e10");
  const books = ["#e05d5d", "#5da9e0", "#7bc86c", "#e0b25d", "#a78bfa", "#f2789f"];
  for (const shelfY of [y + 3, y + Math.floor(h / 2) + 2]) {
    let bx = x + 3;
    let i = shelfY % 3;
    while (bx < x + w - 5) {
      const bw = 3 + (i % 2);
      rect(g, bx, shelfY, bw, Math.floor(h / 2) - 4, books[i % books.length]);
      bx += bw + 1;
      i += 1;
    }
  }
}

// Balcao de cozinha com maquina de cafe (o vapor e animado pelo sceneFx).
function kitchen(g, x, y, w, h) {
  rect(g, x + 2, y + h - 1, w, 3, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#8d9199");
  rect(g, x, y, w, 3, "#b8bcc4");
  rect(g, x, y + h - 3, w, 3, "#6a6e78");
  // pia
  rect(g, x + 4, y + 4, 10, 6, "#5c6470");
  rect(g, x + 5, y + 5, 8, 4, "#7b8794");
  // maquina de cafe (a direita do balcao)
  const mx = x + w - 13;
  rect(g, mx, y + 2, 9, h - 4, "#2b2f3a");
  rect(g, mx + 1, y + 3, 7, 3, "#3d4354");
  rect(g, mx + 3, y + h - 6, 3, 2, "#e8e4da"); // xicara
  rect(g, mx + 7, y + 3, 1, 1, "#f87171"); // luz ligada
  // frutas
  rect(g, x + Math.floor(w / 2) - 2, y + 4, 3, 3, "#e0b25d");
  rect(g, x + Math.floor(w / 2) + 2, y + 5, 3, 3, "#7bc86c");
}

// Ponto do bico da maquina de cafe (para o vapor animado).
export function kitchenSteamPoint(item) {
  return { x: X(item.x) + XW(item.w) - 9, y: Y(item.y) + 2 };
}

function serverRack(g, x, y, w, h) {
  rect(g, x + 2, y + h - 1, w, 3, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#1c212e");
  rect(g, x, y, w, 2, "#2e3547");
  rect(g, x, y, 2, h, "#2e3547");
  // bandejas com respiros
  for (let ry = y + 4; ry < y + h - 4; ry += 5) {
    rect(g, x + 2, ry, w - 5, 1, "#0f1320");
  }
  // coluna de LEDs (posicoes fixas; sceneFx pisca as cores)
  for (let i = 0; i < 4; i += 1) {
    rect(g, x + w - 4, y + 4 + i * 5, 2, 2, i % 2 ? "#34d399" : "#173326");
  }
}

// Posicoes dos LEDs do rack (para o sceneFx piscar).
export function rackLeds(item) {
  const x = X(item.x);
  const y = Y(item.y);
  const w = XW(item.w);
  const h = YH(item.h);
  const leds = [];
  for (let i = 0; i < 4; i += 1) {
    const ly = y + 4 + i * 5;
    if (ly < y + h - 3) leds.push({ x: x + w - 4, y: ly });
  }
  return leds;
}

function whiteboard(g, x, y, w, h) {
  // pes
  rect(g, x + 2, y + h, 2, 4, "#4a5064");
  rect(g, x + w - 4, y + h, 2, 4, "#4a5064");
  rect(g, x, y, w, h, "#e8ecf2");
  rect(g, x, y, w, 1, "#ffffff");
  rect(g, x, y + h - 1, w, 1, "#b9c1cf");
  // rabiscos coloridos
  rect(g, x + 3, y + 3, Math.floor(w * 0.4), 1, "#6366f1");
  rect(g, x + 3, y + 5, Math.floor(w * 0.55), 1, "#f472b6");
  rect(g, x + 3, y + 7, Math.floor(w * 0.3), 1, "#34d399");
}

// Telao de dashboard (war room): grafico animavel pelo sceneFx.
function screenWall(g, x, y, w, h) {
  rect(g, x - 1, y - 1, w + 2, h + 2, "#10131c");
  rect(g, x, y, w, h, "#0c1a2b");
  // barras de grafico
  const bars = 6;
  const bw = Math.floor(w / (bars * 2));
  for (let i = 0; i < bars; i += 1) {
    const bh = 2 + ((i * 7) % (h - 4));
    rect(g, x + 2 + i * bw * 2, y + h - 1 - bh, bw, bh, i % 2 ? "#38bdf8" : "#34d399");
  }
}

function arcade(g, x, y, w, h) {
  rect(g, x + 1, y + h - 1, w, 3, "rgba(0,0,0,0.4)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#3b2d5e");
  rect(g, x, y, w, 2, "#54418a");
  // tela (sceneFx cicla as cores)
  rect(g, x + 1, y + 3, w - 2, Math.floor(h * 0.4), "#22d3ee");
  // painel de controles
  rect(g, x + 1, y + Math.floor(h * 0.62), w - 2, 3, "#241b3d");
  rect(g, x + 2, y + Math.floor(h * 0.62) + 1, 1, 1, "#f87171");
  rect(g, x + w - 3, y + Math.floor(h * 0.62) + 1, 1, 1, "#fbbf24");
}

// Tela do arcade (para o sceneFx animar).
export function arcadeScreen(item) {
  return {
    x: X(item.x) + 1,
    y: Y(item.y) + 3,
    w: XW(item.w) - 2,
    h: Math.floor(YH(item.h) * 0.4)
  };
}

function vending(g, x, y, w, h) {
  rect(g, x + 1, y + h - 1, w, 3, "rgba(0,0,0,0.4)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#1d4ed8");
  rect(g, x, y, w, 2, "#3b82f6");
  // vitrine com produtos
  rect(g, x + 1, y + 3, w - 4, h - 8, "#0f1a38");
  const colors = ["#f87171", "#fbbf24", "#34d399"];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      rect(g, x + 2 + col * 4, y + 4 + row * 4, 2, 2, colors[(row + col) % colors.length]);
    }
  }
  rect(g, x + w - 3, y + 4, 2, 6, "#93c5fd"); // painel
}

function pingpong(g, x, y, w, h) {
  rect(g, x + 2, y + h - 1, w, 4, "rgba(0,0,0,0.35)");
  rect(g, x - 1, y - 1, w + 2, h + 2, OUTLINE);
  rect(g, x, y, w, h, "#1d7a4f");
  rect(g, x, y, w, 2, "#2ba36b");
  rect(g, x, y + h - 2, w, 2, "#155c3b");
  // linha central + rede
  rect(g, x, y + Math.floor(h / 2), w, 1, "#e8f4ec");
  rect(g, x + Math.floor(w / 2), y - 1, 1, h + 2, "#d7dbe2");
  // raquetes
  rect(g, x + 4, y + 3, 4, 3, "#e05d5d");
  rect(g, x + w - 8, y + h - 6, 4, 3, "#5da9e0");
}

// Janela na parede externa superior (vista noturna da cidade).
function wallWindow(g, x, w) {
  const y = WALL_BAND.y + 2;
  const h = WALL_BAND.h - 3;
  rect(g, x - 1, y - 1, w + 2, h + 2, "#151a26");
  rect(g, x, y, w, h, "#1d2c4d");
  rect(g, x, y, w, 2, "#31497c");
  // luzes da cidade
  const rnd = mulberry32(x);
  for (let i = 0; i < Math.floor(w / 3); i += 1) {
    const lx = x + 1 + Math.floor(rnd() * (w - 2));
    const ly = y + 3 + Math.floor(rnd() * (h - 4));
    rect(g, lx, ly, 1, 1, rnd() > 0.5 ? "#fbbf24" : "#7dd3fc");
  }
  // caixilho
  rect(g, x + Math.floor(w / 2), y, 1, h, "#151a26");
}

// Letreiro neon "HZ" na parede (sceneFx pulsa o brilho).
function neonSign(g, x, w) {
  const y = WALL_BAND.y + 2;
  const h = WALL_BAND.h - 4;
  rect(g, x - 2, y - 1, w + 4, h + 2, "#10131c");
  const pink = "#f472b6";
  const cyan = "#22d3ee";
  const mid = x + Math.floor(w / 2);
  // H
  rect(g, x + 2, y + 1, 2, h - 2, pink);
  rect(g, mid - 4, y + 1, 2, h - 2, pink);
  rect(g, x + 4, y + Math.floor(h / 2), mid - 8 - x, 1, pink);
  // Z
  rect(g, mid + 2, y + 1, w - (mid - x) - 4, 1, cyan);
  rect(g, mid + 2, y + h - 2, w - (mid - x) - 4, 1, cyan);
  rect(g, mid + Math.floor((w - (mid - x)) / 2) - 1, y + 2, 2, h - 4, cyan);
}

// Area do neon (para o sceneFx pulsar o brilho).
export function neonArea(item) {
  return { x: X(item.x) - 2, y: WALL_BAND.y + 1, w: XW(item.w) + 4, h: WALL_BAND.h - 2 };
}

function plant(g, x, y) {
  rect(g, x - 1, y + 7, 8, 2, "rgba(0,0,0,0.35)");
  rect(g, x, y + 4, 6, 4, "#8a4f2c");
  rect(g, x, y + 4, 6, 1, "#a56438");
  rect(g, x + 1, y - 2, 4, 6, "#2e7d44");
  rect(g, x - 1, y, 3, 4, "#3f9d5a");
  rect(g, x + 4, y, 3, 4, "#3f9d5a");
  rect(g, x + 2, y - 4, 2, 4, "#4fbf6f");
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clampByte = (v) => Math.max(0, Math.min(255, v));
  const r = clampByte(((n >> 16) & 255) + amount);
  const gg = clampByte(((n >> 8) & 255) + amount);
  const b = clampByte((n & 255) + amount);
  return `rgb(${r}, ${gg}, ${b})`;
}
