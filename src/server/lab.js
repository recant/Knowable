const LAB_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none';";

function stripFence(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/^```(?:html|svg|xml)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseExperience(text) {
  const source = String(text || "");
  const visualMarker = "---VISUAL---";
  const labMarker = "---LAB---";
  const visualAt = source.indexOf(visualMarker);
  const labAt = source.indexOf(labMarker);
  if (visualAt === -1 || labAt === -1 || labAt <= visualAt) {
    throw new Error("Gemini did not return the expected visual/lab markers");
  }
  const visual = stripFence(source.slice(visualAt + visualMarker.length, labAt));
  const lab = stripFence(source.slice(labAt + labMarker.length));
  return { visualSvg: visual, labHtml: lab };
}

function sanitizeSvg(svg) {
  let out = String(svg || "");
  const start = out.indexOf("<svg");
  const end = out.lastIndexOf("</svg>");
  if (start >= 0 && end > start) out = out.slice(start, end + 6);
  out = out
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])(?!#|data:)[\s\S]*?\1/gi, "")
    .replace(/url\(\s*["']?https?:[\s\S]*?\)/gi, "none");
  return out;
}

function hardenLabHtml(html) {
  let out = String(html || "").trim();
  if (!out) return "";
  out = out
    .replace(/<script\b[^>]*\bsrc\s*=\s*(["'])[\s\S]*?\1[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\bhref\s*=\s*(["'])(?:https?:)?\/\/[\s\S]*?\1[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "");

  const safetyHead = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${LAB_CSP}"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_self">`;
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${safetyHead}`);
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${safetyHead}</head>`);
  } else {
    out = `<!doctype html><html><head>${safetyHead}</head><body>${out}</body></html>`;
  }
  return out;
}

function fallbackSvg(lesson) {
  const title = String(lesson?.title || "Concept").replace(/[<>&"]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 460" role="img" aria-label="${title}">
    <defs>
      <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#d9ff61"/><stop offset="1" stop-color="#9ee7ff"/></linearGradient>
    </defs>
    <rect width="900" height="460" rx="28" fill="#111b31"/>
    <circle cx="190" cy="230" r="74" fill="#1d2d4d" stroke="#87a4d9" stroke-width="2"/>
    <circle cx="450" cy="230" r="74" fill="url(#g)"/>
    <circle cx="710" cy="230" r="74" fill="#1d2d4d" stroke="#87a4d9" stroke-width="2"/>
    <path d="M264 230H368M524 230H636" stroke="#edf3ff" stroke-width="6" stroke-linecap="round"/>
    <text x="450" y="92" text-anchor="middle" fill="#f4f7ff" font-family="Arial,sans-serif" font-size="34" font-weight="700">${title}</text>
    <text x="190" y="238" text-anchor="middle" fill="#f4f7ff" font-family="Arial,sans-serif" font-size="18">input</text>
    <text x="450" y="238" text-anchor="middle" fill="#102018" font-family="Arial,sans-serif" font-size="18" font-weight="700">mechanism</text>
    <text x="710" y="238" text-anchor="middle" fill="#f4f7ff" font-family="Arial,sans-serif" font-size="18">outcome</text>
  </svg>`;
}

function fallbackLab(lesson) {
  const title = String(lesson?.labBrief?.title || "Explore the idea").replace(/[<>&"]/g, "");
  return hardenLabHtml(`<!doctype html>
<html>
<head>
<style>
  :root{font-family:Inter,system-ui,sans-serif;color:#f6f8ff;background:#0e1628}
  *{box-sizing:border-box}
  body{margin:0;padding:24px}
  .card{border:1px solid #2b3b60;border-radius:20px;background:#121e34;padding:22px;min-height:330px}
  h2{margin:0 0 8px;font-size:22px}
  p{margin:0 0 24px;color:#aebbd5;line-height:1.5}
  .stage{height:150px;display:grid;place-items:center;border-radius:16px;background:#0b1221;border:1px solid #253555}
  .orb{width:70px;height:70px;border-radius:50%;background:linear-gradient(135deg,#d9ff61,#7ed7ff);transform:scale(var(--s,1));transition:.15s ease}
  label{display:block;margin-top:24px;color:#dfe7f7;font-size:13px}
  input{width:100%;margin-top:10px;accent-color:#d9ff61}
  .readout{margin-top:12px;color:#d9ff61;font-weight:700}
</style>
</head>
<body>
<div class="card">
  <h2>${title}</h2>
  <p>Change the control. Before moving it, predict what should happen and explain why.</p>
  <div class="stage"><div class="orb" id="orb"></div></div>
  <label>Strength <input id="range" type="range" min="20" max="140" value="70"></label>
  <div class="readout" id="readout">70</div>
</div>
<script>
const range=document.getElementById("range");
const orb=document.getElementById("orb");
const readout=document.getElementById("readout");
function render(){const v=Number(range.value);orb.style.setProperty("--s",v/70);readout.textContent=v<60?"small effect":v<100?"moderate effect":"large effect";}
range.addEventListener("input",render);render();
</script>
</body>
</html>`);
}

function buildPrompt({ lesson, course }) {
  return `You design interactive learning experiences for Knowable.

Course: ${course?.title || ""}
Learner goal: ${course?.learnerGoal || ""}
Success metric: ${course?.successMetric || ""}

Current lesson:
${JSON.stringify(
  {
    title: lesson?.title,
    objective: lesson?.objective,
    explanation: lesson?.explanation,
    keyIdeas: lesson?.keyIdeas,
    visualBrief: lesson?.visualBrief,
    labBrief: lesson?.labBrief,
  },
  null,
  2,
)}

Create TWO assets for this lesson:

1) A useful explanatory SVG diagram/illustration.
2) A bespoke interactive browser lab that makes the learner discover the lesson's core idea by manipulating something.

The lab can be ANY interaction that is pedagogically appropriate: drag-and-drop, sliders, simulation, clickable diagram, construction, matching, animation controls, timeline, circuit, molecule, graph, spatial model, algorithm visualizer, keyboard, map, classification exercise, etc. Do not force the lesson into a generic graph.

Technical rules:
- SVG must be self-contained and use only SVG primitives/text/styles.
- Lab must be one complete self-contained HTML document using HTML/CSS/vanilla JavaScript only.
- No external libraries, URLs, imports, network calls, fetch, WebSockets, storage, forms that submit, iframes, popups, or navigation.
- Lab should fit comfortably in a 720px-wide iframe and work with mouse/touch.
- Make the visual design restrained and polished: dark navy/ink, warm white, lime accents, subtle blue secondary accents.
- Prefer labels and visual feedback over long instructions.
- The learner should be able to infer something by experimenting, not merely watch an animation.
- Do not include markdown fences.

Return EXACTLY this format:
---VISUAL---
<svg ...>...</svg>
---LAB---
<!doctype html><html>...</html>`;
}

export async function handleLabRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!input?.lesson) {
    return Response.json({ error: "lesson is required" }, { status: 400 });
  }

  const key = env?.GEMINI_API_KEY;
  if (!key) {
    return Response.json({
      visualSvg: fallbackSvg(input.lesson),
      labHtml: fallbackLab(input.lesson),
      demo: true,
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini lab error", response.status, detail);
      return Response.json({
        visualSvg: fallbackSvg(input.lesson),
        labHtml: fallbackLab(input.lesson),
        demo: true,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

    const parsed = parseExperience(text);
    const visualSvg = sanitizeSvg(parsed.visualSvg);
    const labHtml = hardenLabHtml(parsed.labHtml);
    if (!visualSvg.includes("<svg") || !labHtml.includes("<html")) {
      throw new Error("Gemini returned incomplete lesson assets");
    }

    return Response.json({ visualSvg, labHtml, demo: false });
  } catch (error) {
    console.error("Gemini lab generation/parsing error", error);
    return Response.json({
      visualSvg: fallbackSvg(input.lesson),
      labHtml: fallbackLab(input.lesson),
      demo: true,
    });
  }
}
