export async function onRequestPost({ request, env }) {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: { message: "Variable GEMINI_API_KEY manquante dans Cloudflare Pages." }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const reqUrl = new URL(request.url);
    const model = reqUrl.searchParams.get("model") || "gemini-2.5-flash-image";

    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      return new Response(
        JSON.stringify({ error: { message: "Nom de modèle invalide." } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.text();
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

    return new Response(data, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: err.message || "Erreur interne du proxy Gemini." } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestGet({ env }) {
  const apiKey = env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: { message: "Variable GEMINI_API_KEY manquante dans Cloudflare Pages." }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
      headers: { "x-goog-api-key": apiKey }
    });
    const data = await res.text();

    return new Response(data, {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: { message: err.message || "Erreur lors de la récupération des modèles." } }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
