import { pickColor } from "../shared/formattingValues.js";
import { DEFAULT_QUALITY } from "./appConfig.js";

function storedDevices() {
  try {
    return JSON.parse(localStorage.getItem("gt.devices") || "{}") || {};
  } catch {
    return {};
  }
}

const devices = storedDevices();

export const state = {
  selfId: null,
  name: localStorage.getItem("gt.name") || "",
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
  micTest: null,
  settingsOpen: false,
  devices: {
    audioInput: devices.audioInput || "",
    videoInput: devices.videoInput || "",
    audioOutput: devices.audioOutput || "",
    quality: devices.quality || DEFAULT_QUALITY,
    mirror: devices.mirror !== false
  }
};

export function persistDevices() {
  localStorage.setItem("gt.devices", JSON.stringify(state.devices));
}
