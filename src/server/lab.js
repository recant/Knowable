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
  const reportsBack = /postMessage\s*\(/i.test(html);
  return hasControl && hasScript && hasEvent && reportsBack;
}

function escapeText(value) {
  return String(value || "").replace(/[<>&]/g, "");
}

function isCasinoProbability({ brief, lesson, course }) {
  const text = JSON.stringify({ brief, lesson, course }).toLowerCase();
  return /casino|roulette|house edge|expected value|wager|betting/.test(text);
}

function fallbackVisual(brief = {}) {
  const title = escapeText(brief.title || "See the idea");
  const concept = escapeText(brief.concept || "Change one thing and observe the result");
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

function rouletteFallback(brief = {}) {
  const title = escapeText(brief.title || "Beat the wheel?");
  const task = escapeText(brief.learnerTask || brief.task || "Pick red or black and spin 10 times. Watch what happens to your balance.");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#151715;font-family:Arial,sans-serif}.wrap{height:500px;padding:22px;display:grid;grid-template-columns:minmax(280px,1fr) minmax(250px,.8fr);gap:24px;align-items:center}.wheelArea{display:grid;place-items:center}.wheel{width:300px;height:300px;border-radius:50%;border:14px solid #17382a;position:relative;background:conic-gradient(#c93232 0 9.73deg,#202220 9.73deg 19.46deg,#c93232 19.46deg 29.19deg,#202220 29.19deg 38.92deg,#c93232 38.92deg 48.65deg,#202220 48.65deg 58.38deg,#c93232 58.38deg 68.11deg,#202220 68.11deg 77.84deg,#c93232 77.84deg 87.57deg,#202220 87.57deg 97.3deg,#c93232 97.3deg 107.03deg,#202220 107.03deg 116.76deg,#c93232 116.76deg 126.49deg,#202220 126.49deg 136.22deg,#c93232 136.22deg 145.95deg,#202220 145.95deg 155.68deg,#c93232 155.68deg 165.41deg,#202220 165.41deg 175.14deg,#c93232 175.14deg 184.87deg,#202220 184.87deg 194.6deg,#c93232 194.6deg 204.33deg,#202220 204.33deg 214.06deg,#c93232 214.06deg 223.79deg,#202220 223.79deg 233.52deg,#c93232 233.52deg 243.25deg,#202220 243.25deg 252.98deg,#c93232 252.98deg 262.71deg,#202220 262.71deg 272.44deg,#c93232 272.44deg 282.17deg,#202220 282.17deg 291.9deg,#c93232 291.9deg 301.63deg,#202220 301.63deg 311.36deg,#c93232 311.36deg 321.09deg,#202220 321.09deg 330.82deg,#c93232 330.82deg 340.55deg,#202220 340.55deg 350.28deg,#1f8c50 350.28deg 360deg);transition:transform .8s cubic-bezier(.2,.8,.2,1)}.wheel:after{content:'';position:absolute;inset:46%;border-radius:50%;background:#f4d76c;border:6px solid #17382a}.pointer{font-size:28px;margin-bottom:-10px;z-index:2;color:#17382a}.panel{background:white;border:1px solid #dddeda;border-radius:20px;padding:20px}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#788078;font-weight:800}h2{margin:6px 0 8px;font-size:24px}p{margin:0 0 18px;color:#5f665f;line-height:1.45}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0}.stat{background:#f5f6f1;border-radius:12px;padding:12px}.stat span{display:block;font-size:11px;color:#7a817a}.stat b{display:block;margin-top:4px;font-size:21px}.controls{display:flex;gap:10px}.pick{flex:1;display:flex;gap:8px}.pick button,.spin{border:0;border-radius:12px;padding:13px 15px;font-weight:800;cursor:pointer}.pick button{background:#eceee7}.pick .activeRed{background:#c93232;color:white}.pick .activeBlack{background:#202220;color:white}.spin{background:#a9d638;color:#14200a;min-width:110px}.result{margin-top:14px;border-top:1px solid #eceee7;padding-top:14px;font-size:14px;min-height:34px}.history{margin-top:10px;display:flex;gap:5px;flex-wrap:wrap}.chip{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:white;font-size:10px;font-weight:800}.red{background:#c93232}.black{background:#202220}.green{background:#1f8c50}@media(max-width:700px){.wrap{height:auto;min-height:500px;grid-template-columns:1fr}.wheel{width:240px;height:240px}}
  </style></head><body><div class="wrap"><div class="wheelArea"><div class="pointer">▼</div><div id="wheel" class="wheel"></div></div><div class="panel"><span class="eyebrow">${title}</span><h2>Can you beat even-money roulette?</h2><p>${task}</p><div class="stats"><div class="stat"><span>Balance</span><b id="balance">$100</b></div><div class="stat"><span>Average / spin</span><b id="avg">$0.00</b></div><div class="stat"><span>Wins</span><b id="wins">0</b></div><div class="stat"><span>Spins</span><b id="spins">0</b></div></div><div class="controls"><div class="pick"><button id="red" class="activeRed">Red</button><button id="black">Black</button></div><button id="spin" class="spin">Spin</button></div><div id="result" class="result">Bet is $10. Red/black pays 1:1; green 0 loses.</div><div id="history" class="history"></div></div></div><script>
  const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);let choice='red',balance=100,wins=0,spins=0,profit=0,rotation=0;const wheel=document.getElementById('wheel'),balanceEl=document.getElementById('balance'),avgEl=document.getElementById('avg'),winsEl=document.getElementById('wins'),spinsEl=document.getElementById('spins'),resultEl=document.getElementById('result'),history=document.getElementById('history');
  function colorOf(n){return n===0?'green':reds.has(n)?'red':'black'}function report(event,summary){parent.postMessage({type:'knowable_lab_event',event,summary},'*')}function choose(c){choice=c;document.getElementById('red').className=c==='red'?'activeRed':'';document.getElementById('black').className=c==='black'?'activeBlack':'';report('choice','Learner chose '+c+'.')}document.getElementById('red').addEventListener('click',()=>choose('red'));document.getElementById('black').addEventListener('click',()=>choose('black'));
  document.getElementById('spin').addEventListener('click',()=>{const n=Math.floor(Math.random()*37),color=colorOf(n),won=color===choice;spins++;rotation+=720+Math.floor(Math.random()*360);wheel.style.transform='rotate('+rotation+'deg)';if(won){balance+=10;profit+=10;wins++}else{balance-=10;profit-=10}balanceEl.textContent='$'+balance;avgEl.textContent=(profit/spins>=0?'+$':'-$')+Math.abs(profit/spins).toFixed(2);winsEl.textContent=wins;spinsEl.textContent=spins;resultEl.textContent='Spin '+spins+': '+n+' '+color.toUpperCase()+' — '+(won?'you won $10':'you lost $10');const chip=document.createElement('span');chip.className='chip '+color;chip.textContent=n;history.prepend(chip);while(history.children.length>12)history.removeChild(history.lastChild);report('spin','Spin '+spins+': '+n+' '+color+', '+(won?'won':'lost')+'; balance $'+balance+'.');if(spins%5===0)report('checkpoint','After '+spins+' spins: '+wins+' wins, '+(spins-wins)+' losses, balance $'+balance+', average profit '+(profit/spins).toFixed(2)+' dollars per spin.');});
  report('ready','Roulette lab is ready with a $100 balance and $10 red/black bets.');
  </script></body></html>`);
}

function genericFallback(brief = {}) {
  const title = escapeText(brief.title || "Try it");
  const task = escapeText(brief.learnerTask || brief.task || "Move the control, predict the result, and notice the pattern.");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;background:#fbfbf7;color:#161816;font-family:Arial,sans-serif}.wrap{height:500px;padding:30px;display:grid;place-items:center}.lab{width:min(760px,100%)}h2{margin:0 0 8px;font-size:25px}p{margin:0 0 24px;color:#626960;line-height:1.45}.stage{height:270px;border:1px solid #dfe2d8;border-radius:20px;background:white;display:flex;align-items:center;justify-content:center;overflow:hidden}.dot{width:72px;height:72px;border-radius:50%;background:#a9d638;transform:translateX(0) scale(1);transition:transform .15s ease,border-radius .15s ease}.control{margin-top:22px;display:flex;gap:16px;align-items:center}.control label{font-size:13px;font-weight:700}.control input{flex:1;accent-color:#73920e}.value{width:42px;text-align:right;font-variant-numeric:tabular-nums}
  </style></head><body><div class="wrap"><div class="lab"><h2>${title}</h2><p>${task}</p><div class="stage"><div id="dot" class="dot"></div></div><div class="control"><label for="amount">change it</label><input id="amount" type="range" min="0" max="100" value="40"><span id="value" class="value">40</span></div></div></div><script>
  const slider=document.getElementById('amount'),dot=document.getElementById('dot'),value=document.getElementById('value');function render(){const v=Number(slider.value);value.textContent=v;dot.style.transform='translateX('+((v-50)*3)+'px) scale('+(0.65+v/120)+')';dot.style.borderRadius=(18+v*.35)+'%';}slider.addEventListener('input',render);slider.addEventListener('change',()=>parent.postMessage({type:'knowable_lab_event',event:'checkpoint',summary:'Learner set the control to '+slider.value+' and observed the visual response.'},'*'));render();parent.postMessage({type:'knowable_lab_event',event:'ready',summary:'Interactive lab is ready.'},'*');
  </script></body></html>`);
}

function fallbackLab(input) {
  return isCasinoProbability(input) ? rouletteFallback(input.brief) : genericFallback(input.brief);
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
  return `Create ONE simple supporting SVG for a live tutoring lesson whose PRIMARY experience is an interactive lab.

Current lesson: ${lesson?.title || ""}
Course goal: ${course?.learnerGoal || ""}
Artifact brief: ${JSON.stringify(brief)}

Return ONLY a self-contained <svg>...</svg>. No markdown.
Rules:
- 760x320 viewBox.
- One idea only. No dashboard, no dense labels, no paragraphs.
- At most 8 short text labels.
- Make it understandable in five seconds.
- Prefer arrows, shapes, position, before/after, flow, or comparison.
- No scripts, foreignObject, external images, external fonts, or links.
- Do not use LaTeX syntax.`;
}

function labPrompt({ brief, lesson, course }) {
  const defaultBrief = lesson?.labBrief || {};
  return `Create the PRIMARY interactive teaching experience for this lesson as a complete HTML document.

Current lesson: ${lesson?.title || ""}
Lesson objective: ${lesson?.objective || ""}
Course goal: ${course?.learnerGoal || ""}
Primary lab plan: ${JSON.stringify(defaultBrief)}
Current lab brief: ${JSON.stringify(brief)}

Return ONLY <!doctype html>... full HTML. No markdown or code fences.

This lab is the centerpiece of the lesson. The AI tutor will guide the learner through it.
Hard requirements:
- Build a concrete miniature world, toy, simulation, instrument, or game specific to THIS concept. Do not make a generic dashboard.
- The learner must have one obvious primary action and immediately SEE a meaningful consequence.
- At most TWO controls total. Prefer one main button/drag action plus one optional choice.
- Use vanilla HTML/CSS/JS only. No imports or libraries.
- No network calls, fetch, XHR, storage, navigation, forms, audio, or external assets.
- Fit in about 500px height with no internal scrolling on desktop.
- Use a large visual stage. The interactive object should dominate the space.
- Every control must work with addEventListener and update visible state.
- Initialize the experience on load.
- Do not ask for prose inside the lab; the AI tutor handles conversation.
- Do not use LaTeX syntax.
- Clean product styling: warm neutral background, dark text, subtle borders, lime accent #a9d638.
- The interaction must teach the labBrief concept, not merely animate something decorative.

CRITICAL TUTOR TELEMETRY:
- The lab MUST call parent.postMessage({type:'knowable_lab_event', event:'ready', summary:'...'}, '*') when ready.
- After meaningful user actions, call parent.postMessage with event:'action' or a specific event name and a short human-readable summary.
- At a useful teaching checkpoint, call parent.postMessage({type:'knowable_lab_event', event:'checkpoint', summary:'...'}, '*').
- For repeated experiments, do NOT checkpoint every trial; checkpoint after a meaningful batch such as 5 spins.
- For sliders/drags, update the visual continuously but checkpoint only on change/release.
- The summary must contain the result the tutor needs to reason about.

Example quality bar: if teaching expected value in a casino context, build an actual roulette/wager experience with a visible wheel or equivalent game, a Spin button, balance/outcome history, and a running average—not a slider labeled 'probability'.

Learner task: ${brief?.learnerTask || brief?.task || defaultBrief?.learnerTask || "Interact with the main action and look for the pattern."}`;
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
    scene: lesson?.labBrief?.scene || "a concrete miniature world",
    purpose: lesson?.labBrief?.purpose || "Make the idea concrete.",
    interaction: lesson?.labBrief?.interaction || "one obvious action",
    learnerTask: lesson?.labBrief?.learnerTask || "Try the main action and observe the result.",
    checkpoint: lesson?.labBrief?.checkpoint || "Report a meaningful result to the tutor.",
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

  if (!key) return Response.json({ kind, labHtml: fallbackLab({ brief, lesson, course }) });
  try {
    const generated = secureHtml(await callGemini(key, labPrompt({ brief, lesson, course })));
    const labHtml = isActuallyInteractive(generated) ? generated : fallbackLab({ brief, lesson, course });
    return Response.json({ kind, labHtml });
  } catch (error) {
    console.error("Lab generation failure", error);
    return Response.json({ kind, labHtml: fallbackLab({ brief, lesson, course }) });
  }
}
