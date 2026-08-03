import { handleLabRequest as handleGeneratedLabRequest } from "./lab";
import { generateGeminiText } from "./gemini";

const LAB_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none';";

function stripFence(text) {
  if (typeof text !== "string") return "";
  return text.trim().replace(/^```(?:html|json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function escapeText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function isCasinoProbability(input) {
  const text = JSON.stringify(input || {}).toLowerCase();
  return /roulette|casino|house edge|even-money|expected value.*bet|wager/.test(text);
}

function quotedControlLabels(task) {
  const labels = [];
  const text = String(task || "");
  const regex = /["'“”]([^"'“”]{2,50})["'“”]/g;
  let match;
  while ((match = regex.exec(text))) labels.push(match[1].trim());
  return [...new Set(labels)].slice(0, 8);
}

function obviousTaskMismatch(task, html) {
  const source = String(html || "").toLowerCase().replace(/\s+/g, " ");
  return quotedControlLabels(task).filter((label) => !source.includes(label.toLowerCase().replace(/\s+/g, " ")));
}

function parseJson(text) {
  const cleaned = stripFence(text);
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("reviewer returned no JSON");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function verifiedRouletteLab(brief = {}) {
  const title = escapeText(brief.title || "European roulette");
  const task = escapeText(brief.learnerTask || brief.task || "Bet $10 on red and run several batches of 100 spins. Watch the average profit per spin.");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#151715;font-family:Arial,sans-serif}.wrap{height:500px;padding:20px;display:grid;grid-template-columns:minmax(330px,1fr) minmax(290px,.82fr);gap:22px;align-items:center}.wheelArea{display:grid;place-items:center;min-width:0}.pointer{width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:18px solid #17382a;margin-bottom:-3px;z-index:3}.wheel{width:320px;height:320px;border-radius:50%;position:relative;background:#17382a;border:12px solid #17382a;box-shadow:inset 0 0 0 3px #315b49;transition:transform .75s cubic-bezier(.2,.8,.2,1)}.pocket{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px;border-radius:50%;display:grid;place-items:center;color:white;font-size:9px;font-weight:800;border:1px solid rgba(255,255,255,.45);transform-origin:14px 14px}.pocket.red{background:#c93232}.pocket.black{background:#202220}.pocket.green{background:#1f8c50}.hub{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;background:#f4d76c;border:8px solid #17382a;z-index:2}.panel{background:white;border:1px solid #dddeda;border-radius:20px;padding:19px}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#788078;font-weight:800}h2{margin:6px 0 7px;font-size:22px}p{margin:0 0 15px;color:#5f665f;line-height:1.4;font-size:13px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0}.stat{background:#f5f6f1;border-radius:11px;padding:10px}.stat span{display:block;font-size:10px;color:#7a817a}.stat b{display:block;margin-top:3px;font-size:19px}.betRow,.spinRow{display:flex;gap:8px}.spinRow{margin-top:8px}.betRow button,.spinRow button{border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer}.betRow button{flex:1;background:#eceee7}.betRow .activeRed{background:#c93232;color:white}.betRow .activeBlack{background:#202220;color:white}.spinRow button{flex:1;background:#a9d638;color:#14200a}.spinRow button:first-child{background:#e9ece4;color:#1c211c}.result{margin-top:12px;border-top:1px solid #eceee7;padding-top:11px;font-size:12px;line-height:1.4;min-height:42px}.history{margin-top:8px;display:flex;gap:4px;flex-wrap:wrap}.chip{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:white;font-size:9px;font-weight:800}.chip.red{background:#c93232}.chip.black{background:#202220}.chip.green{background:#1f8c50}@media(max-width:720px){.wrap{height:auto;min-height:500px;grid-template-columns:1fr}.wheel{width:260px;height:260px}}
  </style></head><body><div class="wrap"><div class="wheelArea"><div class="pointer"></div><div id="wheel" class="wheel"><div class="hub"></div></div></div><div class="panel"><span class="eyebrow">${title}</span><h2>Can you beat even-money roulette?</h2><p>${task}</p><div class="stats"><div class="stat"><span>Balance</span><b id="balance">$100</b></div><div class="stat"><span>Average / spin</span><b id="avg">$0.00</b></div><div class="stat"><span>Wins</span><b id="wins">0</b></div><div class="stat"><span>Spins</span><b id="spins">0</b></div></div><div class="betRow"><button id="red" class="activeRed">Red</button><button id="black">Black</button></div><div class="spinRow"><button id="spin">Spin once</button><button id="spin100">Spin 100 Times</button></div><div id="result" class="result">European roulette: 37 equally likely pockets (0–36). A $10 red/black win earns $10; any loss costs $10.</div><div id="history" class="history"></div></div></div><script>
  const order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const wheel=document.getElementById('wheel'),balanceEl=document.getElementById('balance'),avgEl=document.getElementById('avg'),winsEl=document.getElementById('wins'),spinsEl=document.getElementById('spins'),resultEl=document.getElementById('result'),history=document.getElementById('history');
  let choice='red',balance=100,wins=0,spins=0,profit=0,rotation=0;
  function colorOf(n){return n===0?'green':reds.has(n)?'red':'black'}
  function report(event,summary){parent.postMessage({type:'knowable_lab_event',event,summary},'*')}
  order.forEach((n,i)=>{const p=document.createElement('div');const a=i*360/order.length;p.className='pocket '+colorOf(n);p.textContent=n;p.style.transform='rotate('+a+'deg) translateY(-132px) rotate('+(-a)+'deg)';wheel.insertBefore(p,wheel.firstChild)});
  function choose(c){choice=c;document.getElementById('red').className=c==='red'?'activeRed':'';document.getElementById('black').className=c==='black'?'activeBlack':'';report('choice','Learner selected a $10 bet on '+c+'.')}
  document.getElementById('red').addEventListener('click',()=>choose('red'));document.getElementById('black').addEventListener('click',()=>choose('black'));
  function oneSpin(animate){const index=Math.floor(Math.random()*37),n=order[index],color=colorOf(n),won=color===choice;spins++;if(won){balance+=10;profit+=10;wins++}else{balance-=10;profit-=10}if(animate){rotation+=720-index*(360/37);wheel.style.transform='rotate('+rotation+'deg)'}return {n,color,won}}
  function render(last,count){balanceEl.textContent=(balance<0?'-$':'$')+Math.abs(balance);avgEl.textContent=(profit/spins>=0?'+$':'-$')+Math.abs(profit/spins).toFixed(2);winsEl.textContent=wins;spinsEl.textContent=spins;resultEl.textContent=(count===1?'Spin '+spins:count+'-spin batch')+': last result '+last.n+' '+last.color.toUpperCase()+' — '+(last.won?'win':'loss')+'. Balance '+(balance<0?'-$':'$')+Math.abs(balance)+'.';const chip=document.createElement('span');chip.className='chip '+last.color;chip.textContent=last.n;history.prepend(chip);while(history.children.length>12)history.removeChild(history.lastChild)}
  function run(count){let last;for(let i=0;i<count;i++)last=oneSpin(count===1);render(last,count);const summary='After '+spins+' total spins betting '+choice+': '+wins+' wins, '+(spins-wins)+' losses, balance '+(balance<0?'-$':'$')+Math.abs(balance)+', average profit '+(profit/spins).toFixed(2)+' dollars per spin.';report(count===100?'checkpoint':'spin',summary)}
  document.getElementById('spin').addEventListener('click',()=>run(1));document.getElementById('spin100').addEventListener('click',()=>run(100));
  report('ready','Verified European roulette lab ready: 37 equally likely pockets, $10 even-money red/black bets, single-spin and Spin 100 Times controls.');
  </script></body></html>`);
}

function auditPrompt(input, html) {
  const lesson = input?.lesson || {};
  const brief = input?.brief || lesson?.labBrief || {};
  return `You are a strict verifier for an educational interactive simulation. Do NOT grade style. Decide whether the executable lab is factually, mathematically, scientifically, and internally correct for the lesson.

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas, labBrief: lesson.labBrief })}

CURRENT BRIEF
${JSON.stringify(brief)}

HTML/JS TO AUDIT
${html}

Check all of these:
1. Every control explicitly named in the learner task exists, with the same meaning, and actually works.
2. Instructions do not tell the learner to do something the interface cannot do.
3. Numeric formulas, probabilities, counters, units, signs, averages, balances, geometry, and state updates are correct.
4. The visible visualization agrees with the underlying state/result; it must not depict a different outcome from the numbers.
5. Scientific or mathematical causal relationships are not invented or reversed.
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
  return `Repair this educational interactive lab. Preserve its visual intent, but fix EVERY listed correctness problem and any related logic bug.

LESSON
${JSON.stringify({ title: lesson.title, objective: lesson.objective, keyIdeas: lesson.keyIdeas, labBrief: lesson.labBrief })}

BRIEF
${JSON.stringify(brief)}

VERIFIED PROBLEMS
${JSON.stringify(issues)}

CURRENT HTML
${html}

Requirements:
- Return ONLY one complete <!doctype html> document. No markdown.
- Every explicitly named learner-task control must exist and work.
- All formulas, probabilities, units, counters, state transitions, and visible results must be correct.
- If exact quantitative behavior is not justified by the lesson, remove the fake number rather than inventing one.
- Keep parent.postMessage telemetry for ready/actions/checkpoints.
- Vanilla HTML/CSS/JS only; no network access, imports, storage, forms, navigation, audio, or external assets.`;
}

async function reviewAndRepair(input, html, env) {
  const task = input?.brief?.learnerTask || input?.lesson?.labBrief?.learnerTask || "";
  const missingLabels = obviousTaskMismatch(task, html);
  const localIssues = missingLabels.map((label) => `Learner task names the control “${label}”, but that control/label is missing from the generated interface.`);
  const key = env?.GEMINI_API_KEY;
  if (!key) return localIssues.length ? null : html;

  let issues = localIssues;
  try {
    const review = await generateGeminiText(key, auditPrompt(input, html), { label: "Lab correctness audit" });
    if (review.ok) {
      const verdict = parseJson(review.text);
      if (verdict?.pass === true && issues.length === 0) return html;
      if (Array.isArray(verdict?.issues)) issues = [...issues, ...verdict.issues.map(String)].slice(0, 12);
    }
  } catch (error) {
    console.error("Lab audit parse failure", error);
  }

  if (issues.length === 0) return html;
  try {
    const repaired = await generateGeminiText(key, repairPrompt(input, html, issues), { label: "Lab correctness repair" });
    if (!repaired.ok) return null;
    const fixed = secureHtml(repaired.text);
    if (!isInteractive(fixed) || obviousTaskMismatch(task, fixed).length) return null;

    const finalReview = await generateGeminiText(key, auditPrompt(input, fixed), { label: "Lab final correctness audit" });
    if (!finalReview.ok) return null;
    const verdict = parseJson(finalReview.text);
    return verdict?.pass === true ? fixed : null;
  } catch (error) {
    console.error("Lab repair failure", error);
    return null;
  }
}

function verificationFailureLab(input) {
  const title = escapeText(input?.brief?.title || input?.lesson?.labBrief?.title || "Interactive experiment");
  return secureHtml(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;height:500px;display:grid;place-items:center;background:#f7f7f2;font-family:Arial,sans-serif;color:#1b1d1b}.card{max-width:560px;margin:24px;padding:28px;background:white;border:1px solid #dedfd8;border-radius:18px;text-align:center}.badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#747b73}h2{margin:8px 0 10px;font-size:24px}p{margin:0;color:#687068;line-height:1.5}.retry{margin-top:18px;border:0;border-radius:10px;padding:11px 15px;background:#171917;color:white;font-weight:800}</style></head><body><div class="card"><span class="badge">${title}</span><h2>This experiment failed its correctness check.</h2><p>Knowable withheld the generated simulation rather than teach from a lab whose controls or results could be wrong. Reload the lesson to generate a new verified version.</p><button class="retry" id="retry">Reload experiment</button></div><script>document.getElementById('retry').addEventListener('click',()=>parent.postMessage({type:'knowable_lab_event',event:'checkpoint',summary:'Generated lab failed correctness verification; learner requested a retry.'},'*'));parent.postMessage({type:'knowable_lab_event',event:'ready',summary:'Lab was withheld because it failed correctness verification.'},'*');</script></body></html>`);
}

export async function handleLabRequest(request, env) {
  const forwarded = request.clone();
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const kind = input?.brief?.kind === "visual" ? "visual" : "lab";
  if (kind === "lab" && isCasinoProbability(input)) {
    return Response.json({ kind: "lab", labHtml: verifiedRouletteLab(input?.brief || input?.lesson?.labBrief || {}), verified: true, renderer: "trusted-roulette" });
  }

  const generatedResponse = await handleGeneratedLabRequest(forwarded, env);
  if (kind === "visual" || !generatedResponse.ok) return generatedResponse;

  let payload;
  try {
    payload = await generatedResponse.json();
  } catch {
    return generatedResponse;
  }
  if (!payload?.labHtml) return Response.json(payload, { status: generatedResponse.status });

  const verified = await reviewAndRepair(input, payload.labHtml, env);
  if (!verified) {
    return Response.json({ ...payload, labHtml: verificationFailureLab(input), verified: false });
  }
  return Response.json({ ...payload, labHtml: verified, verified: true });
}
