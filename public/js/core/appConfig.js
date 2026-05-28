import {
  ScreenSharePresets,
  VideoPresets
} from "/vendor/livekit-client/livekit-client.esm.mjs";

export const CHANNELS = {
  team: { label: "Team", x: 30, y: 42 },
  daily: { label: "Daily", x: 70, y: 42 },
  focus: { label: "Focus", x: 70, y: 78 }
};

export const DEFAULT_SKINS = {
  "default:mint": "linear-gradient(135deg, #6ee7b7, #155e75)",
  "default:blue": "linear-gradient(135deg, #93c5fd, #1d4ed8)",
  "default:rose": "linear-gradient(135deg, #fda4af, #be123c)",
  "default:gold": "linear-gradient(135deg, #fcd34d, #b45309)"
};

export const AUDIO_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true
};

export const CAMERA_OPTIONS = {
  resolution: VideoPresets.h540.resolution,
  frameRate: 24
};

export const SCREEN_OPTIONS = {
  audio: true,
  video: true,
  resolution: ScreenSharePresets.h1080fps15.resolution,
  contentHint: "detail",
  selfBrowserSurface: "exclude",
  surfaceSwitching: "include",
  systemAudio: "include"
};

export const SCREEN_SHARE_ENCODING = ScreenSharePresets.h1080fps15.encoding;

export const MIC_TEST_TIMEOUT_MS = 12000;
