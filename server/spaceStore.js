export function createSpaceStore() {
  const spaces = new Map();
  const messages = new Map();
  const notes = new Map(); // post-its do mural, por espaco
  const events = new Map(); // eventos da agenda, por espaco
  const desks = new Map(); // mesas reivindicadas (dono, decoracao, recados), por espaco
  const roomLocks = new Map(); // salas trancadas (privadas), por espaco
  const props = new Map(); // moveis colocados pelos usuarios (modo construir), por espaco
  const tasks = new Map(); // quadro de tarefas (kanban), por espaco

  const lazy = (map, spaceId, make) => {
    if (!map.has(spaceId)) map.set(spaceId, make());
    return map.get(spaceId);
  };

  return {
    getSpace(spaceId) {
      return lazy(spaces, spaceId, () => new Map());
    },

    getMessages(spaceId) {
      return lazy(messages, spaceId, () => []);
    },

    getNotes(spaceId) {
      return lazy(notes, spaceId, () => []);
    },

    getEvents(spaceId) {
      return lazy(events, spaceId, () => []);
    },

    getDesks(spaceId) {
      return lazy(desks, spaceId, () => new Map());
    },

    getRoomLocks(spaceId) {
      return lazy(roomLocks, spaceId, () => new Map());
    },

    getProps(spaceId) {
      return lazy(props, spaceId, () => []);
    },

    getTasks(spaceId) {
      return lazy(tasks, spaceId, () => []);
    },

    deleteSpace(spaceId) {
      spaces.delete(spaceId);
      messages.delete(spaceId);
      notes.delete(spaceId);
      // agenda, mesas e trancas sobrevivem ao espaco esvaziar (memoria do escritorio)
    }
  };
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    color: user.color,
    avatar: user.avatar,
    x: user.x,
    y: user.y,
    channel: user.channel,
    inVoice: user.inVoice,
    muted: user.muted
  };
}
