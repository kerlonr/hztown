// Reacoes rapidas com emoji flutuando sobre o avatar (toque descontraido).
// Alem dos botoes, as teclas 1..6 disparam reacoes com o mapa focado.

export const REACTIONS = ["👋", "❤️", "😂", "🎉", "👍", "🔥"];

let sendReaction = null;

export function initReactions({ socket, bar, floorPlan, getMapEl }) {
  sendReaction = (emoji) => {
    if (!REACTIONS.includes(emoji)) return;
    socket.emit("reaction:send", { emoji });
  };

  if (bar) {
    REACTIONS.forEach((emoji, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "reaction-button";
      button.textContent = emoji;
      button.title = `Reagir ${emoji} (tecla ${index + 1})`;
      button.setAttribute("aria-label", `Reagir com ${emoji}`);
      button.addEventListener("click", () => sendReaction(emoji));
      bar.append(button);
    });
  }

  floorPlan?.addEventListener("keydown", (event) => {
    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < REACTIONS.length) {
      event.preventDefault();
      sendReaction(REACTIONS[index]);
    }
  });

  socket.on("reaction:new", ({ userId, emoji }) => {
    if (!REACTIONS.includes(emoji)) return;
    floatReaction(getMapEl(userId), emoji);
  });
}

// Emoji sobe e some sobre o avatar; varios podem coexistir.
function floatReaction(mapEl, emoji) {
  if (!mapEl) return;

  const float = document.createElement("span");
  float.className = "reaction-float";
  float.textContent = emoji;
  float.style.setProperty("--drift", `${Math.round(Math.random() * 28 - 14)}px`);
  mapEl.append(float);
  window.setTimeout(() => float.remove(), 1500);
}
