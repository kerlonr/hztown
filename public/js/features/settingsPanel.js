import { els } from "../core/domElements.js";
import { state, persistDevices } from "../core/appState.js";
import { VIDEO_QUALITY } from "../core/appConfig.js";
import { hydrateStaticIcons } from "../ui/iconRenderer.js";

let api = null;
let deviceListenerBound = false;

const KIND_LABELS = {
  audioinput: "Microfone",
  videoinput: "Camera",
  audiooutput: "Saida de audio"
};

const KIND_TO_SELECT = {
  audioinput: () => els.micSelect,
  videoinput: () => els.cameraSelect,
  audiooutput: () => els.speakerSelect
};

const KIND_TO_PREF = {
  audioinput: "audioInput",
  videoinput: "videoInput",
  audiooutput: "audioOutput"
};

export function initSettingsPanel(handlers) {
  api = handlers;
  hydrateStaticIcons(els.settingsDialog);
  populateQuality();
  bindEvents();
}

function bindEvents() {
  els.settingsButton.addEventListener("click", openSettings);
  els.settingsClose.addEventListener("click", closeSettings);
  els.settingsDialog.addEventListener("close", () => {
    state.settingsOpen = false;
  });

  els.settingsName.addEventListener("change", () => {
    const name = els.settingsName.value.trim();
    if (name) api?.onName(name);
  });

  els.settingsSkinButtons.forEach((button) => {
    button.addEventListener("click", () => {
      api?.onAvatar(button.dataset.avatar || "default:mint");
      syncSkin();
    });
  });

  els.settingsAvatarInput.addEventListener("change", async () => {
    const file = els.settingsAvatarInput.files?.[0];
    if (!file) return;
    await api?.onAvatarFile(file);
    els.settingsAvatarInput.value = "";
    syncSkin();
  });

  els.micSelect.addEventListener("change", () => onDeviceSelect("audioinput", els.micSelect.value));
  els.cameraSelect.addEventListener("change", () => onDeviceSelect("videoinput", els.cameraSelect.value));
  els.speakerSelect.addEventListener("change", () => onDeviceSelect("audiooutput", els.speakerSelect.value));

  els.refreshDevices.addEventListener("click", () => populateDevices(true));

  els.qualitySelect.addEventListener("change", () => {
    state.devices.quality = els.qualitySelect.value;
    persistDevices();
    api?.onQualityChange(state.devices.quality);
  });

  els.mirrorToggle.addEventListener("change", () => {
    state.devices.mirror = els.mirrorToggle.checked;
    persistDevices();
    api?.onMirrorChange(state.devices.mirror);
  });

  if (navigator.mediaDevices && !deviceListenerBound) {
    navigator.mediaDevices.addEventListener?.("devicechange", () => {
      if (state.settingsOpen) populateDevices(false);
    });
    deviceListenerBound = true;
  }
}

export function openSettings() {
  state.settingsOpen = true;
  els.settingsName.value = state.name || "";
  els.qualitySelect.value = state.devices.quality;
  els.mirrorToggle.checked = state.devices.mirror;
  syncSkin();
  populateDevices(false);

  if (typeof els.settingsDialog.showModal === "function") {
    els.settingsDialog.showModal();
  } else {
    els.settingsDialog.setAttribute("open", "");
  }
}

function closeSettings() {
  state.settingsOpen = false;
  if (els.settingsDialog.open) els.settingsDialog.close();
  else els.settingsDialog.removeAttribute("open");
}

function syncSkin() {
  els.settingsSkinButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.avatar === state.avatar);
  });
}

function populateQuality() {
  els.qualitySelect.innerHTML = "";
  Object.entries(VIDEO_QUALITY).forEach(([key, preset]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = preset.label;
    els.qualitySelect.append(option);
  });
  els.qualitySelect.value = state.devices.quality;
}

async function onDeviceSelect(kind, deviceId) {
  state.devices[KIND_TO_PREF[kind]] = deviceId;
  persistDevices();
  try {
    await api?.onDeviceChange(kind, deviceId);
  } catch (error) {
    console.error("Falha ao trocar dispositivo", error);
  }
}

async function populateDevices(requestPermission) {
  if (!navigator.mediaDevices?.enumerateDevices) {
    setUnsupported();
    return;
  }

  if (requestPermission) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      // Sem permissao ainda listamos com rotulos genericos.
      console.warn("Permissao de midia nao concedida para listar dispositivos", error);
    }
  }

  let devices = [];
  try {
    devices = await navigator.mediaDevices.enumerateDevices();
  } catch (error) {
    setUnsupported();
    return;
  }

  fillSelect("audioinput", devices);
  fillSelect("videoinput", devices);
  fillSelect("audiooutput", devices);
}

function fillSelect(kind, devices) {
  const select = KIND_TO_SELECT[kind]();
  if (!select) return;

  const list = devices.filter((device) => device.kind === kind);
  const stored = state.devices[KIND_TO_PREF[kind]];
  select.innerHTML = "";

  if (kind === "audiooutput" && list.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Padrao do sistema";
    select.append(option);
    select.disabled = true;
    return;
  }

  if (list.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Permitir acesso para listar";
    select.append(option);
    select.disabled = false;
    return;
  }

  select.disabled = false;
  list.forEach((device, index) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `${KIND_LABELS[kind]} ${index + 1}`;
    select.append(option);
  });

  if (stored && list.some((device) => device.deviceId === stored)) {
    select.value = stored;
  }
}

function setUnsupported() {
  [els.micSelect, els.cameraSelect, els.speakerSelect].forEach((select) => {
    if (!select) return;
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Nao suportado neste navegador";
    select.append(option);
    select.disabled = true;
  });
}
