import { els } from "../core/domElements.js";
import { state } from "../core/appState.js";
import { applyAvatar } from "../ui/avatarRenderer.js";
import { formatMessageTime } from "../shared/formattingValues.js";

const GROUP_WINDOW_MS = 5 * 60 * 1000;

export function renderChat(forceScroll = false) {
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

  messages.forEach((message, index) => {
    els.chatMessages.append(renderMessage(message, messages[index - 1]));
  });

  if (shouldStick) {
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }
}

// O chat e uma barra ancorada na direita; aqui sincronizamos as classes
// (a do painel e a do shell, que encolhe o palco) e o botao da toolbar.
export function syncChatPanel() {
  els.chatWindow.classList.toggle("open", state.chatOpen);
  els.appShell.classList.toggle("chat-open", state.chatOpen);
  els.chatButton.classList.toggle("active", state.chatOpen);
  els.chatButton.setAttribute("aria-pressed", String(state.chatOpen));
  els.chatButton.title = state.chatOpen ? "Fechar chat" : "Abrir chat";
  els.chatButton.setAttribute("aria-label", state.chatOpen ? "Fechar chat" : "Abrir chat");
}

function renderMessage(message, previous) {
  const isOwn = message.userId === state.selfId;
  const isGrouped =
    previous &&
    previous.userId === message.userId &&
    message.createdAt - previous.createdAt < GROUP_WINDOW_MS;

  const row = document.createElement("article");
  row.className = `chat-message ${isOwn ? "own" : ""} ${isGrouped ? "grouped" : ""}`;

  if (!isOwn) {
    row.append(isGrouped ? createAvatarSpacer() : createMessageAvatar(message));
  }

  const body = document.createElement("div");
  body.className = "chat-body";

  if (!isOwn && !isGrouped) {
    body.append(createMessageMeta(message));
  }

  body.append(createMessageBubble(message));
  row.append(body);
  return row;
}

function createMessageAvatar(message) {
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  applyAvatar(avatar, message);
  return avatar;
}

function createAvatarSpacer() {
  const spacer = document.createElement("div");
  spacer.className = "chat-avatar-spacer";
  return spacer;
}

function createMessageMeta(message) {
  const meta = document.createElement("div");
  meta.className = "chat-meta";

  const name = document.createElement("strong");
  name.textContent = message.name;
  meta.append(name);
  return meta;
}

function createMessageBubble(message) {
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";

  const text = document.createElement("p");
  text.textContent = message.text;

  const time = document.createElement("time");
  time.dateTime = new Date(message.createdAt).toISOString();
  time.textContent = formatMessageTime(message.createdAt);

  bubble.append(text, time);
  return bubble;
}
