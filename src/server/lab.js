import { generateGeminiText } from "./gemini";

const LAB_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none';";

function stripFence(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/^```(?:html|svg|xml|json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function escapeText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cleanSvg(svg) {
  const raw = stripFence(svg);
  const start = raw.indexOf("<svg");
  const end = raw.lastIndexOf("</svg>");
  if (start < 0 || end < start) return "";
  return raw
    .slice(start, end + 6)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s(?:href|xlink:href)\s*=\s*(["'])(?:https?:|javascript:).*?\1/gi, "");
}

function secureHtml(html) {
  let raw = stripFence(html);
  const doctype = raw.search(/<!doctype html>/i);
  const htmlStart = raw.search(/<html[\s>]/i);
  const start = doctype >= 0 ? doctype : htmlStart >= 0 ? htmlStart : 0;
  raw = raw.slice(start)
    .replace(/<script[^>]+src\s*=\s*(["']).*?\1[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]+href\s*=\s*(["'])(?:https?:).*?\1[^>]*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>/gi, "");

  const csp = `<meta http-equiv="Content-Security-Policy" content="${LAB_CSP}">`;
  if (/<head[\s>]/i.test(raw)) return raw.replace(/<head([^>]*)>/i, `<head$1>${csp}`);
  return `<!doctype html><html><head>${csp}</head><body>${raw}</body></html>`;
}

function isInteractive(html) {
  const hasControl = /<(input|button|select|canvas)\b/i.test(html) || /<svg\b/i.test(html);
  const hasScript = /<script\b/i.test(html);
  const hasEvent = /addEventListener|oninput\s*=|onclick\s*=|onchange\s*=/i.test(html);
  const reportsBack = /postMessage\s*\(/i.test(html);
  return hasControl && hasScript && hasEvent && reportsBack;
}

function parseJson(text) {
  const cleaned = stripFence(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("reviewer returned no JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function fallbackVisual(brief = {}) {
  const title = escapeText(brief.title || "See the idea");
  const concept = escapeText(brief.concept || "Change one thing and observe what follows");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 320" role="img" aria-label="${title}">
  <rect width="760" height="320" rx="24" fill="#f7f7f2"/>
  <text x="52" y="64" font-family="Arial,sans-serif" font-size="15" font-weight="700" fill="#7b8179">${title}</text>
  <rect x="76" y="124" width="164" height="86" rx="18" fill="#ffffff" stroke="#d9dcd2"/>
  <rect x="298" y="124" width="164" height="86" rx="18" fill="#eff7d4" stroke="#cfe38d"/>
  <rect x="520" y="124" width="164" height="86" rx="18" fill="#ffffff" stroke="#d9dcd2"/>
  <path d="M240 167 H294 M462 167 H516" stroke="#1d3328" stroke-width="4" stroke-linecap="round"/>
  <path d="M286 158 L298 167 L286 176 M508 158 L520 167 L508 176" fill="none" stroke="#1d3328" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="158" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">action</text>
  <text x="380" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">mechanism</text>
  <text x="602" y="158" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#161816">result</text>
  <text x="380" y="262" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#5e655f">${concept.slice(0, 78)}</text>
</svg>`;
}

function genericFallback(brief = {}) {
  const title = escapeText(brief.title || "Try it");
  const task = escapeText(brief.learnerTask || brief.task || "Move the control, predict the result, and notice the pattern.");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#fbfbf7;color:#161816;font-family:Arial,sans-serif}.wrap{height:500px;padding:30px;display:grid;place-items:center}.lab{width:min(760px,100%)}h2{margin:0 0 8px;font-size:25px}p{margin:0 0 24px;color:#626960;line-height:1.45}.stage{height:270px;border:1px solid #dfe2d8;border-radius:20px;background:white;display:flex;align-items:center;justify-content:center;overflow:hidden}.dot{width:72px;height:72px;border-radius:50%;background:#a9d638;transform:translateX(0) scale(1);transition:transform .15s ease,border-radius .15s ease}.control{margin-top:22px;display:flex;gap:16px;align-items:center}.control label{font-size:13px;font-weight:700}.control input{flex:1;accent-color:#73920e}.value{width:42px;text-align:right;font-variant-numeric:tabular-nums}
  </style></head><body><div class="wrap"><div class="lab"><h2>${title}</h2><p>${task}</p><div class="stage"><div id="dot" class="dot"></div></div><div class="control"><label for="amount">change it</label><input id="amount" type="range" min="0" max="100" value="40"><span id="value" class="value">40</span></div></div></div><script>
  const slider=document.getElementById('amount'),dot=document.getElementById('dot'),value=document.getElementById('value');
  function report(event,summary){parent.postMessage({type:'knowable_lab_event',event,summary},'*')}
  function render(){const v=Number(slider.value);value.textContent=v;dot.style.transform='translateX('+((v-50)*3)+'px) scale('+(0.65+v/120)+')';dot.style.borderRadius=(18+v*.35)+'%';report('checkpoint','The learner moved the generic fallback control to '+v+'.');}
  slider.addEventListener('input',render);report('ready','Generic fallback lab ready.');
  </script></body></html>`);
}

function generationPrompt(input) {
  const lesson = input?.lesson || {};
  const brief = input?.brief || lesson?.labBrief || {};
  return `You build the primary interactive learning lab for Knowable.

COURSE
${JSON.stringify({ title: input?.course?.title, learnerGoal: input?.course?.learnerGoal, successMetric: input?.course?.successMetric }, null, 2)}

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas, labBrief: lesson.labBrief }, null, 2)}

LAB BRIEF
${JSON.stringify(brief, null, 2)}

Create the most pedagogically appropriate miniature interactive world for THIS lesson. Do not reuse a topic-specific template. Infer the objects, controls, simulation, geometry, labels, and rules from the lesson itself.

Requirements:
- Return ONLY one complete <!doctype html> document. No markdown.
- Vanilla HTML/CSS/JavaScript only.
- The learner must manipulate something and immediately see a meaningful consequence.
- Use the exact learner task as a contract: every named action/control must exist and work.
- The simulation must be factually, mathematically, and scientifically correct.
- If the lesson does not justify an exact numerical relationship, do not invent one.
- Prefer one obvious primary action and at most one secondary control unless more are genuinely necessary.
- Fit in a roughly 760px-wide, 500px-tall iframe and work with mouse/touch.
- No network access, imports, external assets, storage, forms that submit, iframes, popups, navigation, audio, or external libraries.
- Include parent.postMessage({type:'knowable_lab_event', event, summary}, '*') telemetry.
- Send a 'ready' event on load, concise action events during interaction, and a 'checkpoint' after a meaningful experiment/result that the tutor can discuss.
- Telemetry summaries must report what actually happened, with relevant values/outcomes when applicable.
- The visible visualization must agree with the underlying state and reported result.
- Keep instructions short; the tutor supplies the teaching narrative.`;
}

function visualPrompt(input) {
  const lesson = input?.lesson || {};
  const brief = input?.brief || {};
  return `Create one small static supporting SVG for a Knowable tutor message.

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas }, null, 2)}

VISUAL BRIEF
${JSON.stringify(brief, null, 2)}

Return ONLY one self-contained <svg>...</svg>. No markdown. Use SVG primitives and text only. No scripts, foreignObject, external URLs, images, or event handlers. The visual should clarify exactly the requested structure; it is secondary to the lesson's interactive lab.`;
}

function auditPrompt(input, html) {
  const lesson = input?.lesson || {};
  const brief = input?.brief || lesson?.labBrief || {};
  return `You are a strict verifier for an educational interactive simulation. Do not grade style. Decide whether the executable lab is factually, mathematically, scientifically, and internally correct for the lesson.

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas, labBrief: lesson.labBrief })}

CURRENT BRIEF
${JSON.stringify(brief)}

HTML/JS TO AUDIT
${html}

Check all of these:
1. Every control or action named in the learner task exists, has the same meaning, and actually works.
2. Instructions never tell the learner to do something the interface cannot do.
3. Numeric formulas, probabilities, counters, units, signs, averages, balances, geometry, and state updates are correct.
4. The visible visualization agrees with the underlying state/result.
5. Scientific or mathematical causal relationships are not invented, reversed, or oversimplified into a false rule.
6. Random simulations sample the stated distribution correctly.
7. Labels and telemetry summaries describe what actually happened.
8. There are no obvious JavaScript logic bugs that make the lesson teach a false result.

Return ONLY JSON:
{"pass":true,"issues":[]}
or
{"pass":false,"issues":["specific correctness problem", "..."]}`;
}

function repairPrompt(input, html, issues) {
  const lesson = input?.lesson || {};
  const brief = input?.brief || lesson?.labBrief || {};
  return `Repair this educational interactive lab. Preserve its pedagogical intent, but fix EVERY listed correctness or functionality problem and any related logic bug.

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas, labBrief: lesson.labBrief }, null, 2)}

BRIEF
${JSON.stringify(brief, null, 2)}

VERIFIED PROBLEMS
${JSON.stringify(issues, null, 2)}

CURRENT HTML
${html}

Requirements:
- Return ONLY one complete <!doctype html> document. No markdown.
- Do not replace the lesson with a generic template; repair the lesson-specific experience.
- Every explicitly named learner-task control must exist and work.
- All formulas, probabilities, units, counters, state transitions, and visible results must be correct.
- If exact quantitative behavior is not justified, remove the fake number rather than inventing one.
- Preserve parent.postMessage telemetry for ready/actions/checkpoints.
- Vanilla HTML/CSS/JS only; no network access, imports, storage, forms, navigation, audio, or external assets.`;
}

async function auditLab(input, html, key) {
  if (!key) return { pass: isInteractive(html), issues: isInteractive(html) ? [] : ["Lab is not observably interactive or does not report events to the tutor."] };
  const review = await generateGeminiText(key, auditPrompt(input, html), { label: "Lab correctness audit" });
  if (!review.ok) return { pass: true, issues: [], unavailable: true };
  try {
    const verdict = parseJson(review.text);
    return {
      pass: verdict?.pass === true,
      issues: Array.isArray(verdict?.issues) ? verdict.issues.map(String).slice(0, 12) : [],
    };
  } catch (error) {
    console.error("Lab audit parse failure", error);
    return { pass: true, issues: [], unavailable: true };
  }
}

async function generateLab(input, env) {
  const brief = input?.brief || input?.lesson?.labBrief || {};
  const key = env?.GEMINI_API_KEY;
  if (!key) return { labHtml: genericFallback(brief), demo: true, verified: false };

  const generated = await generateGeminiText(key, generationPrompt(input), { label: "Lab generation" });
  if (!generated.ok) return { labHtml: genericFallback(brief), demo: true, verified: false };

  let html = secureHtml(generated.text);
  let issues = [];
  if (!isInteractive(html)) issues.push("The generated lab is not actually interactive or does not report lab events with parent.postMessage.");

  if (issues.length === 0) {
    const audit = await auditLab(input, html, key);
    if (audit.pass) return { labHtml: html, demo: false, verified: !audit.unavailable, model: generated.model };
    issues = audit.issues.length ? audit.issues : ["The correctness audit rejected the generated lab."];
  }

  const repaired = await generateGeminiText(key, repairPrompt(input, html, issues), { label: "Lab correctness repair" });
  if (!repaired.ok) return { labHtml: genericFallback(brief), demo: true, verified: false };

  const fixed = secureHtml(repaired.text);
  if (!isInteractive(fixed)) return { labHtml: genericFallback(brief), demo: true, verified: false };

  const finalAudit = await auditLab(input, fixed, key);
  if (!finalAudit.pass) {
    console.error("Repaired lab still failed correctness audit", finalAudit.issues);
    return { labHtml: genericFallback(brief), demo: true, verified: false };
  }

  return { labHtml: fixed, demo: false, verified: !finalAudit.unavailable, model: repaired.model };
}

async function generateVisual(input, env) {
  const brief = input?.brief || {};
  const key = env?.GEMINI_API_KEY;
  if (!key) return { visualSvg: fallbackVisual(brief), demo: true };

  const generated = await generateGeminiText(key, visualPrompt(input), { label: "Teaching visual" });
  if (!generated.ok) return { visualSvg: fallbackVisual(brief), demo: true };

  const visualSvg = cleanSvg(generated.text);
  if (!visualSvg) return { visualSvg: fallbackVisual(brief), demo: true };
  return { visualSvg, demo: false, model: generated.model };
}

export async function handleLabRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!input?.lesson) return Response.json({ error: "lesson is required" }, { status: 400 });

  try {
    if (input?.brief?.kind === "visual") {
      return Response.json({ kind: "visual", ...(await generateVisual(input, env)) });
    }
    return Response.json({ kind: "lab", ...(await generateLab(input, env)) });
  } catch (error) {
    console.error("Lab generation error", error);
    if (input?.brief?.kind === "visual") {
      return Response.json({ kind: "visual", visualSvg: fallbackVisual(input?.brief), demo: true });
    }
    return Response.json({ kind: "lab", labHtml: genericFallback(input?.brief || input?.lesson?.labBrief), demo: true, verified: false });
  }
}
