import {
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  VideoPresets
} from "/vendor/livekit-client/livekit-client.esm.mjs";

const socket = io();

const CHANNELS = {
  team: { label: "Team", x: 30, y: 42 },
  daily: { label: "Daily", x: 70, y: 42 },
  focus: { label: "Focus", x: 70, y: 78 }
};

const AUDIO_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

const CAMERA_OPTIONS = {
  resolution: VideoPresets.h540.resolution,
  frameRate: 24
};

const SCREEN_OPTIONS = {
  audio: true,
  video: true,
  resolution: ScreenSharePresets.h1080fps15.resolution,
  contentHint: "detail",
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  systemAudio: "include"
};

const state = {
  selfId: null,
  name: "",
  color: pickColor(),
  channel: "team",
  users: new Map(),
  livekitRoom: null,
  livekitRoomName: null,
  mediaElements: new Map(),
  muted: false,
  cameraOn: false,
  screenOn: false,
  joined: false,
  busy: false
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
  cameraButton: document.querySelector("#cameraButton"),
  cameraIcon: document.querySelector("#cameraIcon"),
  screenButton: document.querySelector("#screenButton"),
  screenIcon: document.querySelector("#screenIcon"),
  connectionStatus: document.querySelector("#connectionStatus"),
  voiceTitle: document.querySelector("#voiceTitle"),
  voiceSubtitle: document.querySelector("#voiceSubtitle"),
  voiceTiles: document.querySelector("#voiceTiles"),
  mediaGrid: document.querySelector("#mediaGrid"),
  floorPlan: document.querySelector("#floorPlan"),
  avatarsLayer: document.querySelector("#avatarsLayer"),
  proximityZone: document.querySelector("#proximityZone"),
  audioMount: document.querySelector("#audioMount"),
  channelButtons: Array.from(document.querySelectorAll(".channel"))
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
  if (state.livekitRoom) {
    leaveVoice();
  } else {
    joinVoice();
  }
});

els.muteButton.addEventListener("click", () => {
  toggleMute();
});

els.cameraButton.addEventListener("click", () => {
  toggleCamera();
});

els.screenButton.addEventListener("click", () => {
  toggleScreenShare();
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
});

socket.on("presence:self", (user) => {
  const previousChannel = state.channel;
  state.users.set(user.id, user);
  state.channel = user.channel;
  render();

  if (state.livekitRoom && previousChannel !== state.channel) {
    switchLiveKitRoom();
  }
});

socket.on("presence:left", (id) => {
  state.users.delete(id);
  removeParticipantMedia(id);
  render();
});

async function joinVoice() {
  if (!state.selfId || state.busy) return;

  setBusy(true, "Conectando ao LiveKit...");
  try {
    const room = await connectLiveKitRoom();
    state.muted = false;
    await room.localParticipant.setMicrophoneEnabled(true, AUDIO_OPTIONS);
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
    await state.livekitRoom.localParticipant.setMicrophoneEnabled(!nextMuted, AUDIO_OPTIONS);
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
    await state.livekitRoom.localParticipant.setCameraEnabled(enableCamera, CAMERA_OPTIONS);
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
        screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
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
  const roomName = liveKitRoomName(state.channel);
  if (state.livekitRoom && state.livekitRoomName === roomName) {
    return state.livekitRoom;
  }

  if (state.livekitRoom) {
    await disconnectLiveKitRoom({ resetControls: false });
  }

  clearMediaElements();

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    disconnectOnPageLeave: true,
    audioCaptureDefaults: AUDIO_OPTIONS,
    videoCaptureDefaults: CAMERA_OPTIONS,
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
  setConnectionStatus(`LiveKit: ${CHANNELS[state.channel].label}`);
  return room;
}

async function switchLiveKitRoom() {
  if (state.busy) return;

  const keepCamera = state.cameraOn;
  const keepMuted = state.muted;
  const hadScreenShare = state.screenOn;

  setBusy(true, "Mudando de canal...");
  try {
    await disconnectLiveKitRoom({ resetControls: false });
    state.cameraOn = false;
    state.screenOn = false;
    state.muted = keepMuted;

    const room = await connectLiveKitRoom();
    await room.localParticipant.setMicrophoneEnabled(!keepMuted, AUDIO_OPTIONS);
    if (keepCamera) {
      await room.localParticipant.setCameraEnabled(true, CAMERA_OPTIONS);
      state.cameraOn = true;
    }
    if (hadScreenShare) {
      state.screenOn = false;
      setConnectionStatus("Tela encerrada ao trocar de canal");
    }
    socket.emit("presence:update", { inVoice: true, muted: keepMuted, channel: state.channel });
    syncSelfPanel();
    render();
  } catch (error) {
    alert("Nao foi possivel trocar a sala LiveKit.");
    console.error(error);
    await disconnectLiveKitRoom();
    socket.emit("presence:update", { inVoice: false, muted: false });
  } finally {
    setBusy(false);
  }
}

async function disconnectLiveKitRoom({ resetControls = true } = {}) {
  const room = state.livekitRoom;
  state.livekitRoom = null;
  state.livekitRoomName = null;

  if (room) {
    await room.disconnect();
  }

  clearMediaElements();

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
    .on(RoomEvent.ParticipantDisconnected, (participant) => {
      removeParticipantMedia(participant.identity);
    })
    .on(RoomEvent.Reconnecting, () => {
      setConnectionStatus("Reconectando LiveKit...");
    })
    .on(RoomEvent.Reconnected, () => {
      setConnectionStatus(`LiveKit: ${CHANNELS[state.channel].label}`);
    })
    .on(RoomEvent.Disconnected, () => {
      if (state.livekitRoom !== room) return;

      state.livekitRoom = null;
      state.livekitRoomName = null;
      state.cameraOn = false;
      state.screenOn = false;
      state.muted = false;
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
  if (!track || publication.source === Track.Source.Microphone) return;

  const key = mediaKey(participant, publication);
  if (state.mediaElements.has(key)) {
    removeMediaTrack(track, publication, participant);
  }

  const isLocal = forceLocal || participant.identity === state.selfId;

  if (track.kind === Track.Kind.Audio) {
    const audio = track.attach();
    audio.autoplay = true;
    audio.dataset.mediaKey = key;
    els.audioMount.append(audio);
    state.mediaElements.set(key, { key, kind: "audio", track, element: audio });
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

  tile.append(video, mediaCaption(participant, publication, isLocal));
  els.mediaGrid.append(tile);
  state.mediaElements.set(key, { key, kind: "video", track, tile, element: video });
  renderMediaEmptyState();
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
  for (const [key, mounted] of state.mediaElements) {
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
  const hasVideo = Array.from(state.mediaElements.values()).some((item) => item.kind === "video");
  els.mediaGrid.classList.toggle("empty", !hasVideo);
  if (!hasVideo) {
    els.mediaGrid.innerHTML = `
      <div class="media-empty">
        <strong>Sem video ativo</strong>
        <small>Abra a camera ou compartilhe a tela para aparecer aqui.</small>
      </div>
    `;
  } else {
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

function liveKitRoomName(channel) {
  return `tec-hq-${channel}`;
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

function setBusy(busy, label = "") {
  state.busy = busy;
  els.voiceButton.disabled = busy && !state.livekitRoom;
  els.muteButton.disabled = busy || !state.livekitRoom;
  els.cameraButton.disabled = busy || !state.selfId;
  els.screenButton.disabled = busy || !state.selfId;
  if (label) {
    setConnectionStatus(label);
  } else if (state.livekitRoom) {
    setConnectionStatus(`LiveKit: ${CHANNELS[state.channel].label}`);
  } else {
    setConnectionStatus("LiveKit pronto");
  }
}

function setConnectionStatus(label) {
  els.connectionStatus.textContent = label;
}

function render() {
  renderChannels();
  renderOnlineList();
  renderVoiceStrip();
  renderMap();
  syncSelfPanel();
}

function renderChannels() {
  els.channelButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.channel === state.channel);
  });

  const channel = CHANNELS[state.channel];
  els.voiceTitle.textContent = channel?.label || "Canal";
  els.voiceSubtitle.textContent = state.livekitRoom
    ? "Audio, camera e tela estao trafegando pelo LiveKit."
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
  els.selfStatus.textContent = state.livekitRoom
    ? state.muted
      ? "em chamada, mutado"
      : state.cameraOn
        ? "em chamada, camera ativa"
        : "em chamada"
    : "fora da chamada";
  els.voiceButton.textContent = state.livekitRoom ? "Sair da voz" : "Entrar na voz";
  els.voiceButton.classList.toggle("live", Boolean(state.livekitRoom));
  els.muteButton.disabled = state.busy || !state.livekitRoom;
  els.cameraButton.disabled = state.busy || !state.selfId;
  els.screenButton.disabled = state.busy || !state.selfId;
  els.muteIcon.textContent = state.muted ? "off" : "mic";
  els.cameraIcon.textContent = state.cameraOn ? "cam off" : "cam";
  els.screenIcon.textContent = state.screenOn ? "stop" : "tela";
  els.cameraButton.classList.toggle("active", state.cameraOn);
  els.screenButton.classList.toggle("active", state.screenOn);
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
