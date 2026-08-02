const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

export async function generateGeminiText(key, prompt, { label = "Gemini" } = {}) {
  if (!key) {
    return { ok: false, text: "", model: null, status: 0, detail: "missing API key" };
  }

  let last = { ok: false, text: "", model: null, status: 0, detail: "request failed" };

  for (let index = 0; index < MODELS.length; index += 1) {
    const model = MODELS[index];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim() || "";
      return { ok: true, text, model, status: response.status, detail: "" };
    }

    const detail = await response.text();
    last = { ok: false, text: "", model, status: response.status, detail };
    console.error(`${label} model error`, model, response.status, detail);

    const canFallback = index < MODELS.length - 1 && (response.status === 429 || response.status === 404);
    if (canFallback) {
      console.warn(`${label}: falling back from ${model} to ${MODELS[index + 1]}`);
      continue;
    }

    break;
  }

  return last;
}
