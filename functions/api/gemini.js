function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) {
    return new Response(
      JSON.stringify({
        error: {
          message:
            "Binding 'AI' manquant dans Cloudflare Pages. Ajoute un binding Workers AI nommé AI dans Settings > Functions > Bindings, puis redéploie."
        }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const payload = await request.json();
    const parts = payload?.contents?.[0]?.parts || [];
    const textPart = parts.find((p) => p.text)?.text || "";
    const imgPart = parts.find((p) => p.inlineData?.data)?.inlineData;

    if (!imgPart || !imgPart.data) {
      return new Response(
        JSON.stringify({ error: { message: "Aucune image reçue dans la requête." } }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const inputBytes = base64ToUint8Array(imgPart.data);

    // Prompt court optimisé pour Stable Diffusion img2img
    const sdPrompt =
      "flat 2D vector laser cutting blueprint, strictly 3 solid flat colors only: pure blue #0000FF background and cutout holes, pure white #FFFFFF solid shape, crisp pure black #000000 fine engraving lineart, no gradients, no 3D shadows, no wood texture, clean sharp edges";

    const rawResponse = await env.AI.run(
      "@cf/runwayml/stable-diffusion-v1-5-img2img",
      {
        prompt: sdPrompt,
        image: Array.from(inputBytes),
        strength: 0.55, // Plus bas = plus fidèle à l'image d'origine (0.4 à 0.7)
        guidance: 9.0,
        num_steps: 20
      }
    );

    // Conversion de la réponse binaire (ReadableStream ou Uint8Array) en base64
    let outBytes;
    if (rawResponse instanceof Uint8Array) {
      outBytes = rawResponse;
    } else if (rawResponse instanceof ReadableStream) {
      const buf = await new Response(rawResponse).arrayBuffer();
      outBytes = new Uint8Array(buf);
    } else if (rawResponse?.image) {
      outBytes = base64ToUint8Array(rawResponse.image);
    } else {
      throw new Error("Format de réponse Workers AI inattendu.");
    }

    const outBase64 = uint8ArrayToBase64(outBytes);

    // Format compatible avec ton index.html actuel
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: outBase64
                  }
                }
              ]
            }
          }
        ]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: { message: err.message || "Erreur interne Cloudflare Workers AI." }
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function onRequestGet({ env }) {
  return new Response(
    JSON.stringify({
      provider: "Cloudflare Workers AI",
      binding_active: Boolean(env.AI),
      model: "@cf/runwayml/stable-diffusion-v1-5-img2img"
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
