import { pickColor } from "../shared/formattingValues.js";

export const state = {
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
