// Personagens em pixel art (estilo Gather Town) gerados em canvas.
// Cada skin tem paleta E penteado proprios; o spritesheet (4 direcoes x 4
// quadros: parado, 2 passos, piscando) e gerado uma vez e cacheado.
//
// Estilo: chibi 16x22 com cabecao e corpo pequeno, cores CHAPADAS (no maximo
// um tom de sombra por material) e contorno escuro. Nada de textura de cabelo,
// brilho de ombro ou nariz: nesse tamanho isso vira ruido e o cenario ja e
// carregado — o personagem tem que ler de longe pela silhueta.
//
// Grade vertical: 1-3 cabelo, 2-9 cabeca (olhos em 6-7), 10-15 tronco,
// 16-19 pernas e sapatos.

export const FRAME_W = 16;
export const FRAME_H = 22;
export const SPRITE_SCALE = 3;

const COLS = 4; // 0 = parado, 1 e 2 = passos, 3 = piscando/respirando
const ROWS = 4; // down, left, right, up
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
const WALK_CYCLE = [1, 0, 2, 0]; // pisa, junta, pisa com a outra perna, junta
const BLINK_PERIOD = 26; // ticks entre piscadas (~3.4s); cada el tem offset proprio

// Paleta enxuta: camisa (+ a barra mais escura), cabelo, pele, calca, sapato
// e o penteado (style). Um tom de sombra so, no corpo inteiro.
export const PALETTES = {
  "default:mint": {
    style: "spiky",
    shirt: "#3ddc97", shirtDark: "#1fae74", hair: "#4a3628",
    skin: "#f4c99e", pants: "#405478", shoes: "#1d2438"
  },
  "default:blue": {
    style: "swept",
    shirt: "#5aa7f7", shirtDark: "#2f6fd1", hair: "#2b3a55",
    skin: "#ecbb90", pants: "#3a4a6b", shoes: "#161d2e"
  },
  "default:rose": {
    style: "bob",
    shirt: "#f8798f", shirtDark: "#d14e68", hair: "#a34f22",
    skin: "#f8d7b8", pants: "#59405c", shoes: "#241a2c"
  },
  "default:gold": {
    style: "curly",
    shirt: "#ffc93c", shirtDark: "#dda012", hair: "#23272e",
    skin: "#b97e4e", pants: "#495a6e", shoes: "#1a212b"
  },
  "default:violet": {
    style: "ponytail",
    shirt: "#b18cfc", shirtDark: "#8a5cf0", hair: "#e2c4ff",
    skin: "#f4c99e", pants: "#453c66", shoes: "#191532"
  },
  "default:slate": {
    style: "messy",
    shirt: "#a8b6c8", shirtDark: "#7d8ea3", hair: "#e8edf3",
    skin: "#e4ad7e", pants: "#37455f", shoes: "#111722"
  }
};

const EYES = "#20263a";
// Boca num tom mais suave que os olhos: some de longe, mas da simpatia de perto.
const MOUTH = "#a4635a";
// Contorno colorido (roxo-escuro, nao preto) — visual pixel art moderno.
const OUTLINE = "#15111f";
const sheetCache = new Map();
const portraitCache = new Map();

export function isPixelSkin(avatar) {
  return Boolean(PALETTES[avatar]);
}

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// ---------------------------------------------------------------------------
// Desenho do personagem. dir: down|right|up (left = right espelhado).
// frame: 0 parado, 1/2 passos, 3 piscando (+1px de "respiracao").
// ---------------------------------------------------------------------------
function drawFrame(g, p, dir, frame) {
  const blink = frame === 3;
  const stepping = frame === 1 || frame === 2;
  const bob = stepping || blink ? 1 : 0;

  if (dir === "right") {
    drawSideLegs(g, p, frame);
    drawSideTorso(g, p, bob, frame);
    drawSideHead(g, p, bob, blink);
  } else if (dir === "up") {
    drawFrontLegs(g, p, frame);
    drawBackTorso(g, p, bob, frame);
    drawBackHead(g, p, bob);
  } else {
    drawFrontLegs(g, p, frame);
    drawFrontTorso(g, p, bob, frame);
    drawFrontHead(g, p, bob, blink);
  }
}

// ----- pernas e pes (frente/costas) -----
// Short chapado + dois pezinhos: com pernas separadas o vao de 2px vira
// contorno e o rodape inteiro virava um bloco escuro so.
function drawFrontLegs(g, p, frame) {
  const liftL = frame === 1 ? 1 : 0;
  const liftR = frame === 2 ? 1 : 0;

  px(g, 5, 16, 6, 2, p.pants);
  px(g, 5, 18 - liftL, 2, 2, p.shoes);
  px(g, 9, 18 - liftR, 2, 2, p.shoes);
}

// ----- pernas e pes (perfil: pes em tesoura) -----
function drawSideLegs(g, p, frame) {
  px(g, 5, 16, 6, 2, p.pants);

  if (frame === 1 || frame === 2) {
    const front = frame === 1 ? 9 : 4;
    const back = frame === 1 ? 4 : 9;
    px(g, front, 18, 3, 2, p.shoes);
    px(g, back, 19, 3, 1, p.shoes);
  } else {
    px(g, 5, 18, 3, 2, p.shoes);
    px(g, 8, 18, 3, 2, p.shoes);
  }
}

// ----- torso frente: camisa chapada, mangas curtas e maos -----
function drawFrontTorso(g, p, bob, frame) {
  const swingL = frame === 2 ? 1 : 0;
  const swingR = frame === 1 ? 1 : 0;

  px(g, 5, 10 + bob, 6, 6, p.shirt);
  px(g, 5, 15 + bob, 6, 1, p.shirtDark); // unica sombra: a barra da camisa
  px(g, 4, 11 + bob + swingL, 1, 3, p.shirt);
  px(g, 4, 14 + bob + swingL, 1, 1, p.skin);
  px(g, 11, 11 + bob + swingR, 1, 3, p.shirt);
  px(g, 11, 14 + bob + swingR, 1, 1, p.skin);
}

// ----- torso costas: igual a frente (o que muda e a cabeca) -----
function drawBackTorso(g, p, bob, frame) {
  const swingL = frame === 1 ? 1 : 0;
  const swingR = frame === 2 ? 1 : 0;

  px(g, 5, 10 + bob, 6, 6, p.shirt);
  px(g, 5, 15 + bob, 6, 1, p.shirtDark);
  px(g, 4, 11 + bob + swingL, 1, 3, p.shirt);
  px(g, 4, 14 + bob + swingL, 1, 1, p.skin);
  px(g, 11, 11 + bob + swingR, 1, 3, p.shirt);
  px(g, 11, 14 + bob + swingR, 1, 1, p.skin);
}

// ----- torso perfil: um braco so, balancando com o passo -----
function drawSideTorso(g, p, bob, frame) {
  const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  px(g, 5, 10 + bob, 6, 6, p.shirt);
  px(g, 5, 15 + bob, 6, 1, p.shirtDark);
  px(g, 8 + swing, 11 + bob, 2, 3, p.shirtDark);
  px(g, 8 + swing, 14 + bob, 2, 1, p.skin);
}

// ----- cabeca frente: cabecao chapado, olhos grandes e sorriso de 2px -----
function drawFrontHead(g, p, bob, blink) {
  px(g, 4, 2 + bob, 8, 1, p.skin);
  px(g, 3, 3 + bob, 10, 6, p.skin);
  px(g, 4, 9 + bob, 8, 1, p.skin);

  hairFront(g, p, bob);

  if (blink) {
    px(g, 5, 7 + bob, 2, 1, EYES);
    px(g, 9, 7 + bob, 2, 1, EYES);
  } else {
    px(g, 5, 6 + bob, 2, 2, EYES);
    px(g, 9, 6 + bob, 2, 2, EYES);
  }

  px(g, 7, 8 + bob, 2, 1, MOUTH); // sorrisinho
}

// ----- cabeca perfil: um olho, sem nariz -----
function drawSideHead(g, p, bob, blink) {
  px(g, 4, 2 + bob, 8, 1, p.skin);
  px(g, 3, 3 + bob, 10, 6, p.skin);
  px(g, 4, 9 + bob, 8, 1, p.skin);

  hairSide(g, p, bob);

  if (blink) {
    px(g, 9, 7 + bob, 2, 1, EYES);
  } else {
    px(g, 9, 6 + bob, 2, 2, EYES);
  }

  px(g, 11, 8 + bob, 1, 1, MOUTH); // boca na frente do rosto, longe do olho
}

// ----- cabeca costas: so cabelo -----
function drawBackHead(g, p, bob) {
  px(g, 4, 2 + bob, 8, 1, p.skin);
  px(g, 3, 3 + bob, 10, 7, p.skin);
  hairBack(g, p, bob);
}

// ---------------------------------------------------------------------------
// Penteados: a identidade de cada skin vem da SILHUETA, nao de textura.
// Cada um e um bloco chapado na cor do cabelo — sem mechas de 1px soltas.
// ---------------------------------------------------------------------------
function hairFront(g, p, bob) {
  const H = p.hair;

  // touca base: topo da cabeca e um pouco das laterais
  px(g, 4, 1 + bob, 8, 1, H);
  px(g, 3, 2 + bob, 10, 3, H);

  switch (p.style) {
    case "spiky":
      px(g, 4, 0 + bob, 2, 1, H); // espetinhos no topo
      px(g, 7, 0 + bob, 2, 1, H);
      px(g, 10, 0 + bob, 2, 1, H);
      break;
    case "swept":
      px(g, 3, 5 + bob, 6, 1, H); // franja caida para um lado
      break;
    case "bob":
      px(g, 3, 5 + bob, 1, 4, H); // cortinas ate o queixo
      px(g, 12, 5 + bob, 1, 4, H);
      break;
    case "curly":
      px(g, 4, 0 + bob, 8, 1, H); // volume redondo
      px(g, 2, 2 + bob, 12, 3, H);
      px(g, 2, 5 + bob, 1, 2, H);
      px(g, 13, 5 + bob, 1, 2, H);
      break;
    case "ponytail":
      px(g, 6, 0 + bob, 4, 1, H); // coque no topo
      break;
    case "messy":
      px(g, 3, 1 + bob, 3, 1, H); // topo irregular
      px(g, 7, 0 + bob, 3, 1, H);
      px(g, 11, 1 + bob, 2, 1, H);
      break;
  }
}

function hairSide(g, p, bob) {
  const H = p.hair;

  px(g, 4, 1 + bob, 8, 1, H);
  px(g, 3, 2 + bob, 10, 3, H);
  px(g, 3, 5 + bob, 2, 3, H); // nuca

  switch (p.style) {
    case "spiky":
      px(g, 4, 0 + bob, 2, 1, H);
      px(g, 7, 0 + bob, 2, 1, H);
      px(g, 10, 0 + bob, 2, 1, H);
      break;
    case "swept":
      px(g, 9, 5 + bob, 4, 1, H); // franja para frente
      break;
    case "bob":
      px(g, 3, 5 + bob, 2, 4, H);
      px(g, 12, 5 + bob, 1, 2, H);
      break;
    case "curly":
      px(g, 4, 0 + bob, 8, 1, H);
      px(g, 2, 2 + bob, 12, 3, H);
      px(g, 2, 5 + bob, 2, 3, H);
      break;
    case "ponytail":
      px(g, 6, 0 + bob, 4, 1, H);
      px(g, 1, 5 + bob, 2, 5, H); // rabo caindo atras
      break;
    case "messy":
      px(g, 3, 1 + bob, 3, 1, H);
      px(g, 7, 0 + bob, 3, 1, H);
      px(g, 11, 1 + bob, 2, 1, H);
      break;
  }
}

function hairBack(g, p, bob) {
  const H = p.hair;

  // de costas o cabelo cobre a cabeca inteira
  px(g, 4, 1 + bob, 8, 1, H);
  px(g, 3, 2 + bob, 10, 7, H);
  px(g, 4, 9 + bob, 8, 1, H);

  switch (p.style) {
    case "spiky":
      px(g, 4, 0 + bob, 2, 1, H);
      px(g, 7, 0 + bob, 2, 1, H);
      px(g, 10, 0 + bob, 2, 1, H);
      break;
    case "swept":
      break;
    case "bob":
      px(g, 3, 9 + bob, 10, 1, H); // corte reto na nuca
      break;
    case "curly":
      px(g, 4, 0 + bob, 8, 1, H);
      px(g, 2, 2 + bob, 12, 5, H);
      break;
    case "ponytail":
      px(g, 6, 0 + bob, 4, 1, H);
      px(g, 7, 10 + bob, 2, 3, H); // rabo descendo pelas costas
      break;
    case "messy":
      px(g, 3, 1 + bob, 3, 1, H);
      px(g, 7, 0 + bob, 3, 1, H);
      px(g, 11, 1 + bob, 2, 1, H);
      break;
  }
}

// ---------------------------------------------------------------------------
// Spritesheet: mascara -> contorno -> desenho (por quadro e direcao)
// ---------------------------------------------------------------------------

// Mascara de ocupacao de um quadro (para gerar o contorno sem ler pixels).
function buildMask(p, dir, frame) {
  const grid = [];
  for (let y = 0; y < FRAME_H; y += 1) grid.push(new Array(FRAME_W).fill(false));
  const recorder = {
    fillStyle: "",
    fillRect(x, y, w, h) {
      for (let yy = Math.max(0, y); yy < Math.min(FRAME_H, y + h); yy += 1) {
        for (let xx = Math.max(0, x); xx < Math.min(FRAME_W, x + w); xx += 1) {
          grid[yy][xx] = true;
        }
      }
    }
  };
  drawFrame(recorder, p, dir, frame);
  return grid;
}

function buildSheet(skinId) {
  const p = PALETTES[skinId] || PALETTES["default:mint"];
  const canvas = document.createElement("canvas");
  canvas.width = COLS * FRAME_W;
  canvas.height = ROWS * FRAME_H;
  const g = canvas.getContext("2d");

  for (const [dir, row] of Object.entries(DIR_ROW)) {
    for (let frame = 0; frame < COLS; frame += 1) {
      const baseDir = dir === "left" ? "right" : dir;
      const mask = buildMask(p, baseDir, frame);

      g.save();
      g.translate(frame * FRAME_W, row * FRAME_H);
      if (dir === "left") {
        // esquerda = direita espelhada
        g.translate(FRAME_W, 0);
        g.scale(-1, 1);
      }
      // contorno colorido: pinta as celulas vazias vizinhas do personagem
      g.fillStyle = OUTLINE;
      for (let y = 0; y < FRAME_H; y += 1) {
        for (let x = 0; x < FRAME_W; x += 1) {
          if (mask[y][x]) continue;
          const nearBody =
            (y > 0 && mask[y - 1][x]) ||
            (y < FRAME_H - 1 && mask[y + 1][x]) ||
            (x > 0 && mask[y][x - 1]) ||
            (x < FRAME_W - 1 && mask[y][x + 1]);
          if (nearBody) g.fillRect(x, y, 1, 1);
        }
      }
      drawFrame(g, p, baseDir, frame);
      g.restore();
    }
  }

  return { url: canvas.toDataURL("image/png"), canvas };
}

function sheetFor(skinId) {
  if (!sheetCache.has(skinId)) {
    sheetCache.set(skinId, buildSheet(skinId));
  }
  return sheetCache.get(skinId);
}

// Retrato (cabeca) para avatares redondos da sidebar, chat e toasts.
export function portraitUrl(skinId) {
  if (!isPixelSkin(skinId)) return "";
  if (!portraitCache.has(skinId)) {
    const sheet = sheetFor(skinId);
    const canvas = document.createElement("canvas");
    canvas.width = 12;
    canvas.height = 12;
    const g = canvas.getContext("2d");
    g.fillStyle = "#232839";
    g.fillRect(0, 0, 12, 12);
    // recorta cabeca do quadro frontal parado (x2..14, y0..12)
    g.drawImage(sheet.canvas, 2, 0, 12, 12, 0, 0, 12, 12);
    portraitCache.set(skinId, canvas.toDataURL("image/png"));
  }
  return portraitCache.get(skinId);
}

// Aplica o sprite (ou foto) num avatar do mapa.
export function applyMapSprite(el, user) {
  const avatar = user.avatar || "";

  if (avatar.startsWith("data:image/")) {
    el.classList.add("photo");
    el.classList.remove("pix");
    delete el.dataset.skin; // forca reaplicar o sprite se voltar para skin pixel
    el.style.backgroundImage = `url("${avatar}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.textContent = "";
    return;
  }

  const skinId = isPixelSkin(avatar) ? avatar : "default:mint";
  const sheet = sheetFor(skinId);
  if (el.dataset.skin === skinId) return;

  el.dataset.skin = skinId;
  el.classList.add("pix");
  el.classList.remove("photo");
  el.textContent = "";
  el.style.backgroundImage = `url("${sheet.url}")`;
  el.style.backgroundSize = `${COLS * FRAME_W * SPRITE_SCALE}px ${ROWS * FRAME_H * SPRITE_SCALE}px`;
  if (!el.dataset.dir) el.dataset.dir = "down";
  // offset aleatorio para as piscadas nao ficarem sincronizadas entre avatares
  if (!el.dataset.blinkSeed) el.dataset.blinkSeed = String(Math.floor(Math.random() * BLINK_PERIOD));
  paintPose(el);
}

// Direcao + estado de caminhada de um sprite do mapa.
export function setSpritePose(el, dir, walking) {
  if (!el || !el.classList.contains("pix")) {
    el?.classList.toggle("walking", walking);
    return;
  }
  const changed = el.dataset.dir !== dir || el.classList.contains("walking") !== walking;
  el.dataset.dir = dir;
  el.classList.toggle("walking", walking);
  if (!walking) el.dataset.phase = "0";
  if (changed) paintPose(el);
}

function paintPose(el) {
  const row = DIR_ROW[el.dataset.dir] ?? 0;
  const phase = Number(el.dataset.phase || 0);
  const frame = el.classList.contains("walking")
    ? WALK_CYCLE[phase % WALK_CYCLE.length]
    : el.dataset.blink === "1"
      ? 3
      : 0;
  el.style.backgroundPosition =
    `-${frame * FRAME_W * SPRITE_SCALE}px -${row * FRAME_H * SPRITE_SCALE}px`;
}

// Ticker global (~8 fps retro): avanca a caminhada de quem anda e faz quem
// esta parado piscar/respirar de vez em quando.
let tickerId = null;
let tick = 0;
export function startSpriteTicker() {
  if (tickerId) return;
  tickerId = window.setInterval(() => {
    tick += 1;
    document.querySelectorAll(".map-avatar.pix").forEach((el) => {
      if (el.classList.contains("walking")) {
        el.dataset.phase = String((Number(el.dataset.phase || 0) + 1) % WALK_CYCLE.length);
        paintPose(el);
        return;
      }
      const seed = Number(el.dataset.blinkSeed || 0);
      const blinking = (tick + seed) % BLINK_PERIOD < 2; // ~260ms de olhos fechados
      if ((el.dataset.blink === "1") !== blinking) {
        el.dataset.blink = blinking ? "1" : "0";
        paintPose(el);
      }
    });
  }, 130);
}

// Pinta os botoes de escolha de skin com o retrato pixelado correspondente.
export function paintSkinOptions() {
  document.querySelectorAll(".skin-option[data-avatar]").forEach((button) => {
    const url = portraitUrl(button.dataset.avatar);
    if (url) {
      button.style.backgroundImage = `url("${url}")`;
      button.style.backgroundSize = "cover";
      button.classList.add("pix");
    }
  });
}
