import { DEFAULT_SKINS } from "../core/appConfig.js";
import { state } from "../core/appState.js";
import { initials } from "../shared/formattingValues.js";
import { isPixelSkin, portraitUrl } from "./pixelSprites.js";

export function applyAvatar(element, user) {
  const avatar = user.avatar || "";
  element.style.background = "";
  element.style.backgroundColor = user.color || state.color;
  element.style.backgroundImage = "";
  element.style.backgroundSize = "";
  element.style.backgroundPosition = "";
  element.classList.remove("pix");
  element.textContent = initials(user.name || "G");

  // Skins padrao viram retratos pixelados (cabeca do personagem).
  if (isPixelSkin(avatar)) {
    element.classList.add("pix");
    element.style.backgroundImage = `url("${portraitUrl(avatar)}")`;
    element.style.backgroundSize = "cover";
    element.style.backgroundPosition = "center";
    element.textContent = "";
    return;
  }

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

export function fileToAvatarDataUrl(file) {
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
