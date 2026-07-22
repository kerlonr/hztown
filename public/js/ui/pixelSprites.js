// Personagens em pixel art (estilo Gather Town) gerados em canvas.
// Cada skin tem uma paleta propria; o spritesheet (4 direcoes x 3 quadros)
// e desenhado uma unica vez por skin e cacheado como data URL.

export const FRAME_W = 16;
export const FRAME_H = 22;
export const SPRITE_SCALE = 3;

const COLS = 3; // 0 = parado, 1 e 2 = passos da caminhada
const ROWS = 4; // down, left, right, up
const DIR_ROW = { down: 0, left: 1, right: 2, up: 3 };
const WALK_CYCLE = [1, 0, 2, 0]; // pisa, junta, pisa com a outra perna, junta

export const PALETTES = {
  "default:mint": {
    shirt: "#34d399", shirtDark: "#0e9f6e", hair: "#3f2d23", hairDark: "#2a1d16",
    skin: "#f2c49b", skinDark: "#dca87c", pants: "#2f3c53", shoes: "#1b2233"
  },
  "default:blue": {
    shirt: "#60a5fa", shirtDark: "#2f6ded", hair: "#232f47", hairDark: "#161e30",
    skin: "#e8b488", skinDark: "#cf9767", pants: "#26324a", shoes: "#141a2b"
  },
  "default:rose": {
    shirt: "#fb7185", shirtDark: "#d84a63", hair: "#8a3f1d", hairDark: "#5e2a12",
    skin: "#f6d3b3", skinDark: "#e0b48c", pants: "#3d2b3f", shoes: "#241a2c"
  },
  "default:gold": {
    shirt: "#fbbf24", shirtDark: "#d99a10", hair: "#181d27", hairDark: "#0e1219",
    skin: "#b97a4b", skinDark: "#9c6238", pants: "#33404f", shoes: "#1a212b"
  },
  "default:violet": {
    shirt: "#a78bfa", shirtDark: "#8460ec", hair: "#d8b4fe", hairDark: "#b487e8",
    skin: "#f2c49b", skinDark: "#dca87c", pants: "#2c2642", shoes: "#1a1532"
  },
  "default:slate": {
    shirt: "#9fb0c3", shirtDark: "#6d8199", hair: "#e2e8f0", hairDark: "#b9c4d4",
    skin: "#e0a878", skinDark: "#c78d5c", pants: "#212a3b", shoes: "#111722"
  }
};

const EYES = "#141824";
const sheetCache = new Map();
const portraitCache = new Map();

export function isPixelSkin(avatar) {
  return Boolean(PALETTES[avatar]);
}

function px(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
}

// Desenha um quadro do personagem em (0,0). dir: down|right|up (left e espelhado).
function drawFrame(g, p, dir, frame) {
  const stepping = frame !== 0;
  const bob = stepping ? 1 : 0; // corpo "quica" 1px durante o passo

  // ----- pernas -----
  if (dir === "right") {
    // vista lateral: pernas em tesoura
    const frontFwd = frame === 1;
    if (!stepping) {
      px(g, 6, 15 + bob, 2, 5, p.pants);
      px(g, 8, 15 + bob, 2, 5, p.pants);
      px(g, 6, 19, 3, 2, p.shoes);
      px(g, 8, 19, 3, 2, p.shoes);
    } else {
      const front = frontFwd ? 9 : 5;
      const back = frontFwd ? 5 : 9;
      px(g, back, 15 + bob, 2, 4, p.pants);
      px(g, back, 18, 2, 2, p.shoes);
      px(g, front, 15 + bob, 2, 5, p.pants);
      px(g, front, 19, 3, 2, p.shoes);
    }
  } else {
    // frente/costas: pernas paralelas, uma levanta em cada passo
    const liftLeft = frame === 1 ? 1 : 0;
    const liftRight = frame === 2 ? 1 : 0;
    px(g, 5, 15 + bob, 2, 5 - liftLeft, p.pants);
    px(g, 9, 15 + bob, 2, 5 - liftRight, p.pants);
    px(g, 5, 19 - liftLeft, 2, 2, p.shoes);
    px(g, 9, 19 - liftRight, 2, 2, p.shoes);
  }

  // ----- torso -----
  if (dir === "right") {
    px(g, 5, 9 + bob, 6, 6, p.shirt);
    px(g, 5, 9 + bob, 1, 6, p.shirtDark);
    px(g, 5, 14 + bob, 6, 1, p.shirtDark);
    // braco visivel balanca com o passo
    const swing = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    px(g, 7 + swing, 10 + bob, 2, 3, p.shirtDark);
    px(g, 7 + swing, 13 + bob, 2, 2, p.skin);
  } else {
    px(g, 4, 9 + bob, 8, 6, p.shirt);
    px(g, 4, 14 + bob, 8, 1, p.shirtDark);
    px(g, 4, 9 + bob, 1, 6, p.shirtDark);
    // bracos
    const swingL = frame === 1 ? 1 : 0;
    const swingR = frame === 2 ? 1 : 0;
    px(g, 3, 10 + bob + swingL, 1, 3, p.shirtDark);
    px(g, 3, 13 + bob + swingL, 1, 2, p.skin);
    px(g, 12, 10 + bob + swingR, 1, 3, p.shirtDark);
    px(g, 12, 13 + bob + swingR, 1, 2, p.skin);
  }

  // ----- cabeca -----
  if (dir === "up") {
    // costas: so cabelo
    px(g, 4, 2 + bob, 8, 7, p.hair);
    px(g, 4, 2 + bob, 8, 2, p.hairDark);
    px(g, 3, 3 + bob, 1, 4, p.hair);
    px(g, 12, 3 + bob, 1, 4, p.hair);
  } else if (dir === "right") {
    px(g, 4, 3 + bob, 8, 6, p.skin);
    px(g, 4, 8 + bob, 8, 1, p.skinDark);
    // cabelo lateral cobrindo a nuca
    px(g, 4, 1 + bob, 8, 3, p.hair);
    px(g, 3, 2 + bob, 2, 6, p.hair);
    px(g, 4, 1 + bob, 8, 1, p.hairDark);
    // um olho so (perfil)
    px(g, 10, 6 + bob, 1, 1, EYES);
  } else {
    // frente
    px(g, 4, 3 + bob, 8, 6, p.skin);
    px(g, 4, 8 + bob, 8, 1, p.skinDark);
    px(g, 4, 1 + bob, 8, 2, p.hair);
    px(g, 4, 3 + bob, 8, 1, p.hair);
    px(g, 3, 2 + bob, 1, 4, p.hair);
    px(g, 12, 2 + bob, 1, 4, p.hair);
    px(g, 4, 1 + bob, 8, 1, p.hairDark);
    px(g, 6, 6 + bob, 1, 1, EYES);
    px(g, 9, 6 + bob, 1, 1, EYES);
  }
}

function buildSheet(skinId) {
  const p = PALETTES[skinId] || PALETTES["default:mint"];
  const canvas = document.createElement("canvas");
  canvas.width = COLS * FRAME_W;
  canvas.height = ROWS * FRAME_H;
  const g = canvas.getContext("2d");

  for (const [dir, row] of Object.entries(DIR_ROW)) {
    for (let frame = 0; frame < COLS; frame += 1) {
      g.save();
      g.translate(frame * FRAME_W, row * FRAME_H);
      if (dir === "left") {
        // esquerda = direita espelhada
        g.translate(FRAME_W, 0);
        g.scale(-1, 1);
        drawFrame(g, p, "right", frame);
      } else {
        drawFrame(g, p, dir, frame);
      }
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
    canvas.width = 10;
    canvas.height = 10;
    const g = canvas.getContext("2d");
    const p = PALETTES[skinId];
    g.fillStyle = p.shirtDark;
    g.fillRect(0, 0, 10, 10);
    // recorta cabeca do quadro frontal parado (x3..13, y0..10)
    g.drawImage(sheet.canvas, 3, 0, 10, 10, 0, 0, 10, 10);
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
  const frame = el.classList.contains("walking") ? WALK_CYCLE[phase % WALK_CYCLE.length] : 0;
  el.style.backgroundPosition =
    `-${frame * FRAME_W * SPRITE_SCALE}px -${row * FRAME_H * SPRITE_SCALE}px`;
}

// Ticker global: avanca os quadros de quem esta caminhando (8 fps ~ retro).
let tickerId = null;
export function startSpriteTicker() {
  if (tickerId) return;
  tickerId = window.setInterval(() => {
    document.querySelectorAll(".map-avatar.pix.walking").forEach((el) => {
      el.dataset.phase = String((Number(el.dataset.phase || 0) + 1) % WALK_CYCLE.length);
      paintPose(el);
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
