import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

const EXAMPLES = [
  { title: "Calculus", kicker: "Math", icon: "∫", description: "Learn slope by dragging, predicting, and seeing what changes." },
  { title: "Probability", kicker: "Math", icon: "◒", description: "Run actual random experiments and build intuition from outcomes." },
  { title: "Linear Algebra", kicker: "Math", icon: "↗", description: "Move vectors and transformations instead of memorizing rules." },
  { title: "Physics of Motion", kicker: "Physics", icon: "↝", description: "Launch, push, and perturb systems before touching equations." },
  { title: "Molecular Biology", kicker: "Biology", icon: "⌁", description: "Manipulate tiny biological systems and watch downstream effects." },
  { title: "Machine Learning", kicker: "Computing", icon: "◇", description: "Change model behavior directly and let the tutor explain why." },
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

function TeachingArtifact({ artifact }) {
  if (!artifact?.visualSvg) return null;
  return (
    <figure className="guidedVisual">
      <div dangerouslySetInnerHTML={{ __html: artifact.visualSvg }} />
      {artifact?.brief?.task && <figcaption>{artifact.brief.task}</figcaption>}
    </figure>
  );
}

function TutorIntro({ session, onRetry }) {
  const intro = session?.messages?.[0];

  if (!intro && session?.loading) {
    return (
      <section className="tutorIntro tutorLoading">
        <div className="teacherAvatar">K</div>
        <div>
          <span className="tinyLabel">Your tutor is setting up the experiment</span>
          <div className="thinkingDots"><i /><i /><i /></div>
        </div>
      </section>
    );
  }

  if (!intro && session?.error) {
    return (
      <section className="tutorIntro reconnectCard">
        <div className="teacherAvatar">K</div>
        <div className="reconnectCopy">
          <strong>Tutor connection paused.</strong>
          <span>Your lesson is saved.</span>
        </div>
        <button onClick={onRetry}>Retry</button>
      </section>
    );
  }

  if (!intro) return null;

  return (
    <section className="tutorIntro">
      <div className="teacherAvatar">K</div>
      <div className="introCopy">
        <span className="tinyLabel">Before you try it</span>
        <p>{intro.content}</p>
        {intro.artifact && <TeachingArtifact artifact={intro.artifact} />}
      </div>
    </section>
  );
}

function PrimaryLab({ lesson, lab, onRetry }) {
  const brief = lesson?.labBrief || {};

  return (
    <section className="primaryLab">
      <header className="labTopline">
        <div>
          <span className="tinyLabel">Interactive experiment</span>
          <h2>{brief.title || "Try the idea"}</h2>
        </div>
        <div className="labTask">
          <b>Do this</b>
          <span>{brief.learnerTask || brief.purpose || "Try the main action a few times and watch what changes."}</span>
        </div>
      </header>

      {lab?.loading && (
        <div className="labLoading">
          <div className="labLoadingOrb" />
          <strong>Building the experiment…</strong>
        </div>
      )}

      {lab?.error && (
        <div className="labLoading">
          <strong>The experiment didn’t load.</strong>
          <button className="secondaryButton" onClick={onRetry}>Try again</button>
        </div>
      )}

      {lab?.html && (
        <iframe
          sandbox="allow-scripts"
          srcDoc={lab.html}
          title={`${stripNumber(lesson?.title)} interactive lab`}
          className="primaryLabFrame"
        />
      )}
    </section>
  );
}

function Conversation({ lesson, session, draft, setDraft, onSend, onRetry, notesState, onDownloadNotes, onNext, isLast }) {
  const messages = (session?.messages || []).slice(1);

  return (
    <section className="guidedConversation">
      <header className="conversationHeader">
        <div className="teacherAvatar small">K</div>
        <div>
          <strong>Talk through what happened</strong>
          <span>The tutor uses your actual lab results.</span>
        </div>
      </header>

      <div className="conversationBody">
        {messages.length === 0 && !session?.loading && !session?.error && (
          <div className="waitingPrompt">Try the experiment above. The tutor will respond to checkpoints, or you can ask a question at any time.</div>
        )}

        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`guidedTurn ${message.role}`}>
            {message.role === "assistant" && <div className="teacherAvatar small">K</div>}
            <div className="guidedBubble">
              {message.content}
              {message.artifact && <TeachingArtifact artifact={message.artifact} />}
            </div>
          </div>
        ))}

        {session?.loading && session?.messages?.length > 0 && (
          <div className="guidedTurn assistant">
            <div className="teacherAvatar small">K</div>
            <div className="guidedBubble thinkingBubble"><div className="thinkingDots"><i /><i /><i /></div></div>
          </div>
        )}

        {session?.error && session?.messages?.length > 0 && (
          <div className="quietReconnect">
            <span>Tutor paused for a moment.</span>
            <button onClick={onRetry}>Retry</button>
          </div>
        )}
      </div>

      {!session?.mastered && (
        <div className="guidedComposer">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            disabled={session?.loading}
            placeholder="Answer the tutor, ask why, or say what confused you…"
          />
          <button onClick={onSend} disabled={!draft.trim() || session?.loading} aria-label="Send message">↑</button>
        </div>
      )}

      {session?.mastered && (
        <section className="lessonCompleteCard simplifiedComplete">
          <div className="completeIcon">✓</div>
          <div className="completeCopy">
            <span>Lesson mastered</span>
            <h3>{stripNumber(lesson?.title)}</h3>
            <p>Your notes include the ideas you learned and the specific mistakes you made along the way.</p>
          </div>
          <div className="completeActions">
            {notesState?.loading && <button className="secondaryButton" disabled>Preparing PDF…</button>}
            {notesState?.url && (
              <a className="secondaryButton" href={notesState.url} download={notesState.filename || "knowable-lesson-notes.pdf"}>
                Download notes
              </a>
            )}
            {notesState?.error && <button className="secondaryButton" onClick={onDownloadNotes}>Retry notes</button>}
            <button className="primaryButton" onClick={onNext}>{isLast ? "Finish course" : "Next lesson →"}</button>
          </div>
        </section>
      )}
    </section>
  );
}

function CourseStyles() {
  return (
    <style>{`
      .lessonApp{min-height:100vh;background:#f6f6f1;color:#111;}
      .lessonBar{height:68px;background:rgba(246,246,241,.95);backdrop-filter:blur(12px);border-bottom:1px solid #e0e1da;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 28px;position:sticky;top:0;z-index:20;}
      .lessonBar .brand{justify-self:start}.courseName{font-size:13px;color:#70766f;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .lessonCounter{justify-self:center;display:flex;align-items:center;gap:10px;font-size:12px;font-weight:750;color:#50564f;background:white;border:1px solid #dedfd8;border-radius:999px;padding:8px 12px;}
      .lessonCounter i{display:block;width:72px;height:4px;border-radius:99px;background:#e7e8e2;overflow:hidden}.lessonCounter i span{display:block;height:100%;background:#9acb24;border-radius:inherit;}
      .courseExit{justify-self:end;border:0;background:transparent;font-size:12px;color:#737971;cursor:pointer;}
      .lessonCanvas{max-width:930px;margin:0 auto;padding:48px 24px 90px;}
      .lessonHeading{margin-bottom:26px}.lessonHeading span{font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:850;color:#7d847b}.lessonHeading h1{font-size:clamp(34px,4vw,52px);letter-spacing:-.045em;margin:7px 0 8px;line-height:1.02}.lessonHeading p{margin:0;color:#6b716a;font-size:15px;line-height:1.5;max-width:680px;}
      .tutorIntro{display:flex;gap:15px;align-items:flex-start;background:#fff;border:1px solid #dedfd8;border-radius:18px;padding:19px 21px;margin-bottom:18px;box-shadow:0 10px 35px rgba(20,30,20,.04)}
      .teacherAvatar{width:36px;height:36px;border-radius:11px;background:#d7ff59;border:1px solid #b9de43;display:grid;place-items:center;font-weight:900;flex:0 0 auto}.teacherAvatar.small{width:28px;height:28px;border-radius:9px;font-size:12px;}
      .tinyLabel{display:block;font-size:10px;font-weight:850;letter-spacing:.11em;text-transform:uppercase;color:#7b8279}.introCopy{flex:1}.introCopy p{margin:6px 0 0;font-size:18px;line-height:1.55;color:#242724;max-width:760px;}
      .tutorLoading{align-items:center;min-height:78px}.reconnectCard{align-items:center}.reconnectCopy{flex:1;display:flex;flex-direction:column;gap:2px}.reconnectCopy span{font-size:12px;color:#7d837c}.reconnectCard button,.quietReconnect button{border:0;background:transparent;font-weight:750;text-decoration:underline;cursor:pointer;color:#4d554b;}
      .primaryLab{background:white;border:1px solid #d9dbd3;border-radius:22px;overflow:hidden;box-shadow:0 18px 52px rgba(20,30,20,.065);margin-bottom:18px;}
      .labTopline{display:grid;grid-template-columns:1fr minmax(260px,420px);align-items:center;gap:24px;padding:18px 21px;border-bottom:1px solid #ecece6}.labTopline h2{font-size:21px;letter-spacing:-.02em;margin:4px 0 0}.labTask{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.42;color:#626961}.labTask b{text-transform:uppercase;font-size:9px;letter-spacing:.09em;color:#778078;white-space:nowrap;padding-top:2px}.primaryLabFrame{display:block;width:100%;height:500px;border:0;background:#f8f8f3}.labLoading{height:500px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;color:#6e756d;background:#fafaf6}.labLoadingOrb{width:34px;height:34px;border-radius:50%;border:3px solid #e2e5db;border-top-color:#9acb24;animation:spin .9s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
      .guidedConversation{background:white;border:1px solid #dedfd8;border-radius:18px;overflow:hidden}.conversationHeader{display:flex;gap:10px;align-items:center;padding:14px 17px;border-bottom:1px solid #ecece6}.conversationHeader strong{display:block;font-size:13px}.conversationHeader span{display:block;font-size:11px;color:#7a8179;margin-top:2px}.conversationBody{padding:18px;display:flex;flex-direction:column;gap:13px;max-height:390px;overflow:auto}.waitingPrompt{font-size:13px;color:#7a8179;background:#f6f7f2;border-radius:12px;padding:13px 15px;}
      .guidedTurn{display:flex;gap:9px;align-items:flex-start}.guidedTurn.user{justify-content:flex-end}.guidedBubble{max-width:76%;font-size:15px;line-height:1.5;padding:11px 14px;border-radius:15px;background:#f1f3ed;color:#252925}.guidedTurn.user .guidedBubble{background:#e9eddf}.guidedTurn.assistant .guidedBubble{background:#f6f7f2}.thinkingBubble{min-width:60px}.quietReconnect{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#f7f7f3;border-radius:11px;padding:10px 12px;font-size:12px;color:#747b73;}
      .guidedComposer{border-top:1px solid #ecece6;padding:12px;background:#fafaf7;display:flex;gap:9px}.guidedComposer textarea{flex:1;min-height:62px;max-height:140px;resize:vertical;border:1px solid #d9dcd3;border-radius:13px;background:white;padding:12px 13px;outline:none;font-size:14px;line-height:1.4}.guidedComposer textarea:focus{border-color:#a7bd66;box-shadow:0 0 0 3px rgba(180,214,79,.15)}.guidedComposer button{width:42px;height:42px;align-self:flex-end;border:0;border-radius:12px;background:#171917;color:white;font-size:20px;cursor:pointer}.guidedComposer button:disabled{opacity:.3;cursor:default}
      .guidedVisual{margin:12px 0 0;background:white;border:1px solid #dfe1da;border-radius:13px;overflow:hidden}.guidedVisual>div{padding:10px}.guidedVisual svg{display:block;width:100%;height:auto}.guidedVisual figcaption{padding:9px 12px;border-top:1px solid #eceee7;color:#747b73;font-size:11px}.simplifiedComplete{margin:0;border:0;border-top:1px solid #ecece6;border-radius:0;box-shadow:none;}
      @media(max-width:760px){.lessonBar{grid-template-columns:auto 1fr auto;padding:0 14px}.courseName{display:none}.lessonCounter{justify-self:center}.lessonCounter i{width:42px}.lessonCanvas{padding:30px 14px 70px}.labTopline{grid-template-columns:1fr}.labTask{border-top:1px solid #ecece6;padding-top:12px}.primaryLabFrame,.labLoading{height:430px}.introCopy p{font-size:16px}.guidedBubble{max-width:88%}.courseExit{font-size:0}.courseExit:after{content:'Exit';font-size:12px}}
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
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Tutor unavailable");
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
      content: data.reply || "I’ll walk you through the experiment one step at a time.",
      ...(artifact ? { artifact } : {}),
    };
    const nextSession = {
      ...workingSession,
      started: true,
      loading: false,
      error: false,
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

    if (data.showLab) ensureLab(index);
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
      const nextSession = { ...current, labEvents: nextEvents };

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

  async function sendCurrentMessage() {
    const content = draft.trim();
    const current = sessions[lessonIndex];
    if (!content || current?.loading || current?.mastered) return;
    const userMessage = { role: "user", content };
    const working = {
      ...(current || { started: true, pitfalls: [], coveredConcepts: [], labEvents: [], messages: [], showLab: true }),
      started: true,
      loading: true,
      error: false,
      messages: [...(current?.messages || []), userMessage],
    };
    setDraft("");
    setSessions((previous) => ({ ...previous, [lessonIndex]: working }));
    await requestTeacher(lessonIndex, working);
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
          <p className="lede">Every lesson becomes a small interactive world. The tutor first tells you what you are about to discover, then guides you through the experiment.</p>
          <div className="formCard">
            <label className="bigLabel">Why are you learning this?<textarea autoFocus value={why} onChange={(event) => setWhy(event.target.value)} placeholder="I want to understand probability well enough to make smarter decisions." /></label>
            <label className="bigLabel">What would success look like?<textarea value={success} onChange={(event) => setSuccess(event.target.value)} placeholder="I can look at a game or decision and reason about the odds and expected outcome." /></label>
            <label className="bigLabel">What do you already know? <span>optional</span><textarea value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Almost nothing; teach from scratch." /></label>
            {error && <p className="errorBox">{error}</p>}
            <button className="primaryButton wide" disabled={!why.trim() || !success.trim() || loading} onClick={generateCourse}>{loading ? "Designing your interactive path…" : "Start learning →"}</button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "course" && course) {
    const lesson = course.lessons[lessonIndex];
    const session = sessions[lessonIndex] || { messages: [], loading: true, showLab: false };
    const progress = Math.round((completed.length / course.lessons.length) * 100);

    return (
      <main className="tutorApp">
        <CourseStyles />
        <aside className="courseRail">
          <button className="brand railBrand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <div className="railCourse">
            <span>Your course</span>
            <h2>{course.title}</h2>
            <div className="railProgress"><i style={{ width: `${progress}%` }} /></div>
            <small>{progress}% mastered</small>
          </div>
          <div className="railLessons">
            {course.lessons.map((item, index) => {
              const locked = index > 0 && !completed.includes(index - 1) && !completed.includes(index);
              return (
                <button
                  key={`${index}-${item.title}`}
                  disabled={locked}
                  className={`${index === lessonIndex ? "active" : ""} ${completed.includes(index) ? "done" : ""}`}
                  onClick={() => {
                    if (!locked) {
                      setLessonIndex(index);
                      setDraft("");
                    }
                  }}
                >
                  <span>{completed.includes(index) ? "✓" : index + 1}</span>
                  <b>{stripNumber(item.title)}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="tutorMain">
          <header className="tutorHeader">
            <div>
              <span>Lesson {lessonIndex + 1} of {course.lessons.length}</span>
              <h1>{stripNumber(lesson.title)}</h1>
            </div>
            <div className="lessonGoal">{lesson.objective}</div>
          </header>

          <div style={{ flex: 1, overflowY: "auto" }}>
            <div style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 28px 70px" }}>
              <TutorIntro session={session} onRetry={retryTeacher} />

              {session.showLab && session.messages?.length > 0 && (
                <PrimaryLab lesson={lesson} lab={labs[lessonIndex]} onRetry={() => ensureLab(lessonIndex, true)} />
              )}

              {session.messages?.length > 0 && (
                <Conversation
                  lesson={lesson}
                  session={session}
                  draft={draft}
                  setDraft={setDraft}
                  onSend={sendCurrentMessage}
                  onRetry={retryTeacher}
                  notesState={notes[lessonIndex]}
                  onDownloadNotes={() => generateNotes(lessonIndex)}
                  onNext={goNext}
                  isLast={lessonIndex === course.lessons.length - 1}
                />
              )}
            </div>
          </div>
        </section>
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
        <span className="heroBadge">Every lesson is something you can touch</span>
        <h1>Learn by <em>doing first.</em></h1>
        <p>Knowable explains what you are about to discover, gives you one interactive experiment, then asks precise questions about what actually happened.</p>
        <div className="customBar">
          <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What do you want to learn?" onKeyDown={(event) => { if (event.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() }); }} />
          <button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Start →</button>
        </div>
      </section>

      <section className="examples">
        <div className="sectionHead"><div><span className="eyebrow">Start somewhere</span><h2>Example subjects</h2></div><p>One tutor. One experiment. One idea at a time.</p></div>
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