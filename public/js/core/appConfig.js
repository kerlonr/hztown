import {
  ScreenSharePresets,
  VideoPresets
} from "/vendor/livekit-client/livekit-client.esm.mjs";

// Salas, alvos e colisao ficam em mapGeometry.js (por tamanho de escritorio).
// Aqui ficam apenas as configuracoes de audio/video e proximidade.

// Proximidade do audio (distancia ponderada pela proporcao do mapa).
export const PROXIMITY = {
  near: 16, // ate aqui, volume cheio
  far: 40, // a partir daqui, mudo
  xScale: 1.6 // mapa e ~16:10, entao a horizontal "conta" mais
};

export const DEFAULT_SKINS = {
  "default:mint": "linear-gradient(135deg, #6ee7b7, #155e75)",
  "default:blue": "linear-gradient(135deg, #93c5fd, #1d4ed8)",
  "default:rose": "linear-gradient(135deg, #fda4af, #be123c)",
  "default:gold": "linear-gradient(135deg, #fcd34d, #b45309)",
  "default:violet": "linear-gradient(135deg, #c4b5fd, #6d28d9)",
  "default:slate": "linear-gradient(135deg, #cbd5e1, #334155)"
};

export const AUDIO_OPTIONS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  // 48 kHz keeps voice crisp and matches LiveKit's Opus pipeline.
  sampleRate: 48000
};

// Niveis de qualidade de video selecionaveis nas configuracoes.
export const VIDEO_QUALITY = {
  hd: { label: "Alta (720p)", resolution: VideoPresets.h720.resolution, frameRate: 30 },
  balanced: { label: "Media (540p)", resolution: VideoPresets.h540.resolution, frameRate: 30 },
  data: { label: "Economica (360p)", resolution: VideoPresets.h360.resolution, frameRate: 24 }
};

export const DEFAULT_QUALITY = "hd";

export function cameraOptions(quality = DEFAULT_QUALITY, deviceId) {
  const preset = VIDEO_QUALITY[quality] || VIDEO_QUALITY[DEFAULT_QUALITY];
  const options = {
    resolution: preset.resolution,
    frameRate: preset.frameRate
  };
  if (deviceId) {
    options.deviceId = { ideal: deviceId };
  }
  return options;
}

export function audioOptions(deviceId) {
  if (!deviceId) return AUDIO_OPTIONS;
  return { ...AUDIO_OPTIONS, deviceId: { ideal: deviceId } };
}

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
