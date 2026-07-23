// Janelas flutuantes arrastaveis (chat, video...). Cada janela:
// - abre/fecha com .open;
// - minimiza para uma "barrinha" (so o cabecalho) com .min — estilo Google Meet;
// - arrasta pelo cabecalho ([data-drag]) com Pointer Events;
// - sobe para frente ao clicar (z-index);
// - lembra posicao e estado minimizado no localStorage (por chave).
//
// Botoes no cabecalho: [data-min] minimiza/restaura, [data-close] fecha.
// Duplo clique no cabecalho tambem minimiza/restaura.

const Z_BASE = 40;
let zTop = Z_BASE;

export function createWindow(el, { key, onToggle, onMinToggle } = {}) {
  if (!el) return null;

  // Janela "docked" (ex.: chat na barra da direita): posicao vem do CSS,
  // entao nao arrasta, nao redimensiona e nao persiste posicao/minimizado.
  const docked = el.classList.contains("docked");
  const storageKey = key && !docked ? `hz.win.${key}` : null;
  const handle = docked ? null : el.querySelector("[data-drag]");

  restoreState();
  if (!docked) {
    bringToFront();
    el.addEventListener("pointerdown", bringToFront);
  }

  if (handle) {
    handle.addEventListener("pointerdown", startDrag);
    handle.addEventListener("dblclick", (event) => {
      if (event.target.closest("button")) return;
      api.isMinimized() ? api.restore() : api.minimize();
    });
  }

  el.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => api.close());
  });

  el.querySelectorAll("[data-min]").forEach((button) => {
    button.addEventListener("click", () => {
      api.isMinimized() ? api.restore() : api.minimize();
    });
  });

  function bringToFront() {
    if (docked) return;
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
      persistState();
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

  function syncMinButtons(min) {
    el.querySelectorAll("[data-min]").forEach((button) => {
      button.setAttribute("aria-label", min ? "Restaurar" : "Minimizar");
      button.title = min ? "Restaurar" : "Minimizar";
    });
  }

  function persistState() {
    if (!storageKey) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        left: el.style.left,
        top: el.style.top,
        min: api.isMinimized()
      })
    );
  }

  function restoreState() {
    if (!storageKey) return;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!saved) return;
      if (saved.left && saved.top) {
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
        }
      }
      if (saved.min) {
        el.classList.add("min");
        syncMinButtons(true);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  const api = {
    el,
    isOpen: () => el.classList.contains("open"),
    isMinimized: () => el.classList.contains("min"),
    // visivel de verdade = aberta e nao minimizada
    isVisible: () => api.isOpen() && !api.isMinimized(),
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
    },
    minimize() {
      if (api.isMinimized()) return;
      el.classList.add("min");
      syncMinButtons(true);
      persistState();
      onMinToggle?.(true);
    },
    restore() {
      if (!api.isMinimized()) return;
      el.classList.remove("min");
      syncMinButtons(false);
      bringToFront();
      persistState();
      onMinToggle?.(false);
    }
  };

  return api;
}
