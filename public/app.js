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

const DEFAULT_SKINS = {
  "default:mint": "linear-gradient(135deg, #6ee7b7, #155e75)",
  "default:blue": "linear-gradient(135deg, #93c5fd, #1d4ed8)",
  "default:rose": "linear-gradient(135deg, #fda4af, #be123c)",
  "default:gold": "linear-gradient(135deg, #fcd34d, #b45309)"
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

const MIC_TEST_TIMEOUT_MS = 12000;

const state = {
  selfId: null,
  name: "",
  color: pickColor(),
  avatar: localStorage.getItem("gt.avatar") || "default:mint",
  channel: "team",
  users: new Map(),
  messages: [],
  speakingIds: new Set(),
  chatOpen: true,
  livekitRoom: null,
  livekitRoomName: null,
  mediaElements: new Map(),
  muted: false,
  cameraOn: false,
  screenOn: false,
  joined: false,
  busy: false,
  micTest: null
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
  micTestButton: document.querySelector("#micTestButton"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraIcon: document.querySelector("#cameraIcon"),
  screenButton: document.querySelector("#screenButton"),
  screenIcon: document.querySelector("#screenIcon"),
  chatButton: document.querySelector("#chatButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
  micMeter: document.querySelector("#micMeter"),
  micMeterBar: document.querySelector("#micMeterBar"),
  micStatus: document.querySelector("#micStatus"),
  voiceTitle: document.querySelector("#voiceTitle"),
  voiceSubtitle: document.querySelector("#voiceSubtitle"),
  voiceTiles: document.querySelector("#voiceTiles"),
  workspaceBody: document.querySelector(".workspace-body"),
  mediaGrid: document.querySelector("#mediaGrid"),
  floorPlan: document.querySelector("#floorPlan"),
  avatarsLayer: document.querySelector("#avatarsLayer"),
  proximityZone: document.querySelector("#proximityZone"),
  audioMount: document.querySelector("#audioMount"),
  chatPanel: document.querySelector("#chatPanel"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatChannelLabel: document.querySelector("#chatChannelLabel"),
  avatarInput: document.querySelector("#avatarInput"),
  skinButtons: Array.from(document.querySelectorAll(".skin-option")),
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
    avatar: state.avatar,
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

els.micTestButton.addEventListener("click", () => {
  if (state.micTest) {
    stopMicTest("Teste encerrado");
  } else {
    startMicTest();
  }
});

els.cameraButton.addEventListener("click", () => {
  toggleCamera();
});

els.screenButton.addEventListener("click", () => {
  toggleScreenShare();
});

els.chatButton.addEventListener("click", () => {
  state.chatOpen = !state.chatOpen;
  syncChatPanel();
});

els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text || !state.selfId) return;

  socket.emit("chat:send", {
    channel: state.channel,
    text
  });
  els.chatInput.value = "";
});

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

socket.on("space:ready", ({ selfId, users, messages = [] }) => {
  state.selfId = selfId;
  state.users = new Map(users.map((user) => [user.id, user]));
  state.messages = messages;
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

socket.on("chat:message", (message) => {
  state.messages.push(message);
  if (state.messages.length > 120) {
    state.messages.splice(0, state.messages.length - 120);
  }
  renderChat(true);
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
      setConnectionStatus(`LiveKit: ${CHANNELS[state.channel].label}`);
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

  if (track.kind === Track.Kind.Audio) {
    if (isLocal) return;

    const audio = track.attach();
    audio.autoplay = true;
    audio.playsInline = true;
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
  els.micTestButton.disabled = busy;
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
  renderChat();
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
  els.chatChannelLabel.textContent = channel?.label || "Canal";
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

function renderMap() {
  els.avatarsLayer.innerHTML = "";
  for (const user of state.users.values()) {
    const avatar = document.createElement("div");
    avatar.className = `map-avatar ${user.id === state.selfId ? "self" : ""}`;
    avatar.dataset.identity = user.id;
    avatar.dataset.name = user.id === state.selfId ? `Voce, ${user.name}` : user.name;
    avatar.style.left = `${user.x}%`;
    avatar.style.top = `${user.y}%`;
    applyAvatar(avatar, user);
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
  els.voiceButton.textContent = state.livekitRoom ? "Sair da voz" : "Entrar na voz";
  els.voiceButton.classList.toggle("live", Boolean(state.livekitRoom));
  els.muteButton.disabled = state.busy || !state.livekitRoom;
  els.micTestButton.disabled = state.busy;
  els.cameraButton.disabled = state.busy || !state.selfId;
  els.screenButton.disabled = state.busy || !state.selfId;
  els.muteIcon.textContent = state.muted ? "Off" : "Mic";
  els.cameraIcon.textContent = state.cameraOn ? "Off" : "Cam";
  els.screenIcon.textContent = state.screenOn ? "Stop" : "Tela";
  els.muteButton.classList.toggle("active", state.livekitRoom && !state.muted);
  els.micTestButton.classList.toggle("active", Boolean(state.micTest));
  els.cameraButton.classList.toggle("active", state.cameraOn);
  els.screenButton.classList.toggle("active", state.screenOn);
  syncSkinPicker();
  syncChatPanel();
  syncSpeakingIndicators();
}

function renderChat(forceScroll = false) {
  const messages = state.messages.filter((message) => message.channel === state.channel);
  const shouldStick =
    forceScroll ||
    els.chatMessages.scrollTop + els.chatMessages.clientHeight >= els.chatMessages.scrollHeight - 48;

  els.chatMessages.innerHTML = "";

  if (messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-empty";
    empty.textContent = "Sem mensagens neste canal.";
    els.chatMessages.append(empty);
    return;
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = messages[index - 1];
    const isOwn = message.userId === state.selfId;
    const isGrouped =
      previous &&
      previous.userId === message.userId &&
      message.createdAt - previous.createdAt < 5 * 60 * 1000;

    const row = document.createElement("article");
    row.className = `chat-message ${isOwn ? "own" : ""} ${isGrouped ? "grouped" : ""}`;

    if (!isOwn) {
      if (isGrouped) {
        const spacer = document.createElement("div");
        spacer.className = "chat-avatar-spacer";
        row.append(spacer);
      } else {
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        applyAvatar(avatar, message);
        row.append(avatar);
      }
    }

    const body = document.createElement("div");
    body.className = "chat-body";

    if (!isOwn && !isGrouped) {
      const meta = document.createElement("div");
      meta.className = "chat-meta";

      const name = document.createElement("strong");
      name.textContent = message.name;
      meta.append(name);
      body.append(meta);
    }

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";

    const text = document.createElement("p");
    text.textContent = message.text;

    const time = document.createElement("time");
    time.dateTime = new Date(message.createdAt).toISOString();
    time.textContent = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    bubble.append(text, time);
    body.append(bubble);
    row.append(body);
    els.chatMessages.append(row);
  }

  if (shouldStick) {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}

function syncChatPanel() {
  els.workspaceBody.classList.toggle("chat-closed", !state.chatOpen);
  els.chatPanel.classList.toggle("closed", !state.chatOpen);
  els.chatButton.classList.toggle("active", state.chatOpen);
}

function syncSpeakingIndicators() {
  document.querySelectorAll(".avatar[data-identity], .map-avatar[data-identity]").forEach((avatar) => {
    avatar.classList.toggle("speaking", state.speakingIds.has(avatar.dataset.identity));
  });
}

async function startMicTest() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setMicStatus("Seu navegador nao liberou teste de microfone.", 0);
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_OPTIONS });
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
  syncSelfPanel();

  if (state.selfId) {
    socket.emit("presence:update", { avatar });
  }
}

function syncSkinPicker() {
  els.skinButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.avatar === state.avatar);
  });
}

function applyAvatar(element, user) {
  const avatar = user.avatar || "";
  element.style.background = "";
  element.style.backgroundColor = user.color || state.color;
  element.style.backgroundImage = "";
  element.style.backgroundSize = "";
  element.style.backgroundPosition = "";
  element.textContent = initials(user.name || "G");

  if (DEFAULT_SKINS[avatar]) {
    element.style.backgroundImage = DEFAULT_SKINS[avatar];
    return;
  }

  if (avatar.startsWith("data:image/")) {
    element.style.backgroundImage = `url("${avatar}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.textContent = "";
  }
}

function fileToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Escolha uma imagem PNG, JPG ou WEBP."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Nao foi possivel processar a imagem."));
      image.onload = () => {
        const size = 160;
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const sourceSize = Math.min(image.width, image.height);
        const sourceX = (image.width - sourceSize) / 2;
        const sourceY = (image.height - sourceSize) / 2;

        canvas.width = size;
        canvas.height = size;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
        resolve(canvas.toDataURL("image/webp", 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
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
