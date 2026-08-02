"use client";

import { useEffect, useMemo, useState } from "react";

const EXAMPLES = [
  { title: "Calculus", kicker: "Math", icon: "∫", description: "See derivatives and integrals as motion, area, and change." },
  { title: "Probability", kicker: "Math", icon: "◒", description: "Build intuition for uncertainty by running the experiments yourself." },
  { title: "Linear Algebra", kicker: "Math", icon: "↗", description: "Manipulate vectors, transformations, and spaces visually." },
  { title: "Physics of Motion", kicker: "Physics", icon: "↝", description: "Predict trajectories, forces, and energy before doing the algebra." },
  { title: "Molecular Biology", kicker: "Biology", icon: "⌁", description: "Understand regulation and cellular systems as dynamic processes." },
  { title: "Machine Learning", kicker: "Computing", icon: "◇", description: "Learn models by changing their assumptions and watching behavior shift." },
  { title: "Personal Finance", kicker: "Life", icon: "$", description: "Play with compounding, risk, debt, and tradeoffs using real decisions." },
  { title: "Statistics", kicker: "Data", icon: "σ", description: "Learn inference by sampling, guessing, testing, and updating." }
];

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function curveY(type, x, a, b) {
  switch (type) {
    case "quadratic": return a * x * x / 5 + b;
    case "exponential": return Math.exp(clamp(a * x / 6, -4, 4)) + b;
    case "logistic": return 8 / (1 + Math.exp(-a * x)) + b;
    case "sine": return a * Math.sin(x) + b;
    default: return a * x + b;
  }
}

function Sparkline({ lab, a, b }) {
  const width = 620;
  const height = 250;
  const padding = 28;
  const points = Array.from({ length: 80 }, (_, i) => {
    const x = -5 + (10 * i) / 79;
    const y = curveY(lab.functionType || "linear", x, a, b);
    return { x, y };
  });
  const ys = points.map((p) => p.y);
  const yMin = Math.min(...ys, -1);
  const yMax = Math.max(...ys, 1);
  const toX = (x) => padding + ((x + 5) / 10) * (width - padding * 2);
  const toY = (y) => height - padding - ((y - yMin) / Math.max(0.001, yMax - yMin)) * (height - padding * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${toX(p.x).toFixed(1)},${toY(p.y).toFixed(1)}`).join(" ");

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Interactive concept graph">
      <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} className="axis" />
      <line x1={width / 2} y1={padding} x2={width / 2} y2={height - padding} className="axis" />
      <path d={d} className="curveLine" />
      <text x={width - 55} y={height / 2 - 8} className="axisLabel">{lab.xLabel || "x"}</text>
      <text x={width / 2 + 8} y={22} className="axisLabel">{lab.yLabel || "y"}</text>
    </svg>
  );
}

function ProbabilityLab({ p }) {
  const outcomes = useMemo(() => Array.from({ length: 60 }, (_, i) => ((i * 37 + Math.round(p * 100) * 17) % 100) < p * 100), [p]);
  const hits = outcomes.filter(Boolean).length;
  return (
    <div className="probLab">
      <div className="coinGrid">
        {outcomes.map((hit, i) => <span key={i} className={hit ? "dot hit" : "dot"} />)}
      </div>
      <div className="labStat"><strong>{hits}/60</strong><span>simulated successes</span></div>
    </div>
  );
}

function VectorLab({ a, b }) {
  const width = 620, height = 250, cx = width / 2, cy = height / 2;
  const scale = 45;
  const x2 = cx + clamp(a, -5, 5) * scale;
  const y2 = cy - clamp(b, -5, 5) * scale;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`}>
      <defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" className="arrowHead" /></marker></defs>
      <line x1="20" y1={cy} x2={width - 20} y2={cy} className="axis" />
      <line x1={cx} y1="20" x2={cx} y2={height - 20} className="axis" />
      <line x1={cx} y1={cy} x2={x2} y2={y2} className="vectorLine" markerEnd="url(#arrow)" />
      <text x={x2 + 8} y={y2 - 8} className="vectorText">({a.toFixed(1)}, {b.toFixed(1)})</text>
    </svg>
  );
}

function ProjectileLab({ speed, angle }) {
  const width = 620, height = 250, pad = 26;
  const rad = (angle * Math.PI) / 180;
  const g = 9.81;
  const vx = Math.max(0.1, speed * Math.cos(rad));
  const vy = speed * Math.sin(rad);
  const flight = Math.max(0.2, (2 * Math.max(0.2, vy)) / g);
  const points = Array.from({ length: 60 }, (_, i) => {
    const t = (flight * i) / 59;
    return { x: vx * t, y: Math.max(0, vy * t - 0.5 * g * t * t) };
  });
  const maxX = Math.max(...points.map((p) => p.x), 1);
  const maxY = Math.max(...points.map((p) => p.y), 1);
  const d = points.map((p, i) => `${i ? "L" : "M"}${pad + (p.x / maxX) * (width - pad * 2)},${height - pad - (p.y / maxY) * (height - pad * 2)}`).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`}>
      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} className="axis" />
      <path d={d} className="curveLine" />
      <circle cx={width - pad} cy={height - pad} r="5" className="landingDot" />
    </svg>
  );
}

function InteractiveLab({ lab }) {
  const [a, setA] = useState(lab.param1Default ?? 1);
  const [b, setB] = useState(lab.param2Default ?? 1);

  useEffect(() => {
    setA(lab.param1Default ?? 1);
    setB(lab.param2Default ?? 1);
  }, [lab]);

  const kind = lab.kind || "curve";
  return (
    <section className="labCard">
      <div className="labHeader">
        <div><span className="eyebrow">Interactive lab</span><h3>{lab.title}</h3></div>
        <span className="livePill">LIVE</span>
      </div>
      <p className="labInstruction">{lab.instruction}</p>
      <div className="prediction">Before you move anything: <strong>{lab.prediction}</strong></div>

      <div className="visualStage">
        {kind === "curve" && <Sparkline lab={lab} a={a} b={b} />}
        {kind === "probability" && <ProbabilityLab p={clamp(a / Math.max(1, lab.param1Max || 1), 0.02, 0.98)} />}
        {kind === "vector" && <VectorLab a={a} b={b} />}
        {kind === "projectile" && <ProjectileLab speed={Math.max(1, a * 10)} angle={clamp(b * 15 + 30, 5, 85)} />}
      </div>

      <div className="controls">
        <label>
          <span>{lab.param1Label} <b>{Number(a).toFixed(1)}</b></span>
          <input type="range" min={lab.param1Min} max={lab.param1Max} step={lab.param1Step || 0.1} value={a} onChange={(e) => setA(Number(e.target.value))} />
        </label>
        <label>
          <span>{lab.param2Label} <b>{Number(b).toFixed(1)}</b></span>
          <input type="range" min={lab.param2Min} max={lab.param2Max} step={lab.param2Step || 0.1} value={b} onChange={(e) => setB(Number(e.target.value))} />
        </label>
      </div>
    </section>
  );
}

function Check({ challenge }) {
  const [picked, setPicked] = useState(null);
  const correct = picked === challenge.answerIndex;
  useEffect(() => setPicked(null), [challenge]);
  return (
    <section className="checkCard">
      <span className="eyebrow">Quick prediction</span>
      <h3>{challenge.question}</h3>
      <div className="answers">
        {challenge.options.map((option, i) => (
          <button key={option} onClick={() => setPicked(i)} className={picked === i ? (correct ? "answer correct" : "answer wrong") : "answer"}>
            <span>{String.fromCharCode(65 + i)}</span>{option}
          </button>
        ))}
      </div>
      {picked !== null && <p className={correct ? "feedback good" : "feedback"}>{correct ? "Exactly. " : "Not quite. "}{challenge.explanation}</p>}
    </section>
  );
}

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [selected, setSelected] = useState(null);
  const [why, setWhy] = useState("");
  const [success, setSuccess] = useState("");
  const [background, setBackground] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [course, setCourse] = useState(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("knowable-course"));
      if (saved?.course) {
        setCourse(saved.course);
        setCompleted(saved.completed || []);
      }
    } catch {}
  }, []);

  function chooseCourse(item) {
    setSelected(item);
    setWhy(""); setSuccess(""); setBackground("");
    setScreen("onboarding");
  }

  async function generateCourse() {
    if (!selected?.title || !why.trim() || !success.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selected.title, why, success, background })
      });
      const data = await res.json();
      setCourse(data.course);
      setDemo(Boolean(data.demo));
      setCompleted([]);
      setLessonIndex(0);
      localStorage.setItem("knowable-course", JSON.stringify({ course: data.course, completed: [] }));
      setScreen("course");
    } finally {
      setLoading(false);
    }
  }

  function markComplete() {
    const next = completed.includes(lessonIndex) ? completed : [...completed, lessonIndex];
    setCompleted(next);
    localStorage.setItem("knowable-course", JSON.stringify({ course, completed: next }));
    if (lessonIndex < course.lessons.length - 1) setLessonIndex(lessonIndex + 1);
  }

  if (screen === "onboarding") {
    return (
      <main className="shell onboardingPage">
        <nav className="nav"><button className="brand" onClick={() => setScreen("home")}>knowable<span>.</span></button><div className="navRight">personal course setup</div></nav>
        <section className="onboardingWrap">
          <div className="stepPill">1 minute setup</div>
          <h1>Make <em>{selected.title}</em> useful to you.</h1>
          <p className="lede">The same topic should be taught differently to someone passing an exam, building a product, or satisfying curiosity.</p>
          <div className="formCard">
            <label className="bigLabel">Why are you trying to learn this?<textarea autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. I want enough probability intuition to understand ML papers without hand-waving" /></label>
            <label className="bigLabel">How will you know you’ve succeeded?<textarea value={success} onChange={(e) => setSuccess(e.target.value)} placeholder="e.g. I can derive and explain Bayes' rule and solve real diagnostic-test problems" /></label>
            <label className="bigLabel">What do you already know? <span>optional</span><textarea value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. basic algebra, almost no statistics" /></label>
            <button className="primary full" disabled={!why.trim() || !success.trim() || loading} onClick={generateCourse}>{loading ? "Designing your course…" : "Build my course →"}</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "course" && course) {
    const lesson = course.lessons[lessonIndex];
    const progress = Math.round((completed.length / course.lessons.length) * 100);
    return (
      <main className="courseShell">
        <aside className="sidebar">
          <button className="brand sidebarBrand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <div className="courseMeta"><span>Your course</span><h2>{course.title}</h2><p>{course.subtitle}</p></div>
          <div className="progressRow"><span>{progress}% complete</span><div className="progressTrack"><i style={{ width: `${progress}%` }} /></div></div>
          <div className="lessonList">
            {course.lessons.map((item, i) => (
              <button key={item.title} className={`lessonNav ${i === lessonIndex ? "active" : ""}`} onClick={() => setLessonIndex(i)}>
                <span className={completed.includes(i) ? "lessonNum done" : "lessonNum"}>{completed.includes(i) ? "✓" : i + 1}</span>
                <span><b>{item.title.replace(/^\d+\.\s*/, "")}</b><small>10 min</small></span>
              </button>
            ))}
          </div>
        </aside>
        <section className="lessonPane">
          <div className="lessonTop"><span>Lesson {lessonIndex + 1} of {course.lessons.length}</span>{demo && <span className="demoPill">demo mode — add Gemini key for AI courses</span>}</div>
          <article className="lessonContent">
            <div className="lessonHero"><span className="eyebrow">10 minute lesson</span><h1>{lesson.title.replace(/^\d+\.\s*/, "")}</h1><p>{lesson.objective}</p></div>
            <div className="whyBox"><strong>Why this is in your course</strong><p>{lesson.whyItMatters}</p></div>
            <div className="explanation"><h2>Build the intuition</h2><p>{lesson.explanation}</p></div>
            <InteractiveLab lab={lesson.lab} />
            <Check challenge={lesson.challenge} />
            <button className="primary complete" onClick={markComplete}>{lessonIndex === course.lessons.length - 1 ? "Finish course ✓" : "Complete lesson & continue →"}</button>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="nav"><button className="brand">knowable<span>.</span></button><div className="navRight"><span>100% free</span><button className="textButton" onClick={() => course && setScreen("course")} disabled={!course}>Continue learning →</button></div></nav>
      <section className="hero">
        <div className="heroBadge">Learning that rearranges itself around you</div>
        <h1>Don’t take a course.<br/><em>Build understanding.</em></h1>
        <p>Tell Knowable what you’re trying to do. It designs a path of 10-minute lessons, predictions, and interactive labs that build on each other.</p>
        <div className="customBar"><input value={customTopic} onChange={(e) => setCustomTopic(e.target.value)} placeholder="What do you want to understand?" onKeyDown={(e) => { if (e.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() }); }} /><button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Build a course →</button></div>
      </section>
      <section className="examples">
        <div className="sectionHead"><div><span className="eyebrow">Start somewhere</span><h2>Popular courses</h2></div><p>Every one becomes a different course depending on what you’re trying to accomplish.</p></div>
        <div className="courseGrid">
          {EXAMPLES.map((item) => (
            <button className="courseCard" key={item.title} onClick={() => chooseCourse(item)}>
              <div className="courseIcon">{item.icon}</div><span className="kicker">{item.kicker}</span><h3>{item.title}</h3><p>{item.description}</p><div className="cardFoot"><span>Personalize course</span><b>↗</b></div>
            </button>
          ))}
        </div>
      </section>
      <section className="manifesto"><span>THE IDEA</span><h2>A textbook gives everyone the same path.<br/>Knowable starts with <em>your destination.</em></h2><div className="three"><div><b>01</b><h3>Say why</h3><p>Your goal determines what matters and what can be skipped.</p></div><div><b>02</b><h3>Touch the concept</h3><p>Every lesson turns an abstraction into something you can manipulate.</p></div><div><b>03</b><h3>Prove transfer</h3><p>The course ends when you can do the thing you said success meant.</p></div></div></section>
    </main>
  );
}
