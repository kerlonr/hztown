// Janelas flutuantes arrastaveis (chat, video...). Cada janela:
// - abre/fecha com .open;
// - arrasta pelo cabecalho ([data-drag]) com Pointer Events;
// - sobe para frente ao clicar (z-index);
// - lembra a posicao no localStorage (por chave).

const Z_BASE = 40;
let zTop = Z_BASE;

export function createWindow(el, { key, onToggle } = {}) {
  if (!el) return null;

  const storageKey = key ? `hz.win.${key}` : null;
  const handle = el.querySelector("[data-drag]");

  restorePosition();
  bringToFront();

  el.addEventListener("pointerdown", bringToFront);

  if (handle) {
    handle.addEventListener("pointerdown", startDrag);
  }

  el.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => api.close());
  });

  function bringToFront() {
    zTop += 1;
    el.style.zIndex = String(zTop);
  }

  function startDrag(event) {
    // botoes dentro do cabecalho continuam clicaveis
    if (event.target.closest("button")) return;

    event.preventDefault();
    const rect = el.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    // congela o tamanho durante o arrasto (evita saltos com right/bottom no CSS)
    el.style.width = `${rect.width}px`;
    el.style.right = "auto";
    el.style.bottom = "auto";
    el.classList.add("dragging");
    handle.setPointerCapture(event.pointerId);

    const move = (ev) => applyPosition(ev.clientX - offsetX, ev.clientY - offsetY);
    const stop = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
      el.classList.remove("dragging");
      persistPosition();
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);
  }

  function applyPosition(left, top) {
    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - Math.min(rect.width, 160);
    const maxTop = window.innerHeight - 48;
    el.style.left = `${Math.max(-rect.width + 160, Math.min(maxLeft, left))}px`;
    el.style.top = `${Math.max(0, Math.min(maxTop, top))}px`;
  }

  function persistPosition() {
    if (!storageKey) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ left: el.style.left, top: el.style.top })
    );
  }

  function restorePosition() {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved?.left && saved?.top) {
        el.style.left = saved.left;
        el.style.top = saved.top;
        el.style.right = "auto";
        el.style.bottom = "auto";
        // garante que a janela nao ficou fora da tela (ex.: outro monitor)
        const left = parseFloat(saved.left);
        const top = parseFloat(saved.top);
        if (left > window.innerWidth - 120 || top > window.innerHeight - 60 || left < -300 || top < 0) {
          el.style.left = "";
          el.style.top = "";
          el.style.right = "";
          el.style.bottom = "";
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  const api = {
    el,
    isOpen: () => el.classList.contains("open"),
    open() {
      if (api.isOpen()) return;
      el.classList.add("open");
      bringToFront();
      onToggle?.(true);
    },
    close() {
      if (!api.isOpen()) return;
      el.classList.remove("open");
      onToggle?.(false);
    },
    toggle() {
      api.isOpen() ? api.close() : api.open();
    }
  };

  return api;
}
