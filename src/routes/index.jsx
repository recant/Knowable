import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

const EXAMPLES = [
  { title: "Calculus", kicker: "Math", icon: "∫", description: "Build derivatives and integrals from motion, slope, and area." },
  { title: "Probability", kicker: "Math", icon: "◒", description: "Learn uncertainty by running experiments and updating beliefs." },
  { title: "Linear Algebra", kicker: "Math", icon: "↗", description: "Manipulate vectors, transformations, and spaces visually." },
  { title: "Physics of Motion", kicker: "Physics", icon: "↝", description: "Explore forces and trajectories before touching the equations." },
  { title: "Molecular Biology", kicker: "Biology", icon: "⌁", description: "Treat cells as systems you can inspect, perturb, and reason about." },
  { title: "Machine Learning", kicker: "Computing", icon: "◇", description: "See what models optimize and why their behavior changes." },
  { title: "Economics", kicker: "Social science", icon: "⇄", description: "Make incentives, markets, and tradeoffs tangible." },
  { title: "Music Theory", kicker: "Music", icon: "♪", description: "Hear and manipulate intervals, chords, rhythm, and harmony." },
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
        messages: (session?.messages || []).map(({ artifact, ...message }) => message),
      },
    ]),
  );
}

function TeachingArtifact({ artifact }) {
  if (!artifact) return null;
  const brief = artifact.brief || {};

  if (artifact.kind === "visual" && artifact.visualSvg) {
    return (
      <figure className="chatArtifact visualArtifact">
        <div className="artifactVisual" dangerouslySetInnerHTML={{ __html: artifact.visualSvg }} />
        {brief.task && <figcaption>{brief.task}</figcaption>}
      </figure>
    );
  }

  if (artifact.kind === "lab" && artifact.labHtml) {
    return (
      <section className="chatArtifact labArtifact">
        <div className="artifactHeader">
          <div>
            <span>Try it</span>
            <strong>{brief.title || "Interactive lab"}</strong>
          </div>
          <small>{brief.task || "Change one thing and notice what happens."}</small>
        </div>
        <iframe
          className="conversationLab"
          sandbox="allow-scripts"
          srcDoc={artifact.labHtml}
          title={brief.title || "Interactive teaching lab"}
        />
      </section>
    );
  }

  return null;
}

function Conversation({ lesson, session, draft, setDraft, onSend, notesState, onDownloadNotes, onNext, isLast }) {
  const messages = session?.messages || [];
  return (
    <div className="conversationShell">
      <div className="conversationStream">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`turn ${message.role}`}>
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

        {session?.mastered && (
          <section className="lessonCompleteCard">
            <div className="completeIcon">✓</div>
            <div className="completeCopy">
              <span>Lesson mastered</span>
              <h3>{stripNumber(lesson?.title)}</h3>
              <p>Your notes are built from this conversation, including the specific misconceptions you ran into.</p>
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
      </div>

      {!session?.mastered && (
        <div className="conversationComposerWrap">
          <div className="conversationComposer">
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
              placeholder="Answer, ask a question, or say what confused you…"
            />
            <button onClick={onSend} disabled={!draft.trim() || session?.loading} aria-label="Send message">↑</button>
          </div>
          <p>Enter to send · Shift+Enter for a new line</p>
        </div>
      )}
    </div>
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
      JSON.stringify({
        course: nextCourse,
        completed: nextCompleted,
        sessions: serializableSessions(nextSessions),
      }),
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
          state: {
            pitfalls: workingSession?.pitfalls || [],
            coveredConcepts: workingSession?.coveredConcepts || [],
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Teaching request failed");

      let artifact = null;
      if (data.artifactBrief) {
        try {
          const artifactResponse = await fetch("/api/lab", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lesson, course, brief: data.artifactBrief }),
          });
          const artifactData = await artifactResponse.json();
          if (artifactResponse.ok) artifact = { ...artifactData, brief: data.artifactBrief };
        } catch {}
      }

      const assistantMessage = {
        role: "assistant",
        content: data.reply || "Tell me what you think is happening here.",
        ...(artifact ? { artifact } : {}),
      };
      const nextSession = {
        ...workingSession,
        started: true,
        loading: false,
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
    } catch {
      const nextSession = {
        ...workingSession,
        started: true,
        loading: false,
        messages: [
          ...(workingSession.messages || []),
          { role: "assistant", content: "I lost the thread for a second. Tell me what part feels unclear, and we’ll rebuild it from there." },
        ],
      };
      setSessions((previous) => ({ ...previous, [index]: nextSession }));
    }
  }

  function startLesson(index) {
    const current = sessions[index];
    if (current?.started || current?.loading || !course?.lessons?.[index]) return;
    const base = {
      started: true,
      loading: true,
      messages: [],
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

  async function sendCurrentMessage() {
    const content = draft.trim();
    const current = sessions[lessonIndex];
    if (!content || current?.loading || current?.mastered) return;
    const userMessage = { role: "user", content };
    const working = {
      ...(current || { started: true, pitfalls: [], coveredConcepts: [], messages: [] }),
      started: true,
      loading: true,
      messages: [...(current?.messages || []), userMessage],
    };
    setDraft("");
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
          <p className="lede">The teacher will change its explanations, examples, questions, diagrams, and labs as it learns how you think.</p>
          <div className="formCard">
            <label className="bigLabel">Why are you learning this?<textarea autoFocus value={why} onChange={(event) => setWhy(event.target.value)} placeholder="I want to understand ML well enough to build and debug models at work." /></label>
            <label className="bigLabel">What would success look like?<textarea value={success} onChange={(event) => setSuccess(event.target.value)} placeholder="I can reason about why a model behaves the way it does, not just use a library." /></label>
            <label className="bigLabel">What do you already know? <span>optional</span><textarea value={background} onChange={(event) => setBackground(event.target.value)} placeholder="Comfortable with Python, rusty algebra, no formal ML." /></label>
            {error && <p className="errorBox">{error}</p>}
            <button className="primaryButton wide" disabled={!why.trim() || !success.trim() || loading} onClick={generateCourse}>{loading ? "Designing your path…" : "Start learning →"}</button>
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

        <section className="tutorMain">
          <header className="tutorHeader">
            <div>
              <span>Lesson {lessonIndex + 1} of {course.lessons.length}</span>
              <h1>{stripNumber(lesson.title)}</h1>
            </div>
            <div className="lessonGoal">{lesson.objective}</div>
          </header>

          <Conversation
            lesson={lesson}
            session={session}
            draft={draft}
            setDraft={setDraft}
            onSend={sendCurrentMessage}
            notesState={notes[lessonIndex]}
            onDownloadNotes={() => generateNotes(lessonIndex)}
            onNext={goNext}
            isLast={lessonIndex === course.lessons.length - 1}
          />
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
        <span className="heroBadge">A teacher that changes with you</span>
        <h1>Learn by <em>thinking out loud.</em></h1>
        <p>Tell Knowable what you want to be able to do. An AI tutor teaches you one idea at a time, builds diagrams and labs when they help, and moves on only when you understand.</p>
        <div className="customBar">
          <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="What do you want to learn?" onKeyDown={(event) => { if (event.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() }); }} />
          <button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Start →</button>
        </div>
      </section>

      <section className="examples">
        <div className="sectionHead"><div><span className="eyebrow">Start somewhere</span><h2>Example subjects</h2></div><p>The curriculum is only the map. The actual lesson is generated turn by turn around your responses.</p></div>
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
