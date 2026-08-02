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
        error: "",
        messages: (session?.messages || []).map(({ artifact, ...message }) => message),
      },
    ]),
  );
}

function TeachingArtifact({ artifact }) {
  if (!artifact?.visualSvg) return null;
  return (
    <figure className="chatArtifact visualArtifact" style={{ marginTop: 14 }}>
      <div className="artifactVisual" dangerouslySetInnerHTML={{ __html: artifact.visualSvg }} />
      {artifact?.brief?.task && <figcaption>{artifact.brief.task}</figcaption>}
    </figure>
  );
}

function PrimaryLab({ lesson, lab, onRetry }) {
  const brief = lesson?.labBrief || {};

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #dedfd8",
        borderRadius: 22,
        overflow: "hidden",
        boxShadow: "0 16px 45px rgba(20,30,20,.06)",
      }}
    >
      <div
        style={{
          padding: "17px 20px",
          borderBottom: "1px solid #ecece6",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div>
          <span style={{ display: "block", fontSize: 10, fontWeight: 850, letterSpacing: ".13em", textTransform: "uppercase", color: "#788078" }}>
            Interactive lesson
          </span>
          <strong style={{ display: "block", marginTop: 4, fontSize: 19 }}>{brief.title || "Explore the idea"}</strong>
        </div>
        <span style={{ fontSize: 12, color: "#697069", maxWidth: 430, textAlign: "right", lineHeight: 1.4 }}>
          {brief.learnerTask || brief.purpose || "Try the main action and look for the pattern."}
        </span>
      </div>

      {lab?.loading && (
        <div style={{ height: "500px", display: "grid", placeItems: "center", background: "#fafaf6", color: "#747a73" }}>
          Building this lesson’s interactive world…
        </div>
      )}

      {lab?.error && (
        <div style={{ height: "500px", display: "grid", placeItems: "center", background: "#fafaf6" }}>
          <div style={{ textAlign: "center", maxWidth: 420 }}>
            <strong>Lab generation failed.</strong>
            <p style={{ color: "#666d65" }}>This lesson is supposed to be interactive, so don’t continue with a blank substitute.</p>
            <button className="primaryButton" onClick={onRetry}>Retry lab</button>
          </div>
        </div>
      )}

      {lab?.html && (
        <iframe
          sandbox="allow-scripts"
          srcDoc={lab.html}
          title={`${stripNumber(lesson?.title)} interactive lab`}
          style={{ display: "block", width: "100%", height: "500px", border: 0, background: "#f7f7f2" }}
        />
      )}
    </section>
  );
}

function Conversation({ lesson, session, draft, setDraft, onSend, onRetry, notesState, onDownloadNotes, onNext, isLast }) {
  const messages = session?.messages || [];

  return (
    <section style={{ marginTop: 18 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #dedfd8",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #ecece6", display: "flex", alignItems: "center", gap: 10 }}>
          <div className="teacherMark" style={{ width: 30, height: 30, flex: "0 0 auto" }}>K</div>
          <div>
            <strong style={{ fontSize: 14 }}>AI tutor</strong>
            <span style={{ display: "block", fontSize: 11, color: "#7b817a" }}>Watching the same lab you are</span>
          </div>
        </div>

        <div style={{ maxHeight: 285, overflowY: "auto", padding: "18px 20px" }}>
          {messages.map((message, index) => (
            <div key={`${index}-${message.role}`} className={`turn ${message.role}`} style={{ marginBottom: 14 }}>
              {message.role === "assistant" && <div className="teacherMark">K</div>}
              <div className="turnBody">
                <div className="messageText">{message.content}</div>
                {message.artifact && <TeachingArtifact artifact={message.artifact} />}
              </div>
            </div>
          ))}

          {session?.loading && (
            <div className="turn assistant thinkingTurn">
              <div className="teacherMark">K</div>
              <div className="thinkingDots"><i /><i /><i /></div>
            </div>
          )}

          {session?.error && (
            <div style={{ background: "#fff2ed", border: "1px solid #efd4ca", borderRadius: 12, padding: 13, color: "#7d493b", fontSize: 13 }}>
              <strong>The AI tutor didn’t answer.</strong> {session.error}
              <button onClick={onRetry} style={{ marginLeft: 10, border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer", fontWeight: 750 }}>Retry</button>
            </div>
          )}
        </div>

        {!session?.mastered && (
          <div style={{ borderTop: "1px solid #ecece6", padding: 12, background: "#fafaf6" }}>
            <div className="conversationComposer" style={{ margin: 0 }}>
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
                placeholder="Tell the tutor what you noticed, ask what it means, or say you’re confused…"
              />
              <button onClick={onSend} disabled={!draft.trim() || session?.loading} aria-label="Send message">↑</button>
            </div>
          </div>
        )}
      </div>

      {session?.mastered && (
        <section className="lessonCompleteCard" style={{ marginTop: 18 }}>
          <div className="completeIcon">✓</div>
          <div className="completeCopy">
            <span>Lesson mastered</span>
            <h3>{stripNumber(lesson?.title)}</h3>
            <p>Your PDF notes include what you learned and the specific mistakes you made along the way.</p>
          </div>
          <div className="completeActions">
            {notesState?.loading && <button className="secondaryButton" disabled>Preparing PDF…</button>}
            {notesState?.url && (
              <a className="secondaryButton" href={notesState.url} download={notesState.filename || "knowable-lesson-notes.pdf"}>
                Download lesson notes
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

    setLabs((previous) => ({ ...previous, [index]: { loading: true, error: "", html: "" } }));
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson,
          course,
          brief: { kind: "lab", ...(lesson.labBrief || {}) },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.labHtml) throw new Error(data?.error || "Lab generation failed");
      setLabs((previous) => ({ ...previous, [index]: { loading: false, error: "", html: data.labHtml } }));
    } catch (err) {
      setLabs((previous) => ({ ...previous, [index]: { loading: false, error: err?.message || "Lab generation failed", html: "" } }));
    }
  }

  async function requestTeacher(index, workingSession) {
    const lesson = course?.lessons?.[index];
    if (!lesson || !course) return;

    const transcript = (workingSession?.messages || []).map((message) => ({ role: message.role, content: message.content }));

    try {
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
      if (!response.ok) throw new Error(data?.error || "Teaching request failed");

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
        content: data.reply || "Try the lab once more and tell me what changed.",
        ...(artifact ? { artifact } : {}),
      };
      const nextSession = {
        ...workingSession,
        started: true,
        loading: false,
        error: "",
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
    } catch (err) {
      const nextSession = {
        ...workingSession,
        started: true,
        loading: false,
        error: err?.message || "Retry this turn.",
      };
      setSessions((previous) => {
        const next = { ...previous, [index]: nextSession };
        persist(course, completed, next);
        return next;
      });
    }
  }

  function startLesson(index) {
    const current = sessions[index];
    ensureLab(index);
    if (current?.started || current?.loading || !course?.lessons?.[index]) return;
    const base = {
      started: true,
      loading: true,
      error: "",
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
        error: "",
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
        const working = { ...nextSession, loading: true, error: "" };
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
      ...(current || { started: true, pitfalls: [], coveredConcepts: [], labEvents: [], messages: [] }),
      started: true,
      loading: true,
      error: "",
      messages: [...(current?.messages || []), userMessage],
    };
    setDraft("");
    setSessions((previous) => ({ ...previous, [lessonIndex]: working }));
    await requestTeacher(lessonIndex, working);
  }

  async function retryTeacher() {
    const current = sessions[lessonIndex];
    if (!current || current.loading || current.mastered) return;
    const working = { ...current, loading: true, error: "" };
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
          <p className="lede">Every lesson becomes a small interactive world. The AI tutor watches the same experiment and teaches from what you actually do.</p>
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
    const session = sessions[lessonIndex] || { messages: [], loading: true };
    const progress = Math.round((completed.length / course.lessons.length) * 100);

    return (
      <main className="tutorApp">
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

        <section className="tutorMain" style={{ background: "#f7f7f2" }}>
          <header className="tutorHeader" style={{ paddingBottom: 16 }}>
            <div>
              <span>Lesson {lessonIndex + 1} of {course.lessons.length}</span>
              <h1>{stripNumber(lesson.title)}</h1>
            </div>
            <div className="lessonGoal">{lesson.objective}</div>
          </header>

          <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 28px 70px" }}>
            <PrimaryLab lesson={lesson} lab={labs[lessonIndex]} onRetry={() => ensureLab(lessonIndex, true)} />
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
        <p>Knowable builds a custom interactive lab for every lesson. An AI tutor watches what happens, talks you through the experiment, and only moves on when the idea clicks.</p>
        <div className="customBar">
          <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What do you want to learn?" onKeyDown={(event) => { if (event.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() }); }} />
          <button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Start →</button>
        </div>
      </section>

      <section className="examples">
        <div className="sectionHead"><div><span className="eyebrow">Start somewhere</span><h2>Example subjects</h2></div><p>The lesson is not an article. It is a manipulable situation plus a tutor that adapts to what you do.</p></div>
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
