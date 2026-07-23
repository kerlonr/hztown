// Agenda compartilhada do espaco: calendario mensal com eventos visiveis
// para todos. Reunioes podem ter uma sala do mapa; o botao "ir" caminha ate la.
// Qualquer um cria eventos; so o autor remove os seus.

import { activeMap, channelLabel } from "../core/mapGeometry.js";

const MONTHS = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

let socketRef = null;
let els = null;
let selfIdRef = () => null;
let goToRoom = null; // callback: caminhar ate a sala da reuniao
let events = []; // todos os eventos do espaco
let viewYear = 0;
let viewMonth = 0; // 0-11
let selectedDate = todayKey();

function todayKey() {
  const now = new Date();
  return dateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function initCalendar({ socket, elements, getSelfId, onGoToRoom }) {
  socketRef = socket;
  els = elements;
  selfIdRef = getSelfId;
  goToRoom = onGoToRoom;

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();

  els.calPrev.addEventListener("click", () => shiftMonth(-1));
  els.calNext.addEventListener("click", () => shiftMonth(1));

  els.calForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.calTitle.value.trim();
    if (!title) return;
    socketRef.emit("event:add", {
      date: selectedDate,
      time: els.calTime.value || "",
      room: els.calRoom.value || "",
      title
    });
    els.calTitle.value = "";
    els.calTime.value = "";
    els.calRoom.value = "";
  });

  socket.on("space:ready", ({ events: initial = [] }) => {
    events = initial;
    renderCalendar();
  });

  socket.on("event:added", (event) => {
    events.push(event);
    renderCalendar();
  });

  socket.on("event:removed", (id) => {
    events = events.filter((event) => event.id !== id);
    renderCalendar();
  });

  renderCalendar();
}

function shiftMonth(delta) {
  viewMonth += delta;
  if (viewMonth < 0) {
    viewMonth = 11;
    viewYear -= 1;
  } else if (viewMonth > 11) {
    viewMonth = 0;
    viewYear += 1;
  }
  renderCalendar();
}

function eventsOf(date) {
  return events
    .filter((event) => event.date === date)
    .sort((a, b) => (a.time || "99") < (b.time || "99") ? -1 : 1);
}

// Preenche o select de sala com as salas do mapa ativo (reunioes).
export function refreshCalendarRooms() {
  if (!els) return;
  const map = activeMap();
  const current = els.calRoom.value;
  els.calRoom.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Sem sala";
  els.calRoom.append(none);

  for (const room of [...map.rooms, map.lounge]) {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.label;
    els.calRoom.append(option);
  }
  if ([...els.calRoom.options].some((option) => option.value === current)) {
    els.calRoom.value = current;
  }
}

export function renderCalendar() {
  if (!els) return;
  refreshCalendarRooms();

  els.calMonthLabel.textContent = `${MONTHS[viewMonth]} ${viewYear}`;

  // grade do mes
  els.calGrid.innerHTML = "";
  for (const weekday of WEEKDAYS) {
    const head = document.createElement("span");
    head.className = "cal-weekday";
    head.textContent = weekday;
    els.calGrid.append(head);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = todayKey();

  for (let i = 0; i < firstDay; i += 1) {
    els.calGrid.append(document.createElement("span"));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = dateKey(viewYear, viewMonth, day);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cal-day";
    cell.textContent = String(day);
    if (date === today) cell.classList.add("today");
    if (date === selectedDate) cell.classList.add("selected");
    if (eventsOf(date).length > 0) cell.classList.add("has-events");
    cell.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
    });
    els.calGrid.append(cell);
  }

  // lista de eventos do dia selecionado
  const [, month, day] = selectedDate.split("-");
  els.calDayLabel.textContent = `Eventos de ${day}/${month}`;
  els.calEvents.innerHTML = "";

  const list = eventsOf(selectedDate);
  if (list.length === 0) {
    const empty = document.createElement("small");
    empty.className = "cal-empty";
    empty.textContent = "Nenhum evento neste dia.";
    els.calEvents.append(empty);
  }

  for (const event of list) {
    const row = document.createElement("div");
    row.className = "cal-event";

    const time = document.createElement("span");
    time.className = "cal-event-time";
    time.textContent = event.time || "—";

    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = event.title;
    const author = document.createElement("small");
    author.textContent = event.room
      ? `${event.name} · 📍 ${channelLabel(event.room)}`
      : event.name;
    body.append(title, author);

    row.append(time, body);

    // reuniao com sala: botao para caminhar ate la
    if (event.room) {
      const go = document.createElement("button");
      go.type = "button";
      go.className = "cal-go";
      go.textContent = "ir";
      go.title = `Caminhar ate ${channelLabel(event.room)}`;
      go.addEventListener("click", () => goToRoom?.(event.room));
      row.append(go);
    }

    if (event.userId === selfIdRef()) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button cal-remove";
      remove.textContent = "×";
      remove.title = "Remover evento";
      remove.setAttribute("aria-label", "Remover evento");
      remove.addEventListener("click", () => socketRef.emit("event:remove", { id: event.id }));
      row.append(remove);
    }

    els.calEvents.append(row);
  }
}
