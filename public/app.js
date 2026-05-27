const socket = io();

const CHANNELS = {
  team: { label: "Team", x: 30, y: 42 },
  daily: { label: "Daily", x: 70, y: 42 },
  focus: { label: "Focus", x: 70, y: 78 }
};

const state = {
  selfId: null,
  name: "",
  color: pickColor(),
  channel: "team",
  users: new Map(),
  localStream: null,
  peers: new Map(),
  muted: false,
  joined: false
};

const els = {
  joinDialog: document.querySelector("#joinDialog"),
  joinForm: document.querySelector("#joinForm"),
  nameInput: document.querySelector("#nameInput"),
  selfAvatar: document.querySelector("#selfAvatar"),
  selfName: document.querySelector("#selfName"),
  selfStatus: document.querySelector("#selfStatus"),
  onlineList: document.querySelector("#onlineList"),
  voiceButton: document.querySelector("#voiceButton"),
  muteButton: document.querySelector("#muteButton"),
  muteIcon: document.querySelector("#muteIcon"),
  voiceTitle: document.querySelector("#voiceTitle"),
  voiceSubtitle: document.querySelector("#voiceSubtitle"),
  voiceTiles: document.querySelector("#voiceTiles"),
  floorPlan: document.querySelector("#floorPlan"),
  avatarsLayer: document.querySelector("#avatarsLayer"),
  proximityZone: document.querySelector("#proximityZone"),
  audioMount: document.querySelector("#audioMount"),
  channelButtons: Array.from(document.querySelectorAll(".channel"))
};

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

if (typeof els.joinDialog.showModal === "function") {
  els.joinDialog.showModal();
} else {
  els.joinDialog.setAttribute("open", "");
}

els.joinForm.addEventListener("submit", () => {
  const name = els.nameInput.value.trim() || "Convidado";
  state.name = name;
  state.joined = true;
  syncSelfPanel();
  socket.emit("space:join", {
    spaceId: "tec-hq",
    name,
    color: state.color,
    x: CHANNELS.team.x,
    y: CHANNELS.team.y,
    channel: state.channel
  });
  setTimeout(() => els.floorPlan.focus(), 50);
});

els.voiceButton.addEventListener("click", () => {
  if (state.localStream) {
    leaveVoice();
  } else {
    joinVoice();
  }
});

els.muteButton.addEventListener("click", () => {
  if (!state.localStream) return;

  state.muted = !state.muted;
  state.localStream.getAudioTracks().forEach((track) => {
    track.enabled = !state.muted;
  });
  socket.emit("presence:update", { muted: state.muted });
  syncSelfPanel();
  render();
});

els.channelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setChannel(button.dataset.channel);
  });
});

els.floorPlan.addEventListener("keydown", (event) => {
  const keyMap = {
    ArrowUp: [0, -3],
    w: [0, -3],
    W: [0, -3],
    ArrowDown: [0, 3],
    s: [0, 3],
    S: [0, 3],
    ArrowLeft: [-3, 0],
    a: [-3, 0],
    A: [-3, 0],
    ArrowRight: [3, 0],
    d: [3, 0],
    D: [3, 0]
  };
  const delta = keyMap[event.key];
  if (!delta || !state.selfId) return;

  event.preventDefault();
  const self = state.users.get(state.selfId);
  moveSelf(self.x + delta[0], self.y + delta[1]);
});

els.floorPlan.addEventListener("pointerdown", (event) => {
  if (!state.selfId) return;

  const rect = els.floorPlan.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  moveSelf(x, y);
  els.floorPlan.focus();
});

socket.on("space:ready", ({ selfId, users }) => {
  state.selfId = selfId;
  state.users = new Map(users.map((user) => [user.id, user]));
  syncSelfPanel();
  render();
});

socket.on("presence:joined", (user) => {
  state.users.set(user.id, user);
  render();
});

socket.on("presence:updated", (user) => {
  state.users.set(user.id, user);
  render();
  reconcileVoicePeers();
});

socket.on("presence:self", (user) => {
  state.users.set(user.id, user);
  state.channel = user.channel;
  render();
  reconcileVoicePeers(true);
});

socket.on("presence:left", (id) => {
  state.users.delete(id);
  closePeer(id);
  render();
});

socket.on("rtc:offer", async ({ from, description }) => {
  if (!state.localStream || !isSameVoiceChannel(from)) return;

  const peer = createPeer(from);
  await peer.pc.setRemoteDescription(description);
  const answer = await peer.pc.createAnswer();
  await peer.pc.setLocalDescription(answer);
  socket.emit("rtc:answer", { to: from, description: peer.pc.localDescription });
});

socket.on("rtc:answer", async ({ from, description }) => {
  const peer = state.peers.get(from);
  if (!peer) return;
  await peer.pc.setRemoteDescription(description);
});

socket.on("rtc:ice-candidate", async ({ from, candidate }) => {
  const peer = state.peers.get(from);
  if (!peer || !candidate) return;

  try {
    await peer.pc.addIceCandidate(candidate);
  } catch (error) {
    console.warn("Falha ao adicionar ICE candidate", error);
  }
});

async function joinVoice() {
  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
    state.muted = false;
    socket.emit("presence:update", { inVoice: true, muted: false, channel: state.channel });
    syncSelfPanel();
    render();
    reconcileVoicePeers(true);
  } catch (error) {
    alert("Nao foi possivel acessar o microfone. Verifique a permissao do navegador.");
    console.error(error);
  }
}

function leaveVoice() {
  state.localStream?.getTracks().forEach((track) => track.stop());
  state.localStream = null;
  state.muted = false;
  for (const id of state.peers.keys()) {
    closePeer(id);
  }
  socket.emit("presence:update", { inVoice: false, muted: false });
  syncSelfPanel();
  render();
}

function setChannel(channel) {
  if (!CHANNELS[channel] || channel === state.channel) return;
  state.channel = channel;
  const target = CHANNELS[channel];
  moveSelf(target.x, target.y, channel);
}

function moveSelf(x, y, forcedChannel) {
  const nextX = clamp(x, 8, 92);
  const nextY = clamp(y, 12, 88);
  const nextChannel = forcedChannel || channelFromPosition(nextX, nextY) || state.channel;
  socket.emit("presence:update", { x: nextX, y: nextY, channel: nextChannel });
}

function channelFromPosition(x, y) {
  if (x < 50 && y < 62) return "team";
  if (x >= 50 && y < 62) return "daily";
  if (x >= 50 && y >= 62) return "focus";
  return null;
}

function reconcileVoicePeers(forceOffers = false) {
  if (!state.localStream || !state.selfId) return;

  for (const [id, user] of state.users) {
    if (id === state.selfId) continue;

    const shouldConnect = user.inVoice && user.channel === state.channel;
    if (!shouldConnect) {
      closePeer(id);
      continue;
    }

    if (!state.peers.has(id) && forceOffers) {
      startOffer(id);
    }
  }
}

async function startOffer(id) {
  const peer = createPeer(id);
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  socket.emit("rtc:offer", { to: id, description: peer.pc.localDescription });
}

function createPeer(id) {
  if (state.peers.has(id)) {
    return state.peers.get(id);
  }

  const pc = new RTCPeerConnection(rtcConfig);
  const audio = document.createElement("audio");
  audio.autoplay = true;
  audio.playsInline = true;
  audio.dataset.peer = id;
  els.audioMount.append(audio);

  state.localStream?.getTracks().forEach((track) => {
    pc.addTrack(track, state.localStream);
  });

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    audio.srcObject = stream;
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("rtc:ice-candidate", { to: id, candidate: event.candidate });
    }
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
      closePeer(id);
    }
  };

  const peer = { pc, audio };
  state.peers.set(id, peer);
  return peer;
}

function closePeer(id) {
  const peer = state.peers.get(id);
  if (!peer) return;

  peer.pc.close();
  peer.audio.remove();
  state.peers.delete(id);
}

function isSameVoiceChannel(id) {
  const user = state.users.get(id);
  return Boolean(user?.inVoice && user.channel === state.channel);
}

function render() {
  renderChannels();
  renderOnlineList();
  renderVoiceStrip();
  renderMap();
}

function renderChannels() {
  els.channelButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === state.channel);
  });

  const channel = CHANNELS[state.channel];
  els.voiceTitle.textContent = channel?.label || "Canal";
  els.voiceSubtitle.textContent = state.localStream
    ? "Sua voz esta ativa neste canal."
    : "Entre para conversar com quem estiver no mesmo canal.";
}

function renderOnlineList() {
  els.onlineList.innerHTML = "";
  for (const user of state.users.values()) {
    const row = document.createElement("div");
    row.className = "online-row";
    row.innerHTML = `
      <div class="avatar" style="background:${user.color}">${initials(user.name)}</div>
      <strong>${escapeHtml(user.name)}</strong>
      <span class="voice-dot ${user.inVoice ? "active" : ""}"></span>
    `;
    els.onlineList.append(row);
  }
}

function renderVoiceStrip() {
  els.voiceTiles.innerHTML = "";
  const users = Array.from(state.users.values()).filter(
    (user) => user.inVoice && user.channel === state.channel
  );

  if (users.length === 0) {
    const empty = document.createElement("small");
    empty.textContent = "Nenhum participante em voz.";
    els.voiceTiles.append(empty);
    return;
  }

  for (const user of users) {
    const tile = document.createElement("div");
    tile.className = "voice-tile";
    tile.innerHTML = `
      <div class="avatar" style="background:${user.color}">${initials(user.name)}</div>
      <span>${escapeHtml(user.name)}${user.muted ? " - mutado" : ""}</span>
    `;
    els.voiceTiles.append(tile);
  }
}

function renderMap() {
  els.avatarsLayer.innerHTML = "";
  for (const user of state.users.values()) {
    const avatar = document.createElement("div");
    avatar.className = `map-avatar ${user.id === state.selfId ? "self" : ""}`;
    avatar.dataset.name = user.id === state.selfId ? `Voce, ${user.name}` : user.name;
    avatar.style.left = `${user.x}%`;
    avatar.style.top = `${user.y}%`;
    avatar.style.background = user.color;
    avatar.textContent = initials(user.name);
    els.avatarsLayer.append(avatar);
  }

  const self = state.users.get(state.selfId);
  if (self) {
    els.proximityZone.style.left = `${self.x}%`;
    els.proximityZone.style.top = `${self.y}%`;
  }
}

function syncSelfPanel() {
  const name = state.name || "Convidado";
  els.selfName.textContent = name;
  els.selfAvatar.textContent = initials(name);
  els.selfAvatar.style.background = state.color;
  els.selfStatus.textContent = state.localStream
    ? state.muted
      ? "em chamada, mutado"
      : "em chamada"
    : "fora da chamada";
  els.voiceButton.textContent = state.localStream ? "Sair da voz" : "Entrar na voz";
  els.voiceButton.classList.toggle("live", Boolean(state.localStream));
  els.muteButton.disabled = !state.localStream;
  els.muteIcon.textContent = state.muted ? "off" : "mic";
}

function pickColor() {
  const colors = ["#6ee7b7", "#93c5fd", "#fda4af", "#fcd34d", "#c4b5fd", "#67e8f9"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return entities[char];
  });
}
