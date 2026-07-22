// Baloes de fala sobre o avatar no mapa quando alguem manda mensagem
// (estilo Gather Town). Um balao por usuario; o mais novo substitui o antigo.

const BUBBLE_MS = 5200;
const MAX_CHARS = 90;
const active = new Map(); // userId -> { el, timeout }

export function showChatBubble(mapEl, userId, text) {
  if (!mapEl || !text) return;

  hideChatBubble(userId);

  const bubble = document.createElement("div");
  bubble.className = "map-bubble";
  bubble.textContent = text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS - 1)}…` : text;
  mapEl.append(bubble);

  const timeout = window.setTimeout(() => {
    bubble.classList.add("leaving");
    window.setTimeout(() => bubble.remove(), 200);
    active.delete(userId);
  }, BUBBLE_MS);

  active.set(userId, { el: bubble, timeout });
}

export function hideChatBubble(userId) {
  const current = active.get(userId);
  if (!current) return;
  window.clearTimeout(current.timeout);
  current.el.remove();
  active.delete(userId);
}
