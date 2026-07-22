// Cenario do escritorio em pixel art, desenhado uma vez num canvas de baixa
// resolucao e ampliado com image-rendering: pixelated (estilo Gather Town).
// As salas seguem os retangulos de PRIVATE_ROOMS (em % do mapa).

const W = 512;
const H = 320;

// Converte % do mapa para pixels do canvas.
const X = (pct) => Math.round((pct / 100) * W);
const Y = (pct) => Math.round((pct / 100) * H);

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

const FLOOR = { x1: X(6), y1: Y(9), x2: X(94), y2: Y(91) };

const ROOMS = {
  team: { x1: X(12), y1: Y(20), x2: X(53), y2: Y(64) },
  daily: { x1: X(53), y1: Y(20), x2: X(88), y2: Y(64) },
  focus: { x1: X(53), y1: Y(66), x2: X(88), y2: Y(92) }
};

export function paintMapScene(canvas) {
  if (!canvas) return;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  paintVoid(g);
  paintWoodFloor(g);
  paintCarpets(g);
  paintWalls(g);
  paintFurniture(g);
}

function rect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ----- fundo externo (fora do escritorio) -----
function paintVoid(g) {
  rect(g, 0, 0, W, H, "#0a0c12");
  const rnd = mulberry32(7);
  g.fillStyle = "rgba(129, 140, 248, 0.10)";
  for (let i = 0; i < 46; i += 1) {
    g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1);
  }
}

// ----- piso de madeira com tabuas -----
function paintWoodFloor(g) {
  const { x1, y1, x2, y2 } = FLOOR;
  const rnd = mulberry32(42);
  const tones = ["#4a3527", "#503a2b", "#453023", "#54402f"];
  const plankH = 10;

  for (let y = y1; y < y2; y += plankH) {
    const rowOffset = (Math.floor((y - y1) / plankH) % 2) * 24;
    for (let x = x1; x < x2; x += 48) {
      const tone = tones[Math.floor(rnd() * tones.length)];
      rect(g, x, y, Math.min(48, x2 - x), Math.min(plankH, y2 - y), tone);
    }
    // emenda horizontal das tabuas
    rect(g, x1, y, x2 - x1, 1, "#382718");
    // emendas verticais desencontradas
    for (let x = x1 + rowOffset; x < x2; x += 48) {
      rect(g, x, y, 1, Math.min(plankH, y2 - y), "#382718");
    }
  }
}

// ----- carpetes das salas -----
function paintCarpets(g) {
  carpet(g, ROOMS.team, "#2f3560", "#3a4173", "#262b4e");
  carpet(g, ROOMS.daily, "#24473e", "#2d574c", "#1d3a33");
  carpet(g, ROOMS.focus, "#462c3d", "#54374a", "#382332");

  // tapete redondo do lounge
  const cx = X(31);
  const cy = Y(78);
  circle(g, cx, cy, 34, "#8a6a2a");
  circle(g, cx, cy, 28, "#a8842f");
  circle(g, cx, cy, 16, "#8a6a2a");
}

function carpet(g, r, base, light, dark) {
  const pad = 6;
  const x1 = r.x1 + pad;
  const y1 = r.y1 + pad;
  const w = r.x2 - r.x1 - pad * 2;
  const h = r.y2 - r.y1 - pad * 2;
  rect(g, x1, y1, w, h, base);
  rect(g, x1, y1, w, 2, light);
  rect(g, x1, y1, 2, h, light);
  rect(g, x1, y1 + h - 2, w, 2, dark);
  rect(g, x1 + w - 2, y1, 2, h, dark);
  // pontinhos decorativos em xadrez
  g.fillStyle = light;
  for (let y = y1 + 8; y < y1 + h - 8; y += 12) {
    for (let x = x1 + 8 + ((y / 12) % 2) * 6; x < x1 + w - 8; x += 12) {
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }
}

function circle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let y = -r; y <= r; y += 1) {
    const span = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - span, cy + y, span * 2, 1);
  }
}

// ----- paredes externas e divisorias (com portas) -----
function paintWalls(g) {
  const { x1, y1, x2, y2 } = FLOOR;
  const wallTop = "#3a4256";
  const wallFace = "#262c3c";
  const wallDark = "#181d29";

  // parede de cima com "altura" (pseudo profundidade)
  rect(g, x1 - 6, y1 - 16, x2 - x1 + 12, 12, wallFace);
  rect(g, x1 - 6, y1 - 16, x2 - x1 + 12, 3, wallTop);
  rect(g, x1 - 6, y1 - 4, x2 - x1 + 12, 4, wallDark);
  // laterais e base
  rect(g, x1 - 6, y1 - 16, 6, y2 - y1 + 22, wallFace);
  rect(g, x2, y1 - 16, 6, y2 - y1 + 22, wallFace);
  rect(g, x1 - 6, y2, x2 - x1 + 12, 6, wallFace);
  rect(g, x1 - 6, y2, x2 - x1 + 12, 2, wallTop);

  // divisorias internas (portas = vaos de 34px)
  const midX = ROOMS.team.x2; // 53%
  const midY = ROOMS.team.y2; // 64%

  // vertical entre team e daily, porta no centro
  wallV(g, midX, ROOMS.team.y1, midY, wallFace, wallTop, 34);
  // vertical entre lounge e focus
  wallV(g, midX, ROOMS.focus.y1, FLOOR.y2, wallFace, wallTop, 34);
  // horizontal abaixo de team/daily, portas no centro de cada sala
  wallH(g, ROOMS.team.x1, midX, midY, wallFace, wallTop, 34);
  wallH(g, midX, ROOMS.daily.x2, midY, wallFace, wallTop, 34);
  // bordas superiores das salas (encostam na parede externa? nao: comecam em 20%)
  wallH(g, ROOMS.team.x1, ROOMS.daily.x2, ROOMS.team.y1, wallFace, wallTop, 0);
  // laterais externas das salas
  wallV(g, ROOMS.team.x1, ROOMS.team.y1, midY, wallFace, wallTop, 0);
  wallV(g, ROOMS.daily.x2, ROOMS.team.y1, midY, wallFace, wallTop, 0);
  wallV(g, ROOMS.focus.x2, ROOMS.focus.y1, FLOOR.y2, wallFace, wallTop, 0);
  wallH(g, midX, ROOMS.focus.x2, ROOMS.focus.y1, wallFace, wallTop, 30);
}

function wallV(g, x, yStart, yEnd, face, top, doorGap) {
  const mid = (yStart + yEnd) / 2;
  const half = doorGap / 2;
  const draw = (a, b) => {
    if (b - a < 2) return;
    rect(g, x - 2, a, 4, b - a, face);
    rect(g, x - 2, a, 1, b - a, top);
  };
  if (doorGap > 0) {
    draw(yStart, mid - half);
    draw(mid + half, yEnd);
  } else {
    draw(yStart, yEnd);
  }
}

function wallH(g, xStart, xEnd, y, face, top, doorGap) {
  const mid = (xStart + xEnd) / 2;
  const half = doorGap / 2;
  const draw = (a, b) => {
    if (b - a < 2) return;
    rect(g, a, y - 3, b - a, 6, face);
    rect(g, a, y - 3, b - a, 1, top);
  };
  if (doorGap > 0) {
    draw(xStart, mid - half);
    draw(mid + half, xEnd);
  } else {
    draw(xStart, xEnd);
  }
}

// ----- mobiliario -----
function paintFurniture(g) {
  // Team: duas bancadas com monitores
  desk(g, X(22), Y(32), 70, 22, 3);
  desk(g, X(22), Y(48), 70, 22, 3);

  // Daily: mesa redonda de reuniao com cadeiras
  roundTable(g, X(70), Y(41), 26);

  // Focus: mesas individuais
  desk(g, X(60), Y(74), 34, 20, 1);
  desk(g, X(76), Y(74), 34, 20, 1);

  // Lounge: sofa em L + mesinha de centro
  sofa(g, X(15), Y(70), 64, 16, "#b3593a");
  sofaVertical(g, X(15), Y(75), 16, 42, "#b3593a");
  rect(g, X(28), Y(76), 22, 14, "#5d4430");
  rect(g, X(28), Y(76), 22, 3, "#75573d");
  // caneca na mesinha
  rect(g, X(30), Y(78), 4, 4, "#e8e4da");

  // estante de livros encostada na parede superior do lounge
  bookshelf(g, X(38), Y(66) + 5, 58, 18);

  // plantas espalhadas
  plant(g, X(9), Y(14));
  plant(g, X(90), Y(14));
  plant(g, X(9), Y(86));
  plant(g, X(90), Y(86));
  plant(g, X(50), Y(85));
  plant(g, X(56), Y(23));

  // tapete de entrada (porta de baixo do mapa)
  rect(g, X(48), Y(88), 22, 8, "#3d4658");
  rect(g, X(48), Y(88), 22, 1, "#4d586e");
}

function desk(g, x, y, w, h, monitors) {
  // sombra
  rect(g, x + 2, y + h - 2, w, 4, "rgba(0,0,0,0.35)");
  // tampo
  rect(g, x, y, w, h, "#7a5637");
  rect(g, x, y, w, 3, "#94693f");
  rect(g, x, y + h - 3, w, 3, "#5d4128");
  // monitores com tela acesa
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
  circle(g, cx, cy, r, "#7a5637");
  circle(g, cx, cy, r - 3, "#94693f");
  circle(g, cx, cy, r - 8, "#7a5637");
  // cadeiras ao redor
  const chairs = [
    [cx - r - 8, cy - 4], [cx + r + 2, cy - 4],
    [cx - 4, cy - r - 9], [cx - 4, cy + r + 3]
  ];
  for (const [x, y] of chairs) {
    rect(g, x, y, 8, 8, "#33404f");
    rect(g, x, y, 8, 2, "#455568");
  }
  // notebook no centro
  rect(g, cx - 5, cy - 3, 10, 6, "#d7dbe2");
  rect(g, cx - 4, cy - 2, 8, 3, "#5eead4");
}

function sofa(g, x, y, w, h, color) {
  rect(g, x + 2, y + h - 2, w, 4, "rgba(0,0,0,0.35)");
  rect(g, x, y, w, h, color);
  rect(g, x, y, w, 4, shade(color, 22));
  rect(g, x, y + h - 3, w, 3, shade(color, -24));
  // bracos
  rect(g, x, y, 5, h, shade(color, -12));
  rect(g, x + w - 5, y, 5, h, shade(color, -12));
  // almofadas
  rect(g, x + 8, y + 5, (w - 16) / 2 - 1, h - 9, shade(color, 10));
  rect(g, x + 8 + (w - 16) / 2 + 1, y + 5, (w - 16) / 2 - 1, h - 9, shade(color, 10));
}

function sofaVertical(g, x, y, w, h, color) {
  rect(g, x + 2, y + 2, w, h, "rgba(0,0,0,0.35)");
  rect(g, x, y, w, h, color);
  rect(g, x, y, 4, h, shade(color, 22));
  rect(g, x + w - 3, y, 3, h, shade(color, -24));
  rect(g, x + 4, y + 6, w - 8, h - 12, shade(color, 10));
}

function bookshelf(g, x, y, w, h) {
  rect(g, x + 2, y + h, w, 3, "rgba(0,0,0,0.35)");
  rect(g, x, y, w, h, "#3a2917");
  rect(g, x, y, w, 2, "#63482e");
  rect(g, x, y, 2, h, "#63482e");
  rect(g, x + w - 2, y, 2, h, "#2b1e10");
  const books = ["#e05d5d", "#5da9e0", "#7bc86c", "#e0b25d", "#a78bfa", "#f2789f"];
  // duas prateleiras de livros
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
