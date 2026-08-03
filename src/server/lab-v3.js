import { handleLabRequest as handleVerifiedGeneratedLabRequest } from "./lab-v2";

const LAB_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none';";

function escapeText(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isRouletteLesson(input) {
  const text = JSON.stringify(input || {}).toLowerCase();
  return /roulette|casino|house edge|even-money|expected value.*bet|wager/.test(text);
}

function rouletteLab(brief = {}) {
  const title = escapeText(brief.title || "European roulette");
  const task = escapeText(brief.learnerTask || brief.task || "Bet $10 on red, then run 100-spin batches and watch the average profit per spin.");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${LAB_CSP}"><style>
  *{box-sizing:border-box}body{margin:0;background:#f7f7f2;color:#151715;font-family:Arial,sans-serif}.wrap{height:500px;padding:20px;display:grid;grid-template-columns:minmax(330px,1fr) minmax(290px,.82fr);gap:22px;align-items:center}.wheelArea{display:grid;place-items:center;min-width:0}.pointer{width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:18px solid #17382a;margin-bottom:-3px;z-index:3}.wheel{width:320px;height:320px;border-radius:50%;position:relative;background:#17382a;border:12px solid #17382a;box-shadow:inset 0 0 0 3px #315b49;transition:transform .75s cubic-bezier(.2,.8,.2,1)}.pocket{position:absolute;left:50%;top:50%;width:28px;height:28px;margin:-14px;border-radius:50%;display:grid;place-items:center;color:white;font-size:9px;font-weight:800;border:1px solid rgba(255,255,255,.45)}.pocket.red{background:#c93232}.pocket.black{background:#202220}.pocket.green{background:#1f8c50}.hub{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px;border-radius:50%;background:#f4d76c;border:8px solid #17382a;z-index:2}.panel{background:white;border:1px solid #dddeda;border-radius:20px;padding:19px}.eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#788078;font-weight:800}h2{margin:6px 0 7px;font-size:22px}p{margin:0 0 15px;color:#5f665f;line-height:1.4;font-size:13px}.stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0}.stat{background:#f5f6f1;border-radius:11px;padding:10px}.stat span{display:block;font-size:10px;color:#7a817a}.stat b{display:block;margin-top:3px;font-size:19px}.betRow,.spinRow{display:flex;gap:8px}.spinRow{margin-top:8px}.betRow button,.spinRow button{border:0;border-radius:10px;padding:11px 12px;font-weight:800;cursor:pointer}.betRow button{flex:1;background:#eceee7}.betRow .activeRed{background:#c93232;color:white}.betRow .activeBlack{background:#202220;color:white}.spinRow button{flex:1;background:#a9d638;color:#14200a}.spinRow button:first-child{background:#e9ece4;color:#1c211c}.result{margin-top:12px;border-top:1px solid #eceee7;padding-top:11px;font-size:12px;line-height:1.4;min-height:42px}.history{margin-top:8px;display:flex;gap:4px;flex-wrap:wrap}.chip{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;color:white;font-size:9px;font-weight:800}.chip.red{background:#c93232}.chip.black{background:#202220}.chip.green{background:#1f8c50}@media(max-width:720px){.wrap{height:auto;min-height:500px;grid-template-columns:1fr}.wheel{width:260px;height:260px}}
  </style></head><body><div class="wrap"><div class="wheelArea"><div class="pointer"></div><div id="wheel" class="wheel"><div class="hub"></div></div></div><div class="panel"><span class="eyebrow">${title}</span><h2>Can you beat even-money roulette?</h2><p>${task}</p><div class="stats"><div class="stat"><span>Balance</span><b id="balance">$100</b></div><div class="stat"><span>Average / spin</span><b id="avg">$0.00</b></div><div class="stat"><span>Wins</span><b id="wins">0</b></div><div class="stat"><span>Spins</span><b id="spins">0</b></div></div><div class="betRow"><button id="red" class="activeRed">Red</button><button id="black">Black</button></div><div class="spinRow"><button id="spin">Spin once</button><button id="spin100">Spin 100 Times</button></div><div id="result" class="result">European roulette has 37 equally likely pockets (0–36). A $10 red/black win adds $10; a loss subtracts $10.</div><div id="history" class="history"></div></div></div><script>
  const order=[0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
  const wheel=document.getElementById('wheel'),balanceEl=document.getElementById('balance'),avgEl=document.getElementById('avg'),winsEl=document.getElementById('wins'),spinsEl=document.getElementById('spins'),resultEl=document.getElementById('result'),history=document.getElementById('history');
  const step=360/order.length;let choice='red',balance=100,wins=0,spins=0,profit=0,turns=0;
  function colorOf(n){return n===0?'green':reds.has(n)?'red':'black'}
  function report(event,summary){parent.postMessage({type:'knowable_lab_event',event,summary},'*')}
  order.forEach((n,i)=>{const p=document.createElement('div');const a=i*step;p.className='pocket '+colorOf(n);p.textContent=n;p.style.transform='rotate('+a+'deg) translateY(-132px) rotate('+(-a)+'deg)';wheel.insertBefore(p,wheel.firstChild)});
  function choose(c){choice=c;document.getElementById('red').className=c==='red'?'activeRed':'';document.getElementById('black').className=c==='black'?'activeBlack':'';report('choice','Learner selected a $10 bet on '+c+'.')}
  document.getElementById('red').addEventListener('click',()=>choose('red'));document.getElementById('black').addEventListener('click',()=>choose('black'));
  function oneSpin(){const index=Math.floor(Math.random()*37),n=order[index],color=colorOf(n),won=color===choice;spins++;if(won){balance+=10;profit+=10;wins++}else{balance-=10;profit-=10}return {index,n,color,won}}
  function pointWheel(index){turns+=3;wheel.style.transform='rotate('+(turns*360-index*step)+'deg)'}
  function render(last,count){pointWheel(last.index);balanceEl.textContent=(balance<0?'-$':'$')+Math.abs(balance);avgEl.textContent=(profit/spins>=0?'+$':'-$')+Math.abs(profit/spins).toFixed(2);winsEl.textContent=wins;spinsEl.textContent=spins;resultEl.textContent=(count===1?'Spin '+spins:count+'-spin batch')+': last result '+last.n+' '+last.color.toUpperCase()+' — '+(last.won?'win':'loss')+'. Balance '+(balance<0?'-$':'$')+Math.abs(balance)+'.';const chip=document.createElement('span');chip.className='chip '+last.color;chip.textContent=last.n;history.prepend(chip);while(history.children.length>12)history.removeChild(history.lastChild)}
  function run(count){let last;for(let i=0;i<count;i++)last=oneSpin();render(last,count);const summary='After '+spins+' total spins betting '+choice+': '+wins+' wins, '+(spins-wins)+' losses, balance '+(balance<0?'-$':'$')+Math.abs(balance)+', average profit '+(profit/spins).toFixed(2)+' dollars per spin. Last result '+last.n+' '+last.color+'.';report(count===100?'checkpoint':'spin',summary)}
  document.getElementById('spin').addEventListener('click',()=>run(1));document.getElementById('spin100').addEventListener('click',()=>run(100));
  report('ready','Verified European roulette lab ready: 37 equally likely pockets, $10 red/black bets, and a working Spin 100 Times control.');
  </script></body></html>`;
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
  if (kind === "lab" && isRouletteLesson(input)) {
    return Response.json({ kind: "lab", labHtml: rouletteLab(input?.brief || input?.lesson?.labBrief || {}), verified: true, renderer: "trusted-roulette-v2" });
  }
  return handleVerifiedGeneratedLabRequest(forwarded, env);
}
