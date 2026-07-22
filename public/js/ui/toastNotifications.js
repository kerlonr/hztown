import { CHANNELS } from "../core/appConfig.js";
import { els } from "../core/domElements.js";
import { applyAvatar } from "./avatarRenderer.js";

export function notifyUserJoined(user) {
  const channel = CHANNELS[user.channel]?.label || "espaco";
  showToast({
    title: `${user.name} entrou`,
    body: `Entrou em ${channel}`,
    user
  });

  if (document.visibilityState === "hidden" && "Notification" in window && Notification.permission === "granted") {
    new Notification(`${user.name} entrou`, {
      body: `Entrou em ${channel}`
    });
  }
}

function showToast({ title, body, user }) {
  const toast = document.createElement("div");
  toast.className = "toast";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  applyAvatar(avatar, user);

  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;

  const description = document.createElement("small");
  description.textContent = body;

  content.append(heading, description);
  toast.append(avatar, content);
  els.toastStack.append(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, 4200);
}
