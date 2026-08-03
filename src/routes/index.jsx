import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

const EXAMPLES = [
  { title: "Calculus", kicker: "Math", icon: "∫", description: "Learn slope by dragging, predicting, and seeing what changes." },
  { title: "Probability", kicker: "Math", icon: "◒", description: "Run actual random experiments and build intuition from outcomes." },
  { title: "Linear Algebra", kicker: "Math", icon: "↗", description: "Move vectors and transformations instead of memorizing rules." },
  { title: "Physics of Motion", kicker: "Physics", icon: "↝", description: "Launch, push, and perturb systems before touching equations." },
  { title: "Molecular Biology", kicker: "Biology", icon: "⌁", description: "Manipulate tiny biological systems and watch downstream effects." },
  { title: "Machine Learning", kicker: "Computing", icon: "◇", description: "Change model behavior directly and see why it changed." },
  { title: "Economics", kicker: "Social science", icon: "⇄", description: "Play with incentives and markets as miniature simulations." },
  { title: "Music Theory", kicker: "Music", icon: "♪", description: "Touch the notes, hear the structure, then name what happened." },
];

function stripNumber(title) {
  return String(title || "").replace(/^\d+\.\s*/, "");
}

function mergeUnique(...lists) {
  return [...new Set(lists.flat().map((value) => String(value || "").trim()).filter(Boolean))];
}

function serializableSessions(sessions) {
  return Object.fromEntries(
    Object.entries(sessions || {}).map(([key, session]) => [
      key,
      {
        ...session,
        loading: false,
        error: false,
        messages: (session?.messages || []).map(({ artifact, ...message }) => message),
      },
    ]),
  );
}

function latestAssistant(session) {
  return [...(session?.messages || [])].reverse().find((message) => message.role === "assistant") || null;
}

function stageLabel(action, showLab) {
  if (action === "question") return showLab ? "Notice" : "Think";
  if (action === "lab") return "Explore";
  if (action === "visual") return "See it";
  if (action === "mastered") return "Complete";
  return "Learn";
}

function TeachingArtifact({ artifact }) {
  if (!artifact?.visualSvg) return null;
  return (
    <figure className="stepVisual">
      <div dangerouslySetInnerHTML={{ __html: artifact.visualSvg }} />
      {artifact?.brief?.task && <figcaption>{artifact.brief.task}</figcaption>}
    </figure>
  );
}

function PrimaryLab({ lesson, lab, onRetry }) {
  const brief = lesson?.labBrief || {};

  return (
    <section className="labSurface">
      <div className="labHeading">
        <div>
          <span>Interactive</span>
          <h2>{brief.title || "Try it"}</h2>
        </div>
        <p>{brief.learnerTask || brief.purpose || "Try the main action and watch what changes."}</p>
      </div>

      {lab?.loading && (
        <div className="labLoadingMinimal">
          <div className="spinner" />
          <span>Building this experiment…</span>
        </div>
      )}

      {lab?.error && (
        <div className="labLoadingMinimal">
          <strong>The experiment didn’t load.</strong>
          <button className="quietButton" onClick={onRetry}>Try again</button>
        </div>
      )}

      {lab?.html && (
        <iframe
          sandbox="allow-scripts"
          srcDoc={lab.html}
          title={`${stripNumber(lesson?.title)} interactive lab`}
          className="labFrame"
        />
      )}
    </section>
  );
}

function AnswerSheet({ value, setValue, onSubmit, onUnsure, loading }) {
  return (
    <div className="answerSheet">
      <label htmlFor="lesson-answer">Your answer</label>
      <textarea
        id="lesson-answer"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={loading}
        placeholder="Explain it in your own words…"
      />
      <div className="answerActions">
        <button className="quietButton" onClick={onUnsure} disabled={loading}>I’m not sure</button>
        <button className="continueButton" onClick={onSubmit} disabled={!value.trim() || loading}>Check answer</button>
      </div>
    </div>
  );
}

function CompletionCard({ lesson, notesState, onDownloadNotes, onNext, isLast }) {
  return (
    <section className="completionCard">
      <div className="completionCheck">✓</div>
      <div>
        <span>Lesson complete</span>
        <h2>{stripNumber(lesson?.title)}</h2>
        <p>You’ve shown that you can use the idea, not just recognize it.</p>
      </div>
      <div className="completionActions">
        {notesState?.loading && <button className="quietButton" disabled>Preparing notes…</button>}
        {notesState?.url && (
          <a className="quietButton" href={notesState.url} download={notesState.filename || "knowable-lesson-notes.pdf"}>Download notes</a>
        )}
        {notesState?.error && <button className="quietButton" onClick={onDownloadNotes}>Retry notes</button>}
        <button className="continueButton" onClick={onNext}>{isLast ? "Finish course" : "Next lesson"}</button>
      </div>
    </section>
  );
}

function CourseStyles() {
  return (
    <style>{`
      .lessonExperience{min-height:100vh;background:#fff;color:#151715;}
      .lessonTopbar{height:68px;display:grid;grid-template-columns:150px minmax(0,1fr) 150px;align-items:center;padding:0 28px;border-bottom:1px solid #eceee8;position:sticky;top:0;z-index:30;background:rgba(255,255,255,.94);backdrop-filter:blur(14px)}
      .lessonTopbar .brand{justify-self:start;font-size:24px}.exitLesson{justify-self:end;border:0;background:transparent;color:#747a73;font-size:12px;font-weight:700;cursor:pointer}
      .courseProgressTop{width:min(520px,100%);justify-self:center;display:flex;align-items:center;gap:14px}.courseProgressTop>span{max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;font-weight:750;color:#697069}.courseProgressTrack{height:5px;flex:1;border-radius:999px;background:#eceee8;overflow:hidden}.courseProgressTrack i{display:block;height:100%;background:#98c528;border-radius:inherit;transition:width .25s ease}.courseProgressTop small{font-size:10px;color:#8b918a;white-space:nowrap}
      .lessonViewport{max-width:900px;margin:0 auto;padding:58px 26px 100px}.lessonIntro{max-width:720px;margin:0 auto 34px}.lessonKicker{font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.12em;color:#7c847b}.lessonIntro h1{margin:9px 0 10px;font-size:clamp(36px,5vw,58px);line-height:1;letter-spacing:-.052em}.lessonIntro>p{margin:0;color:#727972;font-size:15px;line-height:1.55;max-width:650px}
      .learningStep{max-width:720px;margin:0 auto;min-height:260px}.stepEyebrow{display:flex;align-items:center;gap:9px;margin-bottom:18px;font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:850;color:#829078}.stepEyebrow:before{content:'';width:8px;height:8px;border-radius:50%;background:#b7dd42}.stepText{font-size:clamp(20px,2.4vw,27px);line-height:1.55;letter-spacing:-.018em;white-space:pre-wrap;color:#202320}.stepText.question{font-size:clamp(23px,2.8vw,31px);line-height:1.42;font-weight:650;letter-spacing:-.025em}.stepFooter{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:30px;padding-top:20px;border-top:1px solid #efefeb}.continueButton{min-height:46px;padding:0 20px;border:1px solid #1b1d1b;border-radius:11px;background:#1b1d1b;color:white;font-size:13px;font-weight:800;cursor:pointer}.continueButton:hover{background:#292c29}.continueButton:disabled{opacity:.35;cursor:default}.quietButton{min-height:42px;display:inline-flex;align-items:center;justify-content:center;padding:0 14px;border:1px solid #d8dbd3;border-radius:10px;background:white;color:#4f564f;font-size:12px;font-weight:750;text-decoration:none;cursor:pointer}.quietButton:disabled{opacity:.45;cursor:default}
      .stepLoading{min-height:260px;display:grid;place-items:center}.loadingLine{display:flex;align-items:center;gap:10px;color:#7b827a;font-size:13px}.thinkingDots{display:flex;gap:5px}.thinkingDots i{width:6px;height:6px;border-radius:50%;background:#9da49c;animation:stepPulse 1.1s infinite ease-in-out}.thinkingDots i:nth-child(2){animation-delay:.12s}.thinkingDots i:nth-child(3){animation-delay:.24s}@keyframes stepPulse{0%,70%,100%{opacity:.3;transform:translateY(0)}35%{opacity:1;transform:translateY(-3px)}}
      .stepError{padding:20px;border:1px solid #eaded8;border-radius:14px;background:#fff9f7;display:flex;justify-content:space-between;align-items:center;gap:18px;color:#6d554c}.stepError strong{font-size:14px}
      .answerSheet{margin-top:28px;padding:18px;border:1px solid #dfe1da;background:#f8f9f5;border-radius:16px;box-shadow:0 16px 42px rgba(30,38,30,.055)}.answerSheet label{display:block;margin-bottom:9px;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.1em;color:#7c847b}.answerSheet textarea{display:block;width:100%;min-height:112px;max-height:240px;resize:vertical;padding:14px 15px;border:1px solid #d4d8cf;border-radius:11px;background:white;outline:none;font-size:15px;line-height:1.5}.answerSheet textarea:focus{border-color:#a8bc73;box-shadow:0 0 0 3px rgba(171,205,75,.14)}.answerActions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px}
      .labSurface{width:min(860px,calc(100vw - 48px));margin:34px 50% 8px;transform:translateX(-50%);overflow:hidden;border:1px solid #dadcd5;border-radius:18px;background:#fafaf7;box-shadow:0 18px 55px rgba(27,34,27,.06)}.labHeading{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 18px;border-bottom:1px solid #e8e9e4;background:white}.labHeading span{font-size:9px;font-weight:850;text-transform:uppercase;letter-spacing:.11em;color:#829078}.labHeading h2{margin:4px 0 0;font-size:18px;letter-spacing:-.025em}.labHeading p{max-width:430px;margin:0;color:#6c736c;font-size:11px;line-height:1.45;text-align:right}.labFrame{display:block;width:100%;height:500px;border:0;background:#f8f8f4}.labLoadingMinimal{height:500px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;color:#7b827a;font-size:12px}.spinner{width:28px;height:28px;border-radius:50%;border:3px solid #e3e5de;border-top-color:#9cc32f;animation:spin .85s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      .stepVisual{margin:26px 0 0;border:1px solid #dde0d7;border-radius:16px;overflow:hidden;background:#fafaf7}.stepVisual>div{padding:10px}.stepVisual svg{display:block;width:100%;height:auto;max-height:390px}.stepVisual figcaption{padding:10px 13px;border-top:1px solid #e8e9e4;color:#6f766e;font-size:11px}
      .completionCard{max-width:720px;margin:0 auto;padding:26px;display:grid;grid-template-columns:46px 1fr;gap:18px;border:1px solid #d7e3b7;border-radius:18px;background:#f7faee}.completionCheck{width:46px;height:46px;display:grid;place-items:center;border-radius:50%;background:#d9ff61;border:1px solid #bfdc54;font-weight:900}.completionCard span{font-size:10px;text-transform:uppercase;letter-spacing:.11em;font-weight:850;color:#71813d}.completionCard h2{margin:5px 0 6px;font-size:24px;letter-spacing:-.035em}.completionCard p{margin:0;color:#65705a;font-size:13px;line-height:1.5}.completionActions{grid-column:2;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:4px}
      @media(max-width:720px){.lessonTopbar{grid-template-columns:auto 1fr auto;padding:0 16px}.courseProgressTop>span,.courseProgressTop small{display:none}.lessonTopbar .brand{font-size:21px}.lessonViewport{padding:38px 18px 80px}.lessonIntro{margin-bottom:28px}.learningStep{min-height:220px}.labSurface{width:calc(100vw - 24px);margin-top:28px}.labHeading{align-items:flex-start;flex-direction:column;gap:8px}.labHeading p{text-align:left}.labFrame,.labLoadingMinimal{height:430px}.answerActions{align-items:stretch;flex-direction:column-reverse}.answerActions button{width:100%}.completionCard{grid-template-columns:40px 1fr;padding:20px}.completionCheck{width:40px;height:40px}.completionActions{grid-column:1/-1}.completionActions>*{flex:1}.stepFooter .continueButton{width:100%}}
    `}</style>
  );
}

function Home() {
  const [screen, setScreen] = useState("home");
  const [selected, setSelected] = useState(null);
  const [why, setWhy] = useState("");
  const [success, setSuccess] = useState("");
  const [background, setBackground] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [course, setCourse] = useState(null);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [sessions, setSessions] = useState({});
  const [labs, setLabs] = useState({});
  const [notes, setNotes] = useState({});
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("knowable-course"));
      if (saved?.course) {
        setCourse(saved.course);
        setCompleted(saved.completed || []);
        setSessions(saved.sessions || {});
      }
    } catch {}
  }, []);

  function persist(nextCourse = course, nextCompleted = completed, nextSessions = sessions) {
    if (!nextCourse) return;
    localStorage.setItem(
      "knowable-course",
      JSON.stringify({ course: nextCourse, completed: nextCompleted, sessions: serializableSessions(nextSessions) }),
    );
  }

  function chooseCourse(item) {
    setSelected(item);
    setWhy("");
    setSuccess("");
    setBackground("");
    setError("");
    setScreen("onboarding");
  }

  async function generateCourse() {
    if (!selected?.title || !why.trim() || !success.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selected.title, why, success, background }),
      });
      const data = await response.json();
      if (!response.ok || !data.course) throw new Error(data.error || "Could not build course");

      setCourse(data.course);
      setCompleted([]);
      setSessions({});
      setLabs({});
      setNotes({});
      setLessonIndex(0);
      setDraft("");
      persist(data.course, [], {});
      setScreen("course");
    } catch (err) {
      setError(err?.message || "Could not build course");
    } finally {
      setLoading(false);
    }
  }

  async function ensureLab(index, force = false) {
    const lesson = course?.lessons?.[index];
    if (!lesson || !course) return;
    if (!force && (labs[index]?.loading || labs[index]?.html)) return;

    setLabs((previous) => ({ ...previous, [index]: { loading: true, error: false, html: "" } }));
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson, course, brief: { kind: "lab", ...(lesson.labBrief || {}) } }),
      });
      const data = await response.json();
      if (!response.ok || !data.labHtml) throw new Error("Lab generation failed");
      setLabs((previous) => ({ ...previous, [index]: { loading: false, error: false, html: data.labHtml } }));
    } catch {
      setLabs((previous) => ({ ...previous, [index]: { loading: false, error: true, html: "" } }));
    }
  }

  async function fetchTeacherTurn(index, workingSession) {
    const lesson = course?.lessons?.[index];
    const transcript = (workingSession?.messages || []).map((message) => ({ role: message.role, content: message.content }));
    const response = await fetch("/api/teach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lesson,
        course,
        transcript,
        labEvents: workingSession?.labEvents || [],
        state: {
          pitfalls: workingSession?.pitfalls || [],
          coveredConcepts: workingSession?.coveredConcepts || [],
          showLab: Boolean(workingSession?.showLab),
          action: workingSession?.action || null,
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Lesson unavailable");
    return data;
  }

  async function requestTeacher(index, workingSession) {
    const lesson = course?.lessons?.[index];
    if (!lesson || !course) return;

    let data = null;
    for (let attempt = 0; attempt < 2 && !data; attempt += 1) {
      try {
        data = await fetchTeacherTurn(index, workingSession);
      } catch {
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    if (!data) {
      const nextSession = { ...workingSession, started: true, loading: false, error: true };
      setSessions((previous) => {
        const next = { ...previous, [index]: nextSession };
        persist(course, completed, next);
        return next;
      });
      return;
    }

    let artifact = null;
    if (data.artifactBrief?.kind === "visual") {
      try {
        const artifactResponse = await fetch("/api/lab", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lesson, course, brief: data.artifactBrief }),
        });
        const artifactData = await artifactResponse.json();
        if (artifactResponse.ok && artifactData.visualSvg) artifact = { ...artifactData, brief: data.artifactBrief };
      } catch {}
    }

    const assistantMessage = {
      role: "assistant",
      content: data.reply || "Look closely at the next idea.",
      ...(artifact ? { artifact } : {}),
    };
    const nextSession = {
      ...workingSession,
      started: true,
      loading: false,
      error: false,
      action: data.action || "explain",
      showLab: Boolean(workingSession?.showLab || data.showLab),
      messages: [...(workingSession.messages || []), assistantMessage],
      mastered: Boolean(data.mastered),
      confidence: Number(data.confidence || 0),
      pitfalls: mergeUnique(workingSession?.pitfalls || [], data.pitfalls || []),
      coveredConcepts: mergeUnique(workingSession?.coveredConcepts || [], data.coveredConcepts || []),
    };
    const nextCompleted = data.mastered ? mergeUnique(completed, [index]).map(Number) : completed;

    if (data.mastered) setCompleted(nextCompleted);
    setSessions((previous) => {
      const next = { ...previous, [index]: nextSession };
      persist(course, nextCompleted, next);
      return next;
    });

    if (nextSession.showLab) ensureLab(index);
  }

  function startLesson(index) {
    const current = sessions[index];
    if (current?.started || current?.loading || !course?.lessons?.[index]) {
      if (current?.showLab) ensureLab(index);
      return;
    }

    const base = {
      started: true,
      loading: true,
      error: false,
      action: null,
      showLab: false,
      messages: [],
      labEvents: [],
      pitfalls: [],
      coveredConcepts: [],
      mastered: completed.includes(index),
      confidence: 0,
    };
    setSessions((previous) => ({ ...previous, [index]: base }));
    requestTeacher(index, base);
  }

  useEffect(() => {
    if (screen === "course" && course) startLesson(lessonIndex);
  }, [screen, course, lessonIndex]);

  useEffect(() => {
    function receiveLabEvent(event) {
      const data = event?.data;
      if (screen !== "course" || !data || data.type !== "knowable_lab_event" || !data.summary) return;

      const index = lessonIndex;
      const current = sessions[index] || {
        started: true,
        loading: false,
        error: false,
        action: "lab",
        showLab: true,
        messages: [],
        labEvents: [],
        pitfalls: [],
        coveredConcepts: [],
        mastered: false,
        confidence: 0,
      };
      const labEvent = { event: String(data.event || "action"), summary: String(data.summary).slice(0, 500) };
      const nextEvents = [...(current.labEvents || []), labEvent].slice(-12);
      const nextSession = { ...current, labEvents: nextEvents, showLab: true };

      if (labEvent.event === "checkpoint" && !current.loading && !current.mastered) {
        const working = { ...nextSession, loading: true, error: false };
        setSessions((previous) => ({ ...previous, [index]: working }));
        requestTeacher(index, working);
      } else {
        setSessions((previous) => {
          const next = { ...previous, [index]: nextSession };
          persist(course, completed, next);
          return next;
        });
      }
    }

    window.addEventListener("message", receiveLabEvent);
    return () => window.removeEventListener("message", receiveLabEvent);
  }, [screen, lessonIndex, sessions, course, completed]);

  async function submitLearnerText(content) {
    const text = String(content || "").trim();
    const current = sessions[lessonIndex];
    if (!text || current?.loading || current?.mastered) return;

    const working = {
      ...(current || { started: true, pitfalls: [], coveredConcepts: [], labEvents: [], messages: [], showLab: false }),
      started: true,
      loading: true,
      error: false,
      messages: [...(current?.messages || []), { role: "user", content: text }],
    };
    setDraft("");
    setSessions((previous) => ({ ...previous, [lessonIndex]: working }));
    await requestTeacher(lessonIndex, working);
  }

  async function sendCurrentAnswer() {
    await submitLearnerText(draft);
  }

  async function advanceCurrent() {
    await submitLearnerText("Continue.");
  }

  async function retryTeacher() {
    const current = sessions[lessonIndex];
    if (!current || current.loading || current.mastered) return;
    const working = { ...current, loading: true, error: false };
    setSessions((previous) => ({ ...previous, [lessonIndex]: working }));
    await requestTeacher(lessonIndex, working);
  }

  async function generateNotes(index = lessonIndex) {
    const session = sessions[index];
    const lesson = course?.lessons?.[index];
    if (!session?.mastered || !lesson || notes[index]?.loading) return;

    setNotes((previous) => ({ ...previous, [index]: { loading: true } }));
    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson,
          course,
          transcript: (session.messages || []).map((message) => ({ role: message.role, content: message.content })),
          pitfalls: session.pitfalls || [],
          coveredConcepts: session.coveredConcepts || [],
        }),
      });
      if (!response.ok) throw new Error("notes failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = `${stripNumber(lesson.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "lesson"}-notes.pdf`;
      setNotes((previous) => ({ ...previous, [index]: { loading: false, url, filename } }));
    } catch {
      setNotes((previous) => ({ ...previous, [index]: { loading: false, error: true } }));
    }
  }

  const activeSession = sessions[lessonIndex];
  useEffect(() => {
    if (screen === "course" && activeSession?.mastered && !notes[lessonIndex]) generateNotes(lessonIndex);
  }, [screen, lessonIndex, activeSession?.mastered]);

  function goNext() {
    if (!course) return;
    if (lessonIndex < course.lessons.length - 1) {
      setLessonIndex(lessonIndex + 1);
      setDraft("");
    } else {
      setScreen("home");
    }
  }

  if (screen === "onboarding") {
    return (
      <main className="shell onboardingPage">
        <nav className="nav">
          <button className="brand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <span className="navCaption">personal course setup</span>
        </nav>
        <section className="onboardingWrap">
          <span className="stepPill">Built around your destination</span>
          <h1>What should <em>{selected.title}</em> let you do?</h1>
          <p className="lede">Knowable teaches one idea at a time: a short explanation, a focused question, then an interactive experiment exactly when it becomes useful.</p>
          <div className="formCard">
            <label className="bigLabel">Why are you learning this?<textarea autoFocus value={why} onChange={(event) => setWhy(event.target.value)} placeholder="I want to understand probability well enough to make smarter decisions." /></label>
            <label className="bigLabel">What would success look like?<textarea value={success} onChange={(event) => setSuccess(event.target.value)} placeholder="I can look at a game or decision and reason about the odds and expected outcome." /></label>
            <label className="bigLabel">What do you already know? <span>optional</span><textarea value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Almost nothing; teach from scratch." /></label>
            {error && <p className="errorBox">{error}</p>}
            <button className="primaryButton wide" disabled={!why.trim() || !success.trim() || loading} onClick={generateCourse}>{loading ? "Designing your path…" : "Start learning →"}</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "course" && course) {
    const lesson = course.lessons[lessonIndex];
    const session = sessions[lessonIndex] || { messages: [], loading: true, showLab: false, action: null };
    const current = latestAssistant(session);
    const progress = Math.round((completed.length / course.lessons.length) * 100);
    const action = session.mastered ? "mastered" : session.action || "explain";

    return (
      <main className="lessonExperience">
        <CourseStyles />
        <header className="lessonTopbar">
          <button className="brand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <div className="courseProgressTop">
            <span>{course.title}</span>
            <div className="courseProgressTrack"><i style={{ width: `${progress}%` }} /></div>
            <small>{lessonIndex + 1} / {course.lessons.length}</small>
          </div>
          <button className="exitLesson" onClick={() => setScreen("home")}>Exit lesson</button>
        </header>

        <div className="lessonViewport">
          <header className="lessonIntro">
            <span className="lessonKicker">Lesson {lessonIndex + 1} · about {lesson.durationMinutes || 10} min</span>
            <h1>{stripNumber(lesson.title)}</h1>
            <p>{lesson.objective}</p>
          </header>

          {session.mastered ? (
            <CompletionCard
              lesson={lesson}
              notesState={notes[lessonIndex]}
              onDownloadNotes={() => generateNotes(lessonIndex)}
              onNext={goNext}
              isLast={lessonIndex === course.lessons.length - 1}
            />
          ) : (
            <section className="learningStep">
              {session.loading && !current ? (
                <div className="stepLoading">
                  <div className="loadingLine">
                    <div className="thinkingDots"><i /><i /><i /></div>
                    <span>Preparing the next step…</span>
                  </div>
                </div>
              ) : session.error ? (
                <div className="stepError">
                  <strong>This step didn’t load.</strong>
                  <button className="quietButton" onClick={retryTeacher}>Try again</button>
                </div>
              ) : current ? (
                <>
                  <div className="stepEyebrow">{stageLabel(action, session.showLab)}</div>
                  <div className={`stepText ${action === "question" ? "question" : ""}`}>{current.content}</div>
                  {current.artifact && <TeachingArtifact artifact={current.artifact} />}

                  {session.showLab && (
                    <PrimaryLab lesson={lesson} lab={labs[lessonIndex]} onRetry={() => ensureLab(lessonIndex, true)} />
                  )}

                  {session.loading ? (
                    <div className="stepFooter">
                      <div className="loadingLine"><div className="thinkingDots"><i /><i /><i /></div><span>Adapting…</span></div>
                    </div>
                  ) : action === "question" ? (
                    <AnswerSheet
                      value={draft}
                      setValue={setDraft}
                      onSubmit={sendCurrentAnswer}
                      onUnsure={() => submitLearnerText("I’m not sure.")}
                      loading={session.loading}
                    />
                  ) : (
                    <div className="stepFooter">
                      <button className="continueButton" onClick={advanceCurrent}>
                        {action === "lab" ? "I’ve explored it" : "Continue"}
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </section>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="nav">
        <button className="brand">knowable<span>.</span></button>
        <div className="homeNavRight">
          <span>open source · adaptive · interactive</span>
          <button className="textButton" onClick={() => course && setScreen("course")} disabled={!course}>Continue learning →</button>
        </div>
      </nav>

      <section className="hero">
        <span className="heroBadge">Lessons that unfold as you learn</span>
        <h1>Learn one <em>step at a time.</em></h1>
        <p>Read a short idea, answer a focused question, then manipulate a real interactive model when it becomes useful. The path adapts quietly in the background.</p>
        <div className="customBar">
          <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What do you want to learn?" onKeyDown={(event) => { if (event.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() }); }} />
          <button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Start →</button>
        </div>
      </section>

      <section className="examples">
        <div className="sectionHead"><div><span className="eyebrow">Start somewhere</span><h2>Example subjects</h2></div><p>Short explanations, precise questions, and interactive experiments—without a chat interface.</p></div>
        <div className="courseGrid">
          {EXAMPLES.map((item) => (
            <button className="courseCard" key={item.title} onClick={() => chooseCourse(item)}>
              <div className="courseIcon">{item.icon}</div>
              <span className="kicker">{item.kicker}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="cardFoot"><span>Learn this</span><b>↗</b></div>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
