export function pickColor() {
  const colors = ["#6ee7b7", "#93c5fd", "#fda4af", "#fcd34d", "#c4b5fd", "#67e8f9"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}
