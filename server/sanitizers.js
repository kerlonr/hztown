export function sanitizeLiveKitId(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 96);
  return text || fallback;
}

export function sanitizeAvatar(value) {
  const avatar = String(value || "").trim();
  if (avatar.startsWith("default:")) {
    return avatar.slice(0, 48);
  }
  if (/^data:image\/(png|jpeg|jpg|webp);base64,[a-zA-Z0-9+/=]+$/.test(avatar)) {
    return avatar.slice(0, 180000);
  }
  return "";
}
