// Referencias de DOM centralizadas. Mantidas num unico lugar para que a
// estrutura do index.html possa mudar sem cacar querySelector pelo codigo.
export const els = {
  // entrada
  joinDialog: document.querySelector("#joinDialog"),
  joinForm: document.querySelector("#joinForm"),
  nameInput: document.querySelector("#nameInput"),

  // drawer esquerdo (menu)
  menuButton: document.querySelector("#menuButton"),
  sideDrawer: document.querySelector("#sideDrawer"),
  drawerClose: document.querySelector("#drawerClose"),
  selfAvatar: document.querySelector("#selfAvatar"),
  selfName: document.querySelector("#selfName"),
  selfStatus: document.querySelector("#selfStatus"),
  onlineList: document.querySelector("#onlineList"),
  areaList: document.querySelector("#areaList"),
  officeSizes: document.querySelector("#officeSizes"),

  // HUD e dock
  connectionStatus: document.querySelector("#connectionStatus"),
  voiceTiles: document.querySelector("#voiceTiles"),
  voiceButton: document.querySelector("#voiceButton"),
  voiceIcon: document.querySelector("#voiceIcon"),
  muteButton: document.querySelector("#muteButton"),
  muteIcon: document.querySelector("#muteIcon"),
  cameraButton: document.querySelector("#cameraButton"),
  cameraIcon: document.querySelector("#cameraIcon"),
  screenButton: document.querySelector("#screenButton"),
  screenIcon: document.querySelector("#screenIcon"),
  settingsButton: document.querySelector("#settingsButton"),
  chatButton: document.querySelector("#chatButton"),
  chatBadge: document.querySelector("#chatBadge"),
  chatWinBadge: document.querySelector("#chatWinBadge"),
  mediaButton: document.querySelector("#mediaButton"),
  reactionBar: document.querySelector("#reactionBar"),

  // mapa
  floorPlan: document.querySelector("#floorPlan"),
  floorCanvas: document.querySelector("#floorCanvas"),
  fxCanvas: document.querySelector("#fxCanvas"),
  roomLabels: document.querySelector("#roomLabels"),
  avatarsLayer: document.querySelector("#avatarsLayer"),
  proximityZone: document.querySelector("#proximityZone"),

  // janelas flutuantes
  chatWindow: document.querySelector("#chatWindow"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatChannelLabel: document.querySelector("#chatChannelLabel"),
  mediaWindow: document.querySelector("#mediaWindow"),
  mediaGrid: document.querySelector("#mediaGrid"),

  // midia/toasts
  audioMount: document.querySelector("#audioMount"),
  toastStack: document.querySelector("#toastStack"),

  // avatar/skins e tamanho do escritorio
  avatarInput: document.querySelector("#avatarInput"),
  skinButtons: Array.from(document.querySelectorAll("#skinPicker .skin-option")),
  sizePicker: document.querySelector("#sizePicker"),

  // configuracoes
  settingsDialog: document.querySelector("#settingsDialog"),
  settingsForm: document.querySelector("#settingsForm"),
  settingsClose: document.querySelector("#settingsClose"),
  settingsName: document.querySelector("#settingsName"),
  settingsSkinButtons: Array.from(document.querySelectorAll("#settingsSkinPicker .skin-option")),
  settingsAvatarInput: document.querySelector("#settingsAvatarInput"),
  micSelect: document.querySelector("#micSelect"),
  cameraSelect: document.querySelector("#cameraSelect"),
  speakerSelect: document.querySelector("#speakerSelect"),
  refreshDevices: document.querySelector("#refreshDevices"),
  qualitySelect: document.querySelector("#qualitySelect"),
  mirrorToggle: document.querySelector("#mirrorToggle"),
  micTestButton: document.querySelector("#micTestButton"),
  micMeter: document.querySelector("#micMeter"),
  micMeterBar: document.querySelector("#micMeterBar"),
  micStatus: document.querySelector("#micStatus")
};
