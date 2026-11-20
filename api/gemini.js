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

  // Route POST : appel au modèle Gemini
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

      const upstream = await fetch(googleUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body
      });

      const data = await upstream.text();
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
