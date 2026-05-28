import { randomUUID } from "crypto";
import { AccessToken } from "livekit-server-sdk";
import { sanitizeLiveKitId } from "./sanitizers.js";

export function registerLiveKitTokenRoute(app, config) {
  app.get("/api/livekit-token", async (req, res) => {
    if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) {
      res.status(503).json({
        error:
          "LiveKit nao configurado. Defina LIVEKIT_URL, LIVEKIT_API_KEY e LIVEKIT_API_SECRET."
      });
      return;
    }

    const room = sanitizeLiveKitId(req.query.room, "tec-hq-team");
    const identity = sanitizeLiveKitId(req.query.identity, `guest-${randomUUID()}`);
    const name = String(req.query.name || "Convidado").trim().slice(0, 28);

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
