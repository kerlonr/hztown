// Remove caracteres de controle (inclui quebras de linha) preservando texto normal.
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

export function sanitizeLiveKitId(value, fallback) {
  const text = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 96);
  return text || fallback;
}

export function sanitizeSpaceId(value, fallback = "tec-hq") {
  const text = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .slice(0, 48);
  return text || fallback;
}

export function sanitizeName(value, fallback = "Convidado") {
  const text = String(value || "")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, 28);
  return text || fallback;
}

export function sanitizeText(value, max = 800) {
  return String(value || "")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, max);
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
