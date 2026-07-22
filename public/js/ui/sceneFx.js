// Camada de vida do cenario: um segundo canvas transparente sobre o mapa,
// redesenhado a ~5 fps com pequenas animacoes pixel art:
// - vapor subindo da maquina de cafe;
// - LEDs dos racks de servidor piscando;
// - telas de monitor tremulando de leve;
// - tela do arcade ciclando cores;
// - letreiro neon pulsando.
// Le o mapa ativo a cada tick, entao funciona para qualquer escritorio.

import { activeMap } from "../core/mapGeometry.js";
import {
  SCENE_H,
  SCENE_W,
  arcadeScreen,
  kitchenSteamPoint,
  monitorScreens,
  neonArea,
  rackLeds
} from "./mapScene.js";

const TICK_MS = 200;
const ARCADE_COLORS = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24"];

let timer = null;
let tick = 0;

export function startSceneFx(canvas) {
  if (!canvas || timer) return;
  canvas.width = SCENE_W;
  canvas.height = SCENE_H;
  const g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  timer = window.setInterval(() => {
    tick += 1;
    g.clearRect(0, 0, SCENE_W, SCENE_H);
    for (const item of activeMap().furniture) {
      switch (item.type) {
        case "kitchen":
          drawSteam(g, kitchenSteamPoint(item));
          break;
        case "coffee":
          drawSteam(g, { x: xOf(item) + 3, y: yOf(item) + 1 });
          break;
        case "server-rack":
          drawLeds(g, rackLeds(item), item.x);
          break;
        case "desk":
          drawMonitorFlicker(g, monitorScreens(item), item.x + item.y);
          break;
        case "arcade":
          drawArcade(g, arcadeScreen(item));
          break;
        case "neon":
          drawNeonPulse(g, neonArea(item));
          break;
      }
    }
  }, TICK_MS);
}

export function stopSceneFx() {
  if (timer) {
    window.clearInterval(timer);
    timer = null;
  }
}

const xOf = (item) => Math.round((item.x / 100) * SCENE_W);
const yOf = (item) => Math.round((item.y / 100) * SCENE_H);

// Tres particulas de vapor sobem em loop, defasadas entre si.
function drawSteam(g, point) {
  for (let i = 0; i < 3; i += 1) {
    const phase = (tick + i * 3) % 9;
    if (phase > 6) continue; // pausa entre baforadas
    const rise = phase * 2;
    const alpha = Math.max(0, 0.55 - phase * 0.09);
    g.fillStyle = `rgba(226, 232, 240, ${alpha.toFixed(2)})`;
    const wobble = phase % 2 === 0 ? 0 : i % 2 === 0 ? 1 : -1;
    g.fillRect(point.x + i * 2 - 2 + wobble, point.y - 3 - rise, 2, 2);
  }
}

// LEDs alternam verde/ambar/apagado num padrao pseudo-aleatorio estavel.
function drawLeds(g, leds, seed) {
  leds.forEach((led, index) => {
    const phase = (tick + index * 3 + Math.floor(seed)) % 8;
    const color = phase < 3 ? "#34d399" : phase < 5 ? "#fbbf24" : "#173326";
    g.fillStyle = color;
    g.fillRect(led.x, led.y, 2, 2);
  });
}

// De vez em quando um monitor "atualiza" (fica mais claro por um tick).
function drawMonitorFlicker(g, screens, seed) {
  screens.forEach((screen, index) => {
    const phase = (tick + index * 5 + Math.floor(seed * 3)) % 24;
    if (phase === 0) {
      g.fillStyle = "rgba(255, 255, 255, 0.35)";
      g.fillRect(screen.x, screen.y, screen.w, screen.h);
    } else if (phase === 12) {
      g.fillStyle = "rgba(14, 165, 233, 0.35)";
      g.fillRect(screen.x, screen.y, screen.w, screen.h);
    }
  });
}

function drawArcade(g, screen) {
  const color = ARCADE_COLORS[Math.floor(tick / 3) % ARCADE_COLORS.length];
  g.fillStyle = color;
  g.fillRect(screen.x, screen.y, screen.w, screen.h);
  // "sprite" andando na tela
  g.fillStyle = "#0f172a";
  const px = screen.x + (tick % Math.max(1, screen.w - 2));
  g.fillRect(px, screen.y + Math.floor(screen.h / 2), 2, 2);
}

function drawNeonPulse(g, area) {
  const pulse = 0.10 + 0.08 * Math.sin(tick / 2);
  g.fillStyle = `rgba(244, 114, 182, ${pulse.toFixed(2)})`;
  g.fillRect(area.x - 2, area.y - 2, area.w + 4, area.h + 4);
}
