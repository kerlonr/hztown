// HZTown — orquestracao do cliente.
// Organizacao do arquivo:
//   1. Setup do mapa (tamanho do escritorio, cenario, rotulos, areas)
//   2. Boot da UI (drawer, janelas flutuantes, dock, dialogo de entrada)
//   3. Movimento com fisica (aceleracao + colisao) e presenca
//   4. Eventos de socket (presenca, chat, reacoes)
//   5. LiveKit (voz, camera, tela) e audio por proximidade
//   6. Renderizacao (mapa, listas, chips de voz, paineis)
//   7. Teste de microfone e preferencias (nome, skin, dispositivos)

import {
  Room,
  RoomEvent,
  Track
} from "/vendor/livekit-client/livekit-client.esm.mjs";
import { applyAvatar, fileToAvatarDataUrl } from "./js/ui/avatarRenderer.js";
import { renderChat, syncChatPanel } from "./js/features/chatPanel.js";
import {
  MIC_TEST_TIMEOUT_MS,
  PROXIMITY,
  SCREEN_OPTIONS,
  SCREEN_SHARE_ENCODING,
  audioOptions,
  cameraOptions
} from "./js/core/appConfig.js";
import {
  BOUNDS,
  MAPS,
  MAP_ORDER,
  activeMap,
  activeMapId,
  channelLabel,
  channelTarget,
  isBlocked,
  roomFromPosition,
  setActiveMap
} from "./js/core/mapGeometry.js";
import { els } from "./js/core/domElements.js";
import { hydrateStaticIcons, setIcon } from "./js/ui/iconRenderer.js";
import { notifyUserJoined } from "./js/ui/toastNotifications.js";
import { registerServiceWorker } from "./js/features/pwaRegistration.js";
import { initSettingsPanel } from "./js/features/settingsPanel.js";
import { state } from "./js/core/appState.js";
import { clamp } from "./js/shared/formattingValues.js";
import {
  applyMapSprite,
  paintSkinOptions,
  setSpritePose,
  startSpriteTicker
} from "./js/ui/pixelSprites.js";
import { paintMapScene } from "./js/ui/mapScene.js";
import { startSceneFx } from "./js/ui/sceneFx.js";
import { createWindow } from "./js/ui/windowManager.js";
import { initReactions } from "./js/features/reactions.js";
import { showChatBubble } from "./js/features/chatBubbles.js";

function currentAudioOptions() {
  return audioOptions(state.devices.audioInput);
}

function currentCameraOptions() {
  return cameraOptions(state.devices.quality, state.devices.videoInput);
}

// ---------------------------------------------------------------------------
// 1. Setup do mapa (tamanho do escritorio)
// ---------------------------------------------------------------------------

const mapEls = new Map(); // userId -> elemento .map-avatar
const remoteWalkTimers = new Map();
const localPos = { x: 50, y: 50 };
let areaButtons = [];

setActiveMap(localStorage.getItem("hz.map") || "medium");
applyMapToUi();

// Repinta cenario, rotulos e areas do mapa ativo e reposiciona o spawn local.
function applyMapToUi() {
  const map = activeMap();
  paintMapScene(els.floorCanvas, map);
  renderRoomLabels(map);
  renderAreaButtons(map);
  localPos.x = map.spawn.x;
  localPos.y = map.spawn.y;
  state.channel = roomFromPosition(localPos.x, localPos.y) || "lounge";
}

function renderRoomLabels(map) {
  els.roomLabels.innerHTML = "";
  for (const room of map.rooms) {
    const label = document.createElement("span");
    label.className = "room-label";
    label.textContent = room.label;
    label.style.left = `${room.rect.x1 + 1.5}%`;
    label.style.top = `${room.rect.y1 + 2.5}%`;
    label.style.color = room.carpet.tint;
    els.roomLabels.append(label);
  }
  const lounge = document.createElement("span");
  lounge.className = "room-label";
  lounge.textContent = map.lounge.label;
  lounge.style.left = `${map.lounge.labelAt.x}%`;
  lounge.style.top = `${map.lounge.labelAt.y}%`;
  lounge.style.color = map.lounge.tint;
  els.roomLabels.append(lounge);
}

function renderAreaButtons(map) {
  els.areaList.innerHTML = "";
  areaButtons = [];

  const entries = [
    ...map.rooms.map((room) => ({ id: room.id, label: room.label, hint: "Sala privada", icon: "#" })),
    { id: map.lounge.id, label: map.lounge.label, hint: "Area aberta (proximidade)", icon: "~" }
  ];

  for (const entry of entries) {
    const button = document.createElement("button");
    button.className = "channel";
    button.dataset.channel = entry.id;
    button.innerHTML = "";

    const icon = document.createElement("span");
    icon.className = "channel-icon";
    icon.textContent = entry.icon;

    const text = document.createElement("span");
    const name = document.createElement("span");
    name.textContent = entry.label;
    const hint = document.createElement("small");
    hint.textContent = entry.hint;
    text.append(name, hint);

    button.append(icon, text);
    button.addEventListener("click", () => {
      setChannel(entry.id);
      toggleDrawer(false);
    });
    els.areaList.append(button);
    areaButtons.push(button);
  }
  renderChannels();
}

// Cards de tamanho no dialogo de entrada (com preview real do mapa).
function buildSizePicker() {
  els.sizePicker.innerHTML = "";
  for (const id of MAP_ORDER) {
    const map = MAPS[id];
    const card = document.createElement("button");
    card.type = "button";
    card.className = "size-card";
    card.dataset.size = id;

    const preview = document.createElement("canvas");
    preview.className = "size-preview";
    paintMapScene(preview, map);

    const name = document.createElement("strong");
    name.textContent = map.label;
    const hint = document.createElement("small");
    hint.textContent = map.tagline;

    card.append(preview, name, hint);
    card.addEventListener("click", () => selectMap(id));
    els.sizePicker.append(card);
  }
  syncSizeSelection();
}

// Botoes compactos de troca no drawer (depois de entrar, troca recarregando).
function buildOfficeSwitcher() {
  els.officeSizes.innerHTML = "";
  for (const id of MAP_ORDER) {
    const map = MAPS[id];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "office-size";
    button.dataset.size = id;
    button.innerHTML = "";

    const name = document.createElement("strong");
    name.textContent = map.label;
    const hint = document.createElement("small");
    hint.textContent = map.tagline;
    button.append(name, hint);

    button.addEventListener("click", () => {
      if (id === activeMapId()) return;
      localStorage.setItem("hz.map", id);
      if (state.joined) {
        // trocar de escritorio = trocar de espaco; recarregar e o caminho seguro
        window.location.reload();
      } else {
        selectMap(id);
      }
    });
    els.officeSizes.append(button);
  }
  syncSizeSelection();
}

function selectMap(id) {
  if (state.joined) return; // depois de entrar, a troca e via reload
  setActiveMap(id);
  localStorage.setItem("hz.map", id);
  applyMapToUi();
  syncSizeSelection();
}

function syncSizeSelection() {
  document.querySelectorAll(".size-card, .office-size").forEach((button) => {
    button.classList.toggle("active", button.dataset.size === activeMapId());
  });
}

// ---------------------------------------------------------------------------
// 2. Boot da UI
// ---------------------------------------------------------------------------

const socket = io();

hydrateStaticIcons();
registerServiceWorker();
paintSkinOptions();
startSpriteTicker();
startSceneFx(els.fxCanvas);
buildSizePicker();
buildOfficeSwitcher();
initReactions({
  socket,
  bar: els.reactionBar,
  floorPlan: els.floorPlan,
  getMapEl: (id) => mapEls.get(id)
});

// Janelas flutuantes (arrastaveis, minimizaveis para uma barrinha, persistidas).
const chatWin = createWindow(els.chatWindow, {
  key: "chat",
  onToggle(open) {
    state.chatOpen = open;
    syncChatPanel();
    if (open) renderChat(true);
    if (open && chatWin.isVisible()) clearUnread();
  },
  onMinToggle(min) {
    if (!min) {
      clearUnread();
      renderChat(true);
    }
  }
});

const mediaWin = createWindow(els.mediaWindow, {
  key: "media",
  onToggle(open) {
    els.mediaButton.classList.toggle("active", open);
    els.mediaButton.setAttribute("aria-pressed", String(open));
  }
});

// --- Mensagens nao lidas (estilo Meet): badge no botao e na barrinha ---
let unreadCount = 0;

function chatIsVisible() {
  return chatWin.isVisible();
}

function bumpUnread() {
  unreadCount += 1;
  syncUnreadBadges();
}

function clearUnread() {
  unreadCount = 0;
  syncUnreadBadges();
}

function syncUnreadBadges() {
  const label = unreadCount > 99 ? "99+" : String(unreadCount);
  for (const badge of [els.chatBadge, els.chatWinBadge]) {
    badge.textContent = label;
    badge.hidden = unreadCount === 0;
  }
  els.chatWindow.classList.toggle("has-unread", unreadCount > 0);
}

// O chat comeca aberto apenas em telas largas; no celular o mapa domina.
if (state.chatOpen && window.innerWidth > 960) {
  chatWin.open();
} else {
  state.chatOpen = false;
  syncChatPanel();
}

// Drawer esquerdo (menu hamburguer).
function toggleDrawer(open = !els.sideDrawer.classList.contains("open")) {
  els.sideDrawer.classList.toggle("open", open);
  els.menuButton.classList.toggle("active", open);
  els.menuButton.setAttribute("aria-expanded", String(open));
}

els.menuButton.addEventListener("click", () => toggleDrawer());
els.drawerClose.addEventListener("click", () => toggleDrawer(false));

initSettingsPanel({
  onName: applyName,
  onAvatar: setAvatar,
  onAvatarFile: applyAvatarFile,
  onDeviceChange: applyDeviceChange,
  onQualityChange: applyQualityChange,
  onMirrorChange: applyMirror
});

if (state.name) {
  els.nameInput.value = state.name;
}

if (typeof els.joinDialog.showModal === "function") {
  els.joinDialog.showModal();
} else {
  els.joinDialog.setAttribute("open", "");
}

els.joinForm.addEventListener("submit", () => {
  const map = activeMap();
  const name = els.nameInput.value.trim() || "Convidado";
  state.name = name;
  state.joined = true;
  localStorage.setItem("gt.name", name);
  syncSelfPanel();
  socket.emit("space:join", {
    spaceId: map.spaceId,
    name,
    color: state.color,
    avatar: state.avatar,
    x: localPos.x,
    y: localPos.y,
    channel: state.channel
  });
  setTimeout(() => els.floorPlan.focus(), 50);
});

// Dock de chamada.
els.voiceButton.addEventListener("click", () => {
  if (state.livekitRoom) {
    leaveVoice();
  } else {
    joinVoice();
  }
});

els.muteButton.addEventListener("click", () => toggleMute());
els.cameraButton.addEventListener("click", () => toggleCamera());
els.screenButton.addEventListener("click", () => toggleScreenShare());

els.micTestButton.addEventListener("click", () => {
  if (state.micTest) {
    stopMicTest("Teste encerrado");
  } else {
    startMicTest();
  }
});

// Botoes de janelas (HUD direito). Se a janela esta minimizada, o botao
// restaura em vez de fechar (comportamento estilo Meet).
els.chatButton.addEventListener("click", () => {
  if (!state.chatOpen) {
    chatWin.open();
  } else if (chatWin.isMinimized()) {
    chatWin.restore();
  } else {
    chatWin.close();
  }
});

els.mediaButton.addEventListener("click", () => {
  if (!mediaWin.isOpen()) {
    mediaWin.open();
  } else if (mediaWin.isMinimized()) {
    mediaWin.restore();
  } else {
    mediaWin.close();
  }
});

// Atalhos globais estilo Meet: Ctrl+D alterna o mic, Ctrl+E alterna a camera.
document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || event.altKey || event.metaKey || !state.selfId) return;
  const key = event.key.toLowerCase();
  if (key === "d") {
    event.preventDefault();
    if (state.livekitRoom) toggleMute();
  } else if (key === "e") {
    event.preventDefault();
    toggleCamera();
  }
});

// Duplo clique num video/tela alterna tela cheia (estilo Meet).
els.mediaGrid.addEventListener("dblclick", (event) => {
  const tile = event.target.closest(".media-tile");
  if (!tile) return;
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    tile.requestFullscreen?.().catch(() => {});
  }
});

// Chat.
els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text || !state.selfId) return;

  socket.emit("chat:send", { channel: state.channel, text });
  els.chatInput.value = "";
});

// Skins do dialogo de entrada.
els.skinButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAvatar(button.dataset.avatar || "default:mint");
  });
});

els.avatarInput.addEventListener("change", async () => {
  const file = els.avatarInput.files?.[0];
  if (!file) return;

  try {
    const avatar = await fileToAvatarDataUrl(file);
    setAvatar(avatar);
  } catch (error) {
    alert(error.message || "Nao foi possivel usar essa imagem.");
  } finally {
    els.avatarInput.value = "";
  }
});

// ---------------------------------------------------------------------------
// 3. Movimento com fisica (aceleracao, atrito e colisao com o cenario)
// ---------------------------------------------------------------------------

const KEY_DIRECTIONS = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right"
};

const PHYSICS = {
  accel: 0.18, // fracao da velocidade-alvo incorporada por frame
  maxSpeed: 0.52, // % do mapa por frame (~31%/s)
  friction: 0.76, // fator de desaceleracao por frame sem input
  stopSpeed: 0.02 // abaixo disso consideramos parado
};
const EMIT_INTERVAL = 90; // ms entre updates de rede

const heldDirections = new Set();
const velocity = { x: 0, y: 0 };
let moveTarget = null;
let stallFrames = 0;
let moveRAF = null;
let lastMoveEmit = 0;
let facing = "down";

els.floorPlan.addEventListener("keydown", (event) => {
  const dir = KEY_DIRECTIONS[event.key];
  if (!dir || !state.selfId) return;

  event.preventDefault();
  moveTarget = null; // teclado cancela a caminhada por clique
  facing = dir;
  if (!heldDirections.has(dir)) {
    heldDirections.add(dir);
    startMoveLoop();
  }
});

els.floorPlan.addEventListener("keyup", (event) => {
  const dir = KEY_DIRECTIONS[event.key];
  if (dir) heldDirections.delete(dir);
});

window.addEventListener("blur", () => heldDirections.clear());

els.floorPlan.addEventListener("pointerdown", (event) => {
  if (!state.selfId) return;

  const rect = els.floorPlan.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  moveTarget = {
    x: clamp(x, BOUNDS.x1, BOUNDS.x2),
    y: clamp(y, BOUNDS.y1, BOUNDS.y2)
  };
  stallFrames = 0;
  startMoveLoop();
  els.floorPlan.focus();
});

function startMoveLoop() {
  if (moveRAF) return;
  let last = performance.now();

  const step = (now) => {
    const dt = Math.min(2.5, (now - last) / 16.67); // fator de frame (cap p/ travadas)
    last = now;

    // 1) direcao-alvo a partir do input (teclado ou clique)
    let tx = 0;
    let ty = 0;
    if (heldDirections.size) {
      if (heldDirections.has("up")) ty -= 1;
      if (heldDirections.has("down")) ty += 1;
      if (heldDirections.has("left")) tx -= 1;
      if (heldDirections.has("right")) tx += 1;
    } else if (moveTarget) {
      const dx = moveTarget.x - localPos.x;
      const dy = moveTarget.y - localPos.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1.2) {
        moveTarget = null; // chegou
      } else {
        tx = dx / distance;
        ty = dy / distance;
      }
    }

    // 2) fisica: acelera na direcao-alvo ou desacelera por atrito
    const norm = Math.hypot(tx, ty);
    if (norm > 0) {
      const blend = 1 - Math.pow(1 - PHYSICS.accel, dt);
      velocity.x += ((tx / norm) * PHYSICS.maxSpeed - velocity.x) * blend;
      velocity.y += ((ty / norm) * PHYSICS.maxSpeed - velocity.y) * blend;
    } else {
      const drag = Math.pow(PHYSICS.friction, dt);
      velocity.x *= drag;
      velocity.y *= drag;
    }

    // 3) integra por eixo com colisao (permite deslizar ao longo das paredes)
    const prevX = localPos.x;
    const prevY = localPos.y;
    const nx = clamp(localPos.x + velocity.x * dt, BOUNDS.x1, BOUNDS.x2);
    if (isBlocked(nx, localPos.y)) {
      velocity.x = 0;
    } else {
      localPos.x = nx;
    }
    const ny = clamp(localPos.y + velocity.y * dt, BOUNDS.y1, BOUNDS.y2);
    if (isBlocked(localPos.x, ny)) {
      velocity.y = 0;
    } else {
      localPos.y = ny;
    }

    const speed = Math.hypot(velocity.x, velocity.y);
    const movedDist = Math.hypot(localPos.x - prevX, localPos.y - prevY);

    // clique atras de uma parede: cancela o destino se ficou preso
    if (moveTarget && movedDist < 0.02 * dt) {
      stallFrames += dt;
      if (stallFrames > 26) moveTarget = null; // ~0.45s sem progresso
    } else {
      stallFrames = 0;
    }

    if (speed > PHYSICS.stopSpeed) {
      facing = Math.abs(velocity.x) > Math.abs(velocity.y)
        ? (velocity.x < 0 ? "left" : "right")
        : (velocity.y < 0 ? "up" : "down");
      applySelfPosition();
      setWalking(movedDist > 0.01);
      if (now - lastMoveEmit >= EMIT_INTERVAL) emitPosition(now);
    }

    if (heldDirections.size || moveTarget || speed > PHYSICS.stopSpeed) {
      moveRAF = requestAnimationFrame(step);
    } else {
      moveRAF = null;
      velocity.x = 0;
      velocity.y = 0;
      setWalking(false);
      emitPosition(now);
    }
  };

  moveRAF = requestAnimationFrame(step);
}

function setWalking(walking) {
  const el = mapEls.get(state.selfId);
  if (el) setSpritePose(el, facing, walking);
}

function applySelfPosition() {
  const self = state.users.get(state.selfId);
  if (self) {
    self.x = localPos.x;
    self.y = localPos.y;
  }
  const el = mapEls.get(state.selfId);
  if (el) {
    el.style.left = `${localPos.x}%`;
    el.style.top = `${localPos.y}%`;
  }
  els.proximityZone.style.left = `${localPos.x}%`;
  els.proximityZone.style.top = `${localPos.y}%`;
  scheduleProximity(false);
}

function emitPosition(now = performance.now()) {
  lastMoveEmit = now;
  // O canal de chat acompanha a area onde voce esta.
  const channel = chatChannelFromPosition(localPos.x, localPos.y);
  if (channel !== state.channel) {
    state.channel = channel;
    renderChannels();
    renderChat();
  }
  socket.emit("presence:update", { x: localPos.x, y: localPos.y, channel: state.channel });
}

// Clicar numa area do drawer faz o avatar caminhar ate la.
function setChannel(channel) {
  const target = channelTarget(channel);
  if (!target || !state.selfId) return;
  moveTarget = { x: target.x, y: target.y };
  stallFrames = 0;
  startMoveLoop();
  els.floorPlan.focus();
}

function chatChannelFromPosition(x, y) {
  return roomFromPosition(x, y) || "lounge";
}

// ---------------------------------------------------------------------------
// 4. Eventos de socket
// ---------------------------------------------------------------------------

socket.on("space:ready", ({ selfId, users, messages = [] }) => {
  state.selfId = selfId;
  state.users = new Map(users.map((user) => [user.id, user]));
  state.messages = messages;
  const self = state.users.get(selfId);
  if (self) {
    localPos.x = self.x;
    localPos.y = self.y;
    state.channel = chatChannelFromPosition(localPos.x, localPos.y);
  }
  syncSelfPanel();
  render();
});

socket.on("presence:joined", (user) => {
  state.users.set(user.id, user);
  render();
  notifyUserJoined(user);
});

socket.on("presence:updated", (user) => {
  const previous = state.users.get(user.id);
  state.users.set(user.id, user);
  render();
  animateRemoteWalk(user, previous);
});

socket.on("presence:self", (user) => {
  // O cliente e a autoridade sobre a propria posicao e canal; preservamos o estado local.
  state.users.set(state.selfId, {
    ...user,
    x: localPos.x,
    y: localPos.y,
    channel: state.channel
  });
});

socket.on("presence:left", (id) => {
  state.users.delete(id);
  clearTimeout(remoteWalkTimers.get(id));
  remoteWalkTimers.delete(id);
  removeParticipantMedia(id);
  render();
});

socket.on("chat:message", (message) => {
  state.messages.push(message);
  if (state.messages.length > 120) {
    state.messages.splice(0, state.messages.length - 120);
  }
  renderChat(true);
  showChatBubble(mapEls.get(message.userId), message.userId, message.text);
  // conta como nao lida se o chat nao esta visivel (fechado ou na barrinha)
  if (message.userId !== state.selfId && !chatIsVisible()) {
    bumpUnread();
  }
});

// Anima o sprite de quem se move remotamente: direcao pelo delta de posicao
// e um timer curto que devolve a pose parada quando os updates cessam.
function animateRemoteWalk(user, previous) {
  if (!previous || user.id === state.selfId) return;

  const dx = user.x - previous.x;
  const dy = user.y - previous.y;
  if (Math.hypot(dx, dy) < 0.05) return;

  const el = mapEls.get(user.id);
  if (!el) return;

  const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
  setSpritePose(el, dir, true);
  clearTimeout(remoteWalkTimers.get(user.id));
  remoteWalkTimers.set(
    user.id,
    setTimeout(() => {
      const mapEl = mapEls.get(user.id);
      if (mapEl) setSpritePose(mapEl, dir, false);
      remoteWalkTimers.delete(user.id);
    }, 260)
  );
}

// ---------------------------------------------------------------------------
// 5. LiveKit (voz, camera, tela) e audio por proximidade
// ---------------------------------------------------------------------------

async function joinVoice() {
  if (!state.selfId || state.busy) return;

  setBusy(true, "Conectando ao LiveKit...");
  try {
    const room = await connectLiveKitRoom();
    state.muted = false;
    await room.localParticipant.setMicrophoneEnabled(true, currentAudioOptions());
    socket.emit("presence:update", { inVoice: true, muted: false, channel: state.channel });
    syncSelfPanel();
    render();
  } catch (error) {
    const message = error?.message || "Nao foi possivel entrar na chamada LiveKit.";
    alert(message);
    console.error(error);
    await disconnectLiveKitRoom();
  } finally {
    setBusy(false);
  }
}

async function leaveVoice() {
  if (state.busy) return;

  setBusy(true, "Encerrando chamada...");
  await disconnectLiveKitRoom();
  socket.emit("presence:update", { inVoice: false, muted: false });
  syncSelfPanel();
  render();
  setBusy(false);
}

async function toggleMute() {
  if (!state.livekitRoom || state.busy) return;

  const nextMuted = !state.muted;
  setBusy(true, nextMuted ? "Mutando..." : "Abrindo microfone...");
  try {
    await state.livekitRoom.localParticipant.setMicrophoneEnabled(!nextMuted, currentAudioOptions());
    state.muted = nextMuted;
    socket.emit("presence:update", { muted: state.muted });
    syncSelfPanel();
    render();
  } catch (error) {
    console.error("Falha ao alternar microfone", error);
  } finally {
    setBusy(false);
  }
}

async function toggleCamera() {
  if (state.busy) return;
  if (!state.livekitRoom) {
    await joinVoice();
    if (!state.livekitRoom) return;
  }

  const enableCamera = !state.cameraOn;
  setBusy(true, enableCamera ? "Abrindo camera..." : "Fechando camera...");
  try {
    await state.livekitRoom.localParticipant.setCameraEnabled(enableCamera, currentCameraOptions());
    state.cameraOn = enableCamera;
    syncSelfPanel();
    renderMediaEmptyState();
  } catch (error) {
    alert("Nao foi possivel acessar a camera. Verifique a permissao do navegador.");
    console.error(error);
  } finally {
    setBusy(false);
  }
}

async function toggleScreenShare() {
  if (state.busy) return;
  if (!state.livekitRoom) {
    await joinVoice();
    if (!state.livekitRoom) return;
  }

  const enableScreen = !state.screenOn;
  setBusy(true, enableScreen ? "Compartilhando tela..." : "Parando tela...");
  try {
    await state.livekitRoom.localParticipant.setScreenShareEnabled(
      enableScreen,
      SCREEN_OPTIONS,
      {
        screenShareEncoding: SCREEN_SHARE_ENCODING,
        dtx: true,
        red: true
      }
    );
    state.screenOn = enableScreen;
    syncSelfPanel();
    renderMediaEmptyState();
  } catch (error) {
    if (error?.name !== "NotAllowedError") {
      alert("Nao foi possivel iniciar o compartilhamento de tela.");
      console.error(error);
    }
  } finally {
    setBusy(false);
  }
}

async function connectLiveKitRoom() {
  const roomName = activeMap().livekitRoom;
  if (state.livekitRoom && state.livekitRoomName === roomName) {
    return state.livekitRoom;
  }

  clearMediaElements();

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    audioCaptureDefaults: currentAudioOptions(),
    videoCaptureDefaults: currentCameraOptions(),
    publishDefaults: {
      videoCodec: "vp8",
      simulcast: true,
      dtx: true,
      red: true,
      stopMicTrackOnMute: true
    }
  });

  bindLiveKitRoom(room);
  state.livekitRoom = room;
  state.livekitRoomName = roomName;

  const credentials = await getLiveKitCredentials(roomName);
  await room.connect(credentials.url, credentials.token, {
    autoSubscribe: true,
    maxRetries: 2,
    peerConnectionTimeout: 15000,
    websocketTimeout: 15000
  });
  mountExistingTracks(room);
  setConnectionStatus("No espaco — audio por proximidade");
  updateProximityAudio();
  return room;
}

async function disconnectLiveKitRoom({ resetControls = true } = {}) {
  const room = state.livekitRoom;
  state.livekitRoom = null;
  state.livekitRoomName = null;

  if (room) {
    await room.disconnect();
  }

  clearMediaElements();
  state.speakingIds.clear();
  syncSpeakingIndicators();

  if (resetControls) {
    state.muted = false;
    state.cameraOn = false;
    state.screenOn = false;
  }
  setConnectionStatus("LiveKit pronto");
  renderMediaEmptyState();
}

function bindLiveKitRoom(room) {
  room
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      mountMediaTrack(track, publication, participant);
    })
    .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      removeMediaTrack(track, publication, participant);
    })
    .on(RoomEvent.TrackUnpublished, (publication, participant) => {
      removeMediaTrack(publication.track, publication, participant);
    })
    .on(RoomEvent.LocalTrackPublished, (publication, participant) => {
      updateLocalMediaState(publication, true);
      if (publication.track) {
        mountMediaTrack(publication.track, publication, participant, true);
      }
      syncSelfPanel();
    })
    .on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
      updateLocalMediaState(publication, false);
      removeMediaTrack(publication.track, publication, participant);
      syncSelfPanel();
    })
    .on(RoomEvent.TrackMuted, () => {
      renderMediaLabels();
    })
    .on(RoomEvent.TrackUnmuted, () => {
      renderMediaLabels();
    })
    .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      state.speakingIds = new Set(speakers.map((participant) => participant.identity));
      syncSpeakingIndicators();
    })
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      removeParticipantMedia(participant.identity);
      state.speakingIds.delete(participant.identity);
      syncSpeakingIndicators();
    })
    .on(RoomEvent.Reconnecting, () => {
      setConnectionStatus("Reconectando LiveKit...");
    })
    .on(RoomEvent.Reconnected, () => {
      setConnectionStatus("No espaco — audio por proximidade");
      updateProximityAudio();
    })
    .on(RoomEvent.Disconnected, () => {
      if (state.livekitRoom !== room) return;

      state.livekitRoom = null;
      state.livekitRoomName = null;
      state.cameraOn = false;
      state.screenOn = false;
      state.muted = false;
      state.speakingIds.clear();
      clearMediaElements();
      socket.emit("presence:update", { inVoice: false, muted: false });
      syncSelfPanel();
      render();
    });
}

async function getLiveKitCredentials(room) {
  const params = new URLSearchParams({
    room,
    identity: state.selfId,
    name: state.name || "Convidado"
  });
  const response = await fetch(`/api/livekit-token?${params}`);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "LiveKit nao configurado.");
  }

  return data;
}

function mountExistingTracks(room) {
  room.localParticipant.trackPublications.forEach((publication) => {
    if (publication.track) {
      updateLocalMediaState(publication, true);
      mountMediaTrack(publication.track, publication, room.localParticipant, true);
    }
  });

  room.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((publication) => {
      if (publication.isSubscribed && publication.track) {
        mountMediaTrack(publication.track, publication, participant);
      }
    });
  });

  renderMediaEmptyState();
}

function mountMediaTrack(track, publication, participant, forceLocal = false) {
  if (!track) return;

  const key = mediaKey(participant, publication);
  if (state.mediaElements.has(key)) {
    removeMediaTrack(track, publication, participant);
  }

  const isLocal = forceLocal || participant.identity === state.selfId;
  const identity = participant.identity;

  if (track.kind === Track.Kind.Audio) {
    if (isLocal) return;

    const audio = track.attach();
    audio.autoplay = true;
    audio.playsInline = true;
    audio.dataset.mediaKey = key;
    els.audioMount.append(audio);
    if (state.devices.audioOutput && audio.setSinkId) {
      audio.setSinkId(state.devices.audioOutput).catch(() => {});
    }
    state.mediaElements.set(key, { key, identity, kind: "audio", track, element: audio });
    updateProximityAudio();
    return;
  }

  const tile = document.createElement("article");
  tile.className = `media-tile ${isLocal ? "local" : ""}`;
  tile.dataset.mediaKey = key;
  tile.dataset.identity = participant.identity;
  tile.dataset.source = publication.source || "video";

  const video = track.attach();
  video.className = "media-video";
  video.autoplay = true;
  video.playsInline = true;
  video.muted = isLocal;
  if (isLocal && publication.source === Track.Source.Camera && state.devices.mirror) {
    video.classList.add("mirrored");
  }

  tile.append(video, mediaCaption(participant, publication, isLocal));
  els.mediaGrid.append(tile);
  state.mediaElements.set(key, { key, identity, kind: "video", track, tile, element: video });
  renderMediaEmptyState();
  updateProximityAudio();
  // video novo -> janela aparece (e sai da barrinha) sozinha, estilo Meet
  mediaWin.open();
  mediaWin.restore();
}

function removeMediaTrack(track, publication, participant) {
  const key = mediaKey(participant, publication);
  const mounted = state.mediaElements.get(key);

  if (mounted) {
    mounted.track?.detach().forEach((element) => element.remove());
    mounted.tile?.remove();
    mounted.element?.remove();
    state.mediaElements.delete(key);
  } else {
    track?.detach().forEach((element) => element.remove());
  }

  renderMediaEmptyState();
}

function removeParticipantMedia(identity) {
  for (const [key, mounted] of state.mediaElements) {
    if (!key.startsWith(`${identity}:`)) continue;
    mounted.track?.detach().forEach((element) => element.remove());
    mounted.tile?.remove();
    mounted.element?.remove();
    state.mediaElements.delete(key);
  }
  renderMediaEmptyState();
}

function clearMediaElements() {
  for (const mounted of state.mediaElements.values()) {
    mounted.track?.detach().forEach((element) => element.remove());
    mounted.tile?.remove();
    mounted.element?.remove();
  }
  state.mediaElements.clear();
  els.mediaGrid.innerHTML = "";
  els.audioMount.innerHTML = "";
}

function mediaCaption(participant, publication, isLocal) {
  const caption = document.createElement("div");
  caption.className = "media-caption";

  const name = document.createElement("strong");
  name.textContent = isLocal ? `${participant.name || state.name} (voce)` : participant.name || "Convidado";

  const source = document.createElement("span");
  source.textContent = sourceLabel(publication.source);

  caption.append(name, source);
  return caption;
}

function renderMediaLabels() {
  for (const [, mounted] of state.mediaElements) {
    const tile = mounted.tile;
    if (!tile) continue;

    const participant = state.livekitRoom?.getParticipantByIdentity(tile.dataset.identity);
    const publication = participant?.getTrackPublication(tile.dataset.source);
    const caption = tile.querySelector(".media-caption span");
    if (caption && publication) {
      caption.textContent = publication.isMuted
        ? `${sourceLabel(publication.source)} pausado`
        : sourceLabel(publication.source);
    }
  }
}

function renderMediaEmptyState() {
  // Conta apenas tiles de video visiveis (os escondidos por proximidade nao contam).
  const hasVideo = Array.from(state.mediaElements.values()).some(
    (item) => item.kind === "video" && item.tile && item.tile.style.display !== "none"
  );
  els.mediaGrid.classList.toggle("empty", !hasVideo);

  if (!hasVideo && !els.mediaGrid.querySelector(".media-empty")) {
    const empty = document.createElement("div");
    empty.className = "media-empty";
    empty.innerHTML =
      "<strong>Sem video por perto</strong>" +
      "<small>Aproxime-se de alguem com camera ligada ou abra a sua.</small>";
    els.mediaGrid.append(empty);
  } else if (hasVideo) {
    els.mediaGrid.querySelector(".media-empty")?.remove();
  }
}

function updateLocalMediaState(publication, enabled) {
  if (publication.source === Track.Source.Camera) {
    state.cameraOn = enabled;
  }
  if (publication.source === Track.Source.ScreenShare) {
    state.screenOn = enabled;
  }
}

function mediaKey(participant, publication) {
  const identity = participant?.identity || state.selfId || "local";
  const source = publication?.source || publication?.trackName || publication?.trackSid || "track";
  return `${identity}:${source}`;
}

function sourceLabel(source) {
  if (source === Track.Source.Camera) return "Camera";
  if (source === Track.Source.ScreenShare) return "Tela";
  if (source === Track.Source.ScreenShareAudio) return "Audio da tela";
  return "Midia";
}

// Volume relativo (0..1) de um usuario para mim: salas privadas isolam, area aberta usa distancia.
function audibility(user, myRoom) {
  const otherRoom = roomFromPosition(user.x, user.y);
  if (myRoom || otherRoom) {
    return myRoom && otherRoom === myRoom ? 1 : 0;
  }
  const dx = (user.x - localPos.x) * PROXIMITY.xScale;
  const dy = user.y - localPos.y;
  const distance = Math.hypot(dx, dy);
  return clamp((PROXIMITY.far - distance) / (PROXIMITY.far - PROXIMITY.near), 0, 1);
}

function setMountedVolume(mounted, level) {
  if (typeof mounted.track?.setVolume === "function") {
    mounted.track.setVolume(level);
  } else if (mounted.element) {
    mounted.element.volume = level;
  }
}

// Atualiza anel de proximidade no mapa + volume do audio + visibilidade do video.
function updateProximityAudio() {
  const myRoom = roomFromPosition(localPos.x, localPos.y);

  for (const [id, el] of mapEls) {
    if (id === state.selfId) continue;
    const user = state.users.get(id);
    el.classList.toggle("near", user ? audibility(user, myRoom) > 0 : false);
  }

  if (!state.livekitRoom) return;

  for (const mounted of state.mediaElements.values()) {
    const id = mounted.identity;
    if (!id || id === state.selfId) continue;
    const user = state.users.get(id);
    const level = user ? audibility(user, myRoom) : 1;
    if (mounted.kind === "audio") {
      setMountedVolume(mounted, level);
    } else if (mounted.kind === "video" && mounted.tile) {
      mounted.tile.style.display = level > 0 ? "" : "none";
    }
  }
  renderMediaEmptyState();
}

let lastProxAt = 0;
function scheduleProximity(force) {
  const now = performance.now();
  if (!force && now - lastProxAt < 80) return;
  lastProxAt = now;
  updateProximityAudio();
}

function setBusy(busy, label = "") {
  state.busy = busy;
  els.voiceButton.disabled = busy && !state.livekitRoom;
  els.muteButton.disabled = busy || !state.livekitRoom;
  els.micTestButton.disabled = busy;
  els.cameraButton.disabled = busy || !state.selfId;
  els.screenButton.disabled = busy || !state.selfId;
  if (label) {
    setConnectionStatus(label);
  } else if (state.livekitRoom) {
    setConnectionStatus("No espaco — audio por proximidade");
  } else {
    setConnectionStatus("LiveKit pronto");
  }
}

function setConnectionStatus(label) {
  els.connectionStatus.textContent = label;
}

// ---------------------------------------------------------------------------
// 6. Renderizacao
// ---------------------------------------------------------------------------

function render() {
  renderChannels();
  renderOnlineList();
  renderVoiceStrip();
  renderMap();
  renderChat();
  syncSelfPanel();
}

function renderChannels() {
  areaButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === state.channel);
  });
  els.chatChannelLabel.textContent = channelLabel(state.channel);
}

function renderOnlineList() {
  els.onlineList.innerHTML = "";
  for (const user of state.users.values()) {
    const row = document.createElement("div");
    row.className = "online-row";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.dataset.identity = user.id;
    applyAvatar(avatar, user);

    const name = document.createElement("strong");
    name.textContent = user.name;

    const voiceDot = document.createElement("span");
    voiceDot.className = `voice-dot ${user.inVoice ? "active" : ""}`;

    row.append(avatar, name, voiceDot);
    els.onlineList.append(row);
  }
}

// Chips de "quem voce ouve agora" flutuando no topo do mapa.
function renderVoiceStrip() {
  els.voiceTiles.innerHTML = "";
  const myRoom = roomFromPosition(localPos.x, localPos.y);
  const users = Array.from(state.users.values()).filter(
    (user) => user.inVoice && user.id !== state.selfId && audibility(user, myRoom) > 0
  );

  els.voiceTiles.classList.toggle("empty", users.length === 0);

  for (const user of users) {
    const tile = document.createElement("div");
    tile.className = "voice-tile";
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.dataset.identity = user.id;
    applyAvatar(avatar, user);

    const label = document.createElement("span");
    label.textContent = `${user.name}${user.muted ? " - mutado" : ""}`;

    tile.append(avatar, label);
    els.voiceTiles.append(tile);
  }
}

// Atualiza avatares no lugar (sem recriar o DOM) para movimento fluido e sem flicker.
function renderMap() {
  for (const user of state.users.values()) {
    const isSelf = user.id === state.selfId;
    let el = mapEls.get(user.id);

    if (!el) {
      el = document.createElement("div");
      el.className = `map-avatar ${isSelf ? "self" : ""}`;
      el.dataset.identity = user.id;
      els.avatarsLayer.append(el);
      mapEls.set(user.id, el);
    }

    el.dataset.name = isSelf ? `Voce, ${user.name}` : user.name;
    const x = isSelf ? localPos.x : user.x;
    const y = isSelf ? localPos.y : user.y;
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    applyMapSprite(el, user);
    el.classList.toggle("speaking", state.speakingIds.has(user.id));
  }

  // Remove avatares de quem saiu.
  for (const [id, el] of mapEls) {
    if (!state.users.has(id)) {
      el.remove();
      mapEls.delete(id);
    }
  }

  els.proximityZone.style.left = `${localPos.x}%`;
  els.proximityZone.style.top = `${localPos.y}%`;
  scheduleProximity(true);
}

function syncSelfPanel() {
  const name = state.name || "Convidado";
  els.selfName.textContent = name;
  if (state.selfId) {
    els.selfAvatar.dataset.identity = state.selfId;
  }
  applyAvatar(els.selfAvatar, { name, color: state.color, avatar: state.avatar });
  els.selfStatus.textContent = state.livekitRoom
    ? state.muted
      ? "em chamada, mutado"
      : state.cameraOn
        ? "em chamada, camera ativa"
        : "em chamada"
    : "fora da chamada";
  const voiceLabel = state.livekitRoom ? "Sair da voz" : "Entrar na voz";
  els.voiceButton.setAttribute("aria-label", voiceLabel);
  els.voiceButton.title = voiceLabel;
  els.voiceButton.classList.toggle("live", Boolean(state.livekitRoom));
  els.muteButton.disabled = state.busy || !state.livekitRoom;
  els.micTestButton.disabled = state.busy;
  els.cameraButton.disabled = state.busy || !state.selfId;
  els.screenButton.disabled = state.busy || !state.selfId;
  setIcon(els.voiceIcon, state.livekitRoom ? "phone-off" : "phone");
  setIcon(els.muteIcon, state.muted ? "mic-off" : "mic");
  setIcon(els.cameraIcon, state.cameraOn ? "video" : "video-off");
  setIcon(els.screenIcon, state.screenOn ? "monitor" : "monitor-off");
  els.muteButton.classList.toggle("active", state.livekitRoom && !state.muted);
  els.muteButton.classList.toggle("inactive", state.livekitRoom && state.muted);
  els.cameraButton.classList.toggle("active", state.cameraOn);
  els.cameraButton.classList.toggle("inactive", state.livekitRoom && !state.cameraOn);
  els.screenButton.classList.toggle("active", state.screenOn);
  syncSkinPicker();
  syncChatPanel();
  syncSpeakingIndicators();
}

function syncSpeakingIndicators() {
  document.querySelectorAll(".avatar[data-identity], .map-avatar[data-identity]").forEach((avatar) => {
    avatar.classList.toggle("speaking", state.speakingIds.has(avatar.dataset.identity));
  });
}

// ---------------------------------------------------------------------------
// 7. Teste de microfone e preferencias
// ---------------------------------------------------------------------------

async function startMicTest() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMicStatus("Seu navegador nao liberou teste de microfone.", 0);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: currentAudioOptions() });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 512;
    source.connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    const startedAt = Date.now();

    state.micTest = {
      stream,
      audioContext,
      analyser,
      source,
      animationFrame: null,
      timeout: null,
      peak: 0
    };

    els.micTestButton.classList.add("active");
    els.micTestButton.textContent = "Parar teste";
    setMicStatus("Fale agora...", 0);

    const tick = () => {
      if (!state.micTest) return;

      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        sum += value * value;
      }

      const rms = Math.sqrt(sum / samples.length);
      const level = clamp(rms * 5, 0, 1);
      state.micTest.peak = Math.max(state.micTest.peak, level);

      const elapsed = Date.now() - startedAt;
      const status =
        level > 0.18
          ? "Mic captando voz"
          : elapsed > 1800 && state.micTest.peak < 0.08
            ? "Entrada baixa ou silencio"
            : "Fale agora...";

      setMicStatus(status, level);
      state.micTest.animationFrame = requestAnimationFrame(tick);
    };

    tick();
    state.micTest.timeout = setTimeout(() => {
      const status = state.micTest?.peak > 0.12 ? "Mic funcionando" : "Mic muito baixo";
      stopMicTest(status);
    }, MIC_TEST_TIMEOUT_MS);
  } catch (error) {
    const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
    setMicStatus(denied ? "Permissao do mic negada" : "Nao consegui acessar o mic", 0);
    console.error("Falha ao testar microfone", error);
  } finally {
    syncSelfPanel();
  }
}

function stopMicTest(status = "Teste encerrado") {
  const micTest = state.micTest;
  state.micTest = null;

  if (micTest?.animationFrame) {
    cancelAnimationFrame(micTest.animationFrame);
  }
  if (micTest?.timeout) {
    clearTimeout(micTest.timeout);
  }
  micTest?.source?.disconnect();
  micTest?.stream?.getTracks().forEach((track) => track.stop());
  micTest?.audioContext?.close();

  els.micTestButton.classList.remove("active");
  els.micTestButton.textContent = "Testar microfone";
  setMicStatus(status, 0);
  syncSelfPanel();
}

function setMicStatus(status, level) {
  els.micStatus.textContent = status;
  els.micMeterBar.style.width = `${Math.round(level * 100)}%`;
  els.micMeter.classList.toggle("live", level > 0.12);
}

function setAvatar(avatar) {
  state.avatar = avatar;
  localStorage.setItem("gt.avatar", avatar);
  const self = state.users.get(state.selfId);
  if (self) self.avatar = avatar;
  syncSelfPanel();

  if (state.selfId) {
    socket.emit("presence:update", { avatar });
    render();
  }
}

function syncSkinPicker() {
  els.skinButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.avatar === state.avatar);
  });
}

function applyName(name) {
  const clean = name.trim().slice(0, 28);
  if (!clean) return;
  state.name = clean;
  localStorage.setItem("gt.name", clean);
  const self = state.users.get(state.selfId);
  if (self) self.name = clean;
  syncSelfPanel();
  if (state.selfId) {
    socket.emit("presence:update", { name: clean });
    render();
  }
}

async function applyAvatarFile(file) {
  try {
    const avatar = await fileToAvatarDataUrl(file);
    setAvatar(avatar);
  } catch (error) {
    alert(error.message || "Nao foi possivel usar essa imagem.");
  }
}

async function applyDeviceChange(kind, deviceId) {
  if (kind === "audiooutput") {
    await applyAudioOutput(deviceId);
    return;
  }
  if (!state.livekitRoom || !deviceId) return;
  await state.livekitRoom.switchActiveDevice(kind, deviceId);
}

async function applyAudioOutput(deviceId) {
  if (state.livekitRoom && deviceId) {
    try {
      await state.livekitRoom.switchActiveDevice("audiooutput", deviceId);
      return;
    } catch (error) {
      console.warn("Falha ao trocar saida pelo LiveKit", error);
    }
  }
  // Fallback: aplica o sink diretamente nos elementos de audio montados.
  for (const mounted of state.mediaElements.values()) {
    if (mounted.kind === "audio" && deviceId && mounted.element?.setSinkId) {
      mounted.element.setSinkId(deviceId).catch(() => {});
    }
  }
}

async function applyQualityChange() {
  if (state.busy || !state.livekitRoom || !state.cameraOn) return;
  setBusy(true, "Ajustando qualidade...");
  try {
    await state.livekitRoom.localParticipant.setCameraEnabled(false);
    await state.livekitRoom.localParticipant.setCameraEnabled(true, currentCameraOptions());
    state.cameraOn = true;
  } catch (error) {
    console.error("Falha ao ajustar qualidade", error);
  } finally {
    setBusy(false);
  }
}

function applyMirror() {
  const mirror = state.devices.mirror;
  document
    .querySelectorAll('.media-tile.local[data-source="camera"] .media-video')
    .forEach((video) => video.classList.toggle("mirrored", mirror));
}
