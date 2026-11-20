const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function handler(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: { message: "Variable GEMINI_API_KEY manquante dans Vercel." }
    });
  }

  // Route GET : lister les modèles disponibles
  if (req.method === "GET") {
    try {
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        headers: { "x-goog-api-key": apiKey }
      });
      const data = await upstream.text();
      res.setHeader("Content-Type", "application/json");
      return res.status(upstream.status).send(data);
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || "Erreur lors de la récupération des modèles." }
      });
    }
  }

  // Route POST : appel au modèle Gemini avec retry automatique sur 503
  if (req.method === "POST") {
    try {
      const model = (req.query && req.query.model) || "gemini-3.8-flash";

      if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
        return res.status(400).json({
          error: { message: "Nom de modèle invalide." }
        });
      }

      const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const maxAttempts = 3;
      let upstream;
      let data = "";

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        upstream = await fetch(googleUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body
        });

        data = await upstream.text();

        // Si succès ou erreur autre que 503, on s'arrête immédiatement
        if (upstream.status !== 503 || attempt === maxAttempts) {
          break;
        }

        // Attente avant la tentative suivante (2,5s puis 5s)
        await sleep(attempt * 2500);
      }

      res.setHeader("Content-Type", "application/json");
      return res.status(upstream.status).send(data);
    } catch (err) {
      return res.status(500).json({
        error: { message: err.message || "Erreur interne du proxy Gemini US." }
      });
    }
  }

  return res.status(405).json({ error: { message: "Méthode non autorisée." } });
};
