const LAB_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none';";

function stripFence(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/^```(?:html|svg|xml)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function cleanSvg(svg) {
  const raw = stripFence(svg);
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < start) return "";
  return raw
    .slice(start, end + 6)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])(?:https?:|javascript:).*?\1/gi, "");
}

function secureHtml(html) {
  let raw = stripFence(html);
  const doctype = raw.search(/<!doctype html>/i);
  const htmlStart = raw.search(/<html[\s>]/i);
  const start = doctype >= 0 ? doctype : htmlStart >= 0 ? htmlStart : 0;
  raw = raw.slice(start);
  raw = raw
    .replace(/<script[^>]+src\s*=\s*(["']).*?\1[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+href\s*=\s*(["'])(?:https?:).*?\1[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "");

  const csp = `<meta http-equiv="Content-Security-Policy" content="${LAB_CSP}">`;
  if (/<head[\s>]/i.test(raw)) raw = raw.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
  else raw = `<!doctype html><html><head>${csp}</head><body>${raw}</body></html>`;
  return raw;
}

function isActuallyInteractive(html) {
  const hasControl = /<(input|button|select|canvas)\b/i.test(html) || /<svg\b/i.test(html);
  const hasScript = /<script\b/i.test(html);
  const hasEvent = /addEventListener|oninput\s*=|onclick\s*=|onchange\s*=/i.test(html);
  return hasControl && hasScript && hasEvent;
}

function fallbackVisual(brief = {}) {
  const title = String(brief.title || "See the idea").replace(/[<>&]/g, "");
  const concept = String(brief.concept || "Change one thing and observe the result").replace(/[<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 320" role="img" aria-label="${title}">
  <rect width="760" height="320" rx="24" fill="#f7f7f2"/>
  <text x="52" y="64" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#7b8179">${title}</text>
  <rect x="76" y="124" width="164" height="86" rx="18" fill="#ffffff" stroke="#d9dcd2"/>
  <rect x="298" y="124" width="164" height="86" rx="18" fill="#eff7d4" stroke="#cfe38d"/>
  <rect x="520" y="124" width="164" height="86" rx="18" fill="#ffffff" stroke="#d9dcd2"/>
  <path d="M240 167 H294 M462 167 H516" stroke="#1d3328" stroke-width="4" stroke-linecap="round"/>
  <path d="M286 158 L298 167 L286 176 M508 158 L520 167 L508 176" fill="none" stroke="#1d3328" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="158" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">input</text>
  <text x="380" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">rule</text>
  <text x="602" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">result</text>
  <text x="380" y="262" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#5e655f">${concept.slice(0, 78)}</text>
</svg>`;
}

function fallbackLab(brief = {}) {
  const title = String(brief.title || "Try it").replace(/[<>&]/g, "");
  const task = String(brief.task || "Move the slider. What changes, and what stays the same?").replace(/[<>&]/g, "");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#fbfbf7;color:#161816;font-family:Arial,sans-serif}.wrap{min-height:360px;padding:28px;display:grid;place-items:center}.lab{width:min(680px,100%)}h2{margin:0 0 8px;font-size:22px}p{margin:0 0 24px;color:#626960;line-height:1.45}.stage{height:180px;border:1px solid #dfe2d8;border-radius:18px;background:white;display:flex;align-items:center;justify-content:center;overflow:hidden}.dot{width:58px;height:58px;border-radius:50%;background:#a9d638;transform:scale(1);transition:transform .12s ease, border-radius .12s ease}.control{margin-top:22px;display:flex;gap:16px;align-items:center}.control label{font-size:13px;font-weight:700}.control input{flex:1;accent-color:#73920e}.value{width:42px;text-align:right;font-variant-numeric:tabular-nums}
  </style></head><body><div class="wrap"><div class="lab"><h2>${title}</h2><p>${task}</p><div class="stage"><div id="dot" class="dot"></div></div><div class="control"><label for="amount">amount</label><input id="amount" type="range" min="10" max="100" value="45"><span id="value" class="value">45</span></div></div></div><script>
  const slider=document.getElementById('amount');const dot=document.getElementById('dot');const value=document.getElementById('value');function render(){const v=Number(slider.value);value.textContent=v;dot.style.transform='scale('+(0.55+v/90)+')';dot.style.borderRadius=(20+v*0.3)+'%';}slider.addEventListener('input',render);render();
  </script></body></html>`);
}

async function callGemini(key, prompt) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) {
    console.error("Artifact generation error", response.status, await response.text());
    return "";
  }
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim() || "";
}

function visualPrompt({ brief, lesson, course }) {
  return `Create ONE simple explanatory SVG for a live tutoring conversation.

Current lesson: ${lesson?.title || ""}
Course goal: ${course?.learnerGoal || ""}
Artifact brief: ${JSON.stringify(brief)}

Return ONLY a self-contained <svg>...</svg>. No markdown.
Rules:
- 760x320 viewBox.
- One idea only. No dashboard, no dense labels, no paragraphs.
- Use at most 8 short text labels.
- Make the visual understandable in five seconds.
- Prefer arrows, shapes, position, before/after, flow, or comparison.
- Large readable text and generous whitespace.
- No scripts, foreignObject, external images, external fonts, or links.
- Do not use LaTeX syntax. Use plain labels.`;
}

function labPrompt({ brief, lesson, course }) {
  return `Create ONE tiny interactive teaching lab as a complete HTML document.

Current lesson: ${lesson?.title || ""}
Course goal: ${course?.learnerGoal || ""}
Artifact brief: ${JSON.stringify(brief)}

Return ONLY <!doctype html>... full HTML. No markdown or code fences.

This is not a demo dashboard. It is one manipulable idea inside a tutoring conversation.
Hard requirements:
- The learner must be able to change something and immediately SEE a meaningful result change.
- At most TWO controls total. Prefer one slider or 2-3 buttons.
- Use vanilla HTML/CSS/JS only. No imports or libraries.
- No network calls, fetch, XHR, storage, navigation, forms, audio, or external assets.
- Entire lab must fit comfortably in 360px height with no scrolling.
- One short title and ONE sentence of instruction; no explanatory paragraphs.
- Use a large visual area: SVG, canvas, shapes, diagram, or simple objects.
- Every control must have a working addEventListener and update the visual state.
- Initialize the visual by calling the render/update function once on load.
- Use large hit targets and obvious affordances.
- If the concept is abstract, invent the simplest concrete analogy that preserves the key relationship.
- Do not ask the learner to type prose into the lab; the main tutor handles conversation.
- Do not use LaTeX syntax.
- Style it cleanly: light neutral background, dark text, subtle borders, one lime accent (#a9d638).

The lab should make this task possible: ${brief?.task || "Change one variable and predict what will happen."}`;
}

export async function handleLabRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const lesson = input?.lesson || {};
  const course = input?.course || {};
  const brief = input?.brief || {
    kind: "lab",
    title: lesson?.labBrief?.title || "Try it",
    concept: lesson?.labBrief?.concept || lesson?.objective || "current concept",
    purpose: lesson?.labBrief?.purpose || "Make the idea concrete.",
    task: lesson?.labBrief?.instruction || "Change one thing and observe the result.",
  };
  const kind = brief?.kind === "visual" ? "visual" : "lab";
  const key = env?.GEMINI_API_KEY;

  if (kind === "visual") {
    if (!key) return Response.json({ kind, visualSvg: fallbackVisual(brief) });
    try {
      const generated = cleanSvg(await callGemini(key, visualPrompt({ brief, lesson, course })));
      return Response.json({ kind, visualSvg: generated || fallbackVisual(brief) });
    } catch (error) {
      console.error("Visual generation failure", error);
      return Response.json({ kind, visualSvg: fallbackVisual(brief) });
    }
  }

  if (!key) return Response.json({ kind, labHtml: fallbackLab(brief) });
  try {
    const generated = secureHtml(await callGemini(key, labPrompt({ brief, lesson, course })));
    const labHtml = isActuallyInteractive(generated) ? generated : fallbackLab(brief);
    return Response.json({ kind, labHtml });
  } catch (error) {
    console.error("Lab generation failure", error);
    return Response.json({ kind, labHtml: fallbackLab(brief) });
  }
}
