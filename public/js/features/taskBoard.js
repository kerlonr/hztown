// Quadro de tarefas colaborativo (kanban estilo Monday):
// colunas A fazer / Fazendo / Feito, com responsavel.
// Qualquer um cria e move tarefas; so quem criou remove.

const COLUMNS = [
  ["todo", "A fazer"],
  ["doing", "Fazendo"],
  ["done", "Feito"]
];

let socketRef = null;
let els = null;
let getName = () => "";
let getUsers = () => [];
let tasks = [];

export function taskCounts() {
  const counts = { todo: 0, doing: 0, done: 0 };
  for (const task of tasks) counts[task.status] = (counts[task.status] || 0) + 1;
  return counts;
}

export function initTaskBoard({ socket, elements, getSelfName, getOnlineUsers }) {
  socketRef = socket;
  els = elements;
  getName = getSelfName;
  getUsers = getOnlineUsers;

  els.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.taskTitle.value.trim();
    if (!title) return;
    socketRef.emit("task:add", { title, assignee: els.taskAssignee.value });
    els.taskTitle.value = "";
  });

  socket.on("space:ready", ({ tasks: initial = [] }) => {
    tasks = initial;
    renderTaskBoard();
  });

  socket.on("task:added", (task) => {
    tasks.push(task);
    renderTaskBoard();
  });

  socket.on("task:updated", (updated) => {
    const index = tasks.findIndex((task) => task.id === updated.id);
    if (index !== -1) tasks[index] = updated;
    renderTaskBoard();
  });

  socket.on("task:removed", (id) => {
    tasks = tasks.filter((task) => task.id !== id);
    renderTaskBoard();
  });

  renderTaskBoard();
}

// Preenche o select de responsavel com quem esta online (mantem a escolha).
export function refreshAssignees() {
  if (!els) return;
  const current = els.taskAssignee.value;
  els.taskAssignee.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = "Sem dono";
  els.taskAssignee.append(none);

  const names = new Set([getName(), ...getUsers().map((user) => user.name)]);
  for (const name of names) {
    if (!name) continue;
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.taskAssignee.append(option);
  }
  if ([...els.taskAssignee.options].some((option) => option.value === current)) {
    els.taskAssignee.value = current;
  }
}

export function renderTaskBoard() {
  if (!els) return;
  refreshAssignees();
  els.taskColumns.innerHTML = "";
  const myName = getName();

  COLUMNS.forEach(([status, label], columnIndex) => {
    const column = document.createElement("div");
    column.className = `task-column task-${status}`;

    const head = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = label;
    const count = document.createElement("small");
    count.textContent = String(tasks.filter((task) => task.status === status).length);
    head.append(title, count);
    column.append(head);

    for (const task of tasks.filter((t) => t.status === status)) {
      const card = document.createElement("article");
      card.className = "task-card";

      const cardTitle = document.createElement("p");
      cardTitle.textContent = task.title;
      card.append(cardTitle);

      const meta = document.createElement("div");
      meta.className = "task-meta";
      const assignee = document.createElement("span");
      assignee.className = `task-assignee ${task.assignee ? "" : "none"}`;
      assignee.textContent = task.assignee || "sem dono";
      assignee.title = "Clique para assumir";
      assignee.addEventListener("click", () => {
        socketRef.emit("task:update", {
          id: task.id,
          assignee: task.assignee === myName ? "" : myName
        });
      });
      meta.append(assignee);
      card.append(meta);

      const controls = document.createElement("div");
      controls.className = "task-controls";

      if (columnIndex > 0) {
        controls.append(taskArrow("‹", "Voltar etapa", () =>
          socketRef.emit("task:update", { id: task.id, status: COLUMNS[columnIndex - 1][0] })
        ));
      }
      if (columnIndex < COLUMNS.length - 1) {
        controls.append(taskArrow("›", "Avancar etapa", () =>
          socketRef.emit("task:update", { id: task.id, status: COLUMNS[columnIndex + 1][0] })
        ));
      }
      if (task.name === myName) {
        controls.append(taskArrow("×", "Remover tarefa", () =>
          socketRef.emit("task:remove", { id: task.id })
        ));
      }
      card.append(controls);
      column.append(card);
    }

    els.taskColumns.append(column);
  });
}

function taskArrow(symbol, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "task-arrow";
  button.textContent = symbol;
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("click", onClick);
  return button;
}
