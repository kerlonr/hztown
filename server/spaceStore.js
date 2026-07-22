export function createSpaceStore() {
  const spaces = new Map();
  const messages = new Map();

  return {
    getSpace(spaceId) {
      if (!spaces.has(spaceId)) {
        spaces.set(spaceId, new Map());
      }
      return spaces.get(spaceId);
    },

    getMessages(spaceId) {
      if (!messages.has(spaceId)) {
        messages.set(spaceId, []);
      }
      return messages.get(spaceId);
    },

    deleteSpace(spaceId) {
      spaces.delete(spaceId);
      messages.delete(spaceId);
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
