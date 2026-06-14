import { randomUUID } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { sanitizeLiveKitId, sanitizeName } from "./sanitizers.js";

// Limite simples por IP para evitar emissao abusiva de tokens.
const RATE_WINDOW_MS = 60000;
const RATE_MAX = 30;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  hits.set(ip, entry);

  // Limpeza preguicosa para nao acumular IPs antigos.
  if (hits.size > 5000) {
    for (const [key, value] of hits) {
      if (now > value.resetAt) hits.delete(key);
    }
  }
  return entry.count > RATE_MAX;
}

export function registerLiveKitTokenRoute(app, config) {
  app.get("/api/livekit-token", async (req, res) => {
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "unknown";
    if (rateLimited(ip)) {
      res.status(429).json({ error: "Muitas requisicoes. Tente novamente em instantes." });
      return;
    }

    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      res.status(503).json({
        error:
          "LiveKit nao configurado. Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET."
      });
      return;
    }

    const room = sanitizeLiveKitId(req.query.room, "tec-hq-team");
    const identity = sanitizeLiveKitId(req.query.identity, `guest-${randomUUID()}`);
    const name = sanitizeName(req.query.name);

    try {
      const token = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
        identity,
        name,
        ttl: "2h"
      });

      token.addGrant({
        room,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true
      });

      res.json({
        url: config.livekitUrl,
        token: await token.toJwt()
      });
    } catch (error) {
      console.error("Falha ao gerar token LiveKit", error);
      res.status(500).json({ error: "Nao foi possivel gerar o token LiveKit." });
    }
  });
}
