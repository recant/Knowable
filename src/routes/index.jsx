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

function MasteryTutor({ lesson, course, state, onChange }) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const initialQuestion =
    lesson?.tutorSeed?.openingQuestion ||
    "Explain the main idea of this lesson in your own words. What is actually happening?";
  const messages = state?.messages?.length
    ? state.messages
    : [{ role: "assistant", content: initialQuestion }];

  async function send() {
    const content = draft.trim();
    if (!content || sending) return;

    const transcript = [...messages, { role: "user", content }];
    onChange({ ...state, messages: transcript, unlocked: false });
    setDraft("");
    setSending(true);

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lesson,
          learnerGoal: course?.learnerGoal,
          successMetric: course?.successMetric,
          transcript,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Tutor request failed");

      onChange({
        messages: [...transcript, { role: "assistant", content: data.reply }],
        unlocked: Boolean(data.unlocked),
        mastered: Boolean(data.mastered),
        confidence: Number(data.confidence || 0),
        missing: Array.isArray(data.missing) ? data.missing : [],
      });
    } catch {
      onChange({
        messages: [
          ...transcript,
          {
            role: "assistant",
            content: "I couldn't check that answer just now. Try once more and explain the mechanism, not just the result.",
          },
        ],
        unlocked: false,
        mastered: false,
        confidence: 0,
        missing: [],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="tutorPanel">
      <div className="tutorIdentity">
        <div className="tutorOrb">K</div>
        <div>
          <span>Knowable tutor</span>
          <strong>{state?.unlocked ? "Mastery confirmed" : "Checking understanding"}</strong>
        </div>
      </div>

      <div className="tutorThread">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`bubble ${message.role}`}>
            {message.content}
          </div>
        ))}
        {sending && <div className="bubble assistant thinking">Thinking…</div>}
      </div>

      {state?.missing?.length > 0 && !state?.unlocked && (
        <div className="tutorHint">
          <span>Still looking for</span>
          {state.missing.map((item, index) => <p key={index}>{item}</p>)}
        </div>
      )}

      <div className="composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Explain it in your own words…"
        />
        <button onClick={send} disabled={!draft.trim() || sending}>Send</button>
      </div>

      <div className={state?.unlocked ? "masteryBanner unlocked" : "masteryBanner"}>
        <span>{state?.unlocked ? "✓" : "○"}</span>
        <div>
          <strong>{state?.unlocked ? "Ready to move on" : "Continue is locked"}</strong>
          <small>
            {state?.unlocked
              ? "You demonstrated the idea well enough to continue."
              : "The tutor unlocks the lesson after you explain, predict, and transfer the idea."}
          </small>
        </div>
      </div>
    </aside>
  );
}

function GeneratedExperience({ lesson, course, experience, onLoaded }) {
  const [loading, setLoading] = useState(!experience);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (experience) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setError("");
    fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson, course }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Could not generate lab");
        return data;
      })
      .then((data) => {
        if (!cancelled) onLoaded(data);
      })
      .catch(() => {
        if (!cancelled) setError("The custom lab failed to load. Reload this lesson to try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [lesson, course, experience]);

  if (loading) {
    return (
      <div className="experienceStack">
        <section className="visualCard skeletonCard">
          <span className="eyebrow">Visual intuition</span>
          <div className="skeleton visualSkeleton" />
        </section>
        <section className="labCard premiumLab skeletonCard">
          <span className="eyebrow">Building your lab</span>
          <div className="skeleton labSkeleton" />
        </section>
      </div>
    );
  }

  if (error || !experience) {
    return <div className="experienceError">{error || "This interactive experience is unavailable."}</div>;
  }

  return (
    <div className="experienceStack">
      {experience.visualSvg && (
        <section className="visualCard">
          <div className="sectionTitleRow">
            <div><span className="eyebrow">Visual intuition</span><h2>See the structure</h2></div>
            <span className="assetPill">AI diagram</span>
          </div>
          <div className="svgStage" dangerouslySetInnerHTML={{ __html: experience.visualSvg }} />
        </section>
      )}

      <section className="labCard premiumLab">
        <div className="sectionTitleRow">
          <div>
            <span className="eyebrow">Interactive lab</span>
            <h2>{lesson?.labBrief?.title || "Explore the idea"}</h2>
          </div>
          <span className="livePill">Interactive</span>
        </div>
        <p className="labPurpose">{lesson?.labBrief?.purpose}</p>
        <iframe
          className="customLabFrame"
          sandbox="allow-scripts"
          srcDoc={experience.labHtml}
          title={`${stripNumber(lesson?.title)} interactive lab`}
        />
      </section>
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
  const [tutorStates, setTutorStates] = useState({});
  const [experiences, setExperiences] = useState({});
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);
  const [demoReason, setDemoReason] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("knowable-course"));
      if (saved?.course) {
        setCourse(saved.course);
        setCompleted(saved.completed || []);
        setTutorStates(saved.tutorStates || {});
      }
    } catch {}
  }, []);

  function persist(nextCompleted = completed, nextTutorStates = tutorStates) {
    if (!course) return;
    localStorage.setItem(
      "knowable-course",
      JSON.stringify({ course, completed: nextCompleted, tutorStates: nextTutorStates }),
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
      const res = await fetch("/api/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selected.title, why, success, background }),
      });
      const data = await res.json();
      if (!res.ok || !data.course) throw new Error(data.error || "Could not build course");

      setCourse(data.course);
      setDemo(Boolean(data.demo));
      setDemoReason(data.demoReason || "");
      setCompleted([]);
      setTutorStates({});
      setExperiences({});
      setLessonIndex(0);
      localStorage.setItem(
        "knowable-course",
        JSON.stringify({ course: data.course, completed: [], tutorStates: {} }),
      );
      setScreen("course");
    } catch (err) {
      setError(err?.message || "Could not build course");
    } finally {
      setLoading(false);
    }
  }

  function updateTutorState(index, nextState) {
    setTutorStates((previous) => {
      const next = { ...previous, [index]: nextState };
      if (course) {
        localStorage.setItem(
          "knowable-course",
          JSON.stringify({ course, completed, tutorStates: next }),
        );
      }
      return next;
    });
  }

  function markComplete() {
    const next = completed.includes(lessonIndex) ? completed : [...completed, lessonIndex];
    setCompleted(next);
    persist(next, tutorStates);
    if (lessonIndex < course.lessons.length - 1) setLessonIndex(lessonIndex + 1);
  }

  if (screen === "onboarding") {
    return (
      <main className="shell onboardingPage">
        <nav className="nav">
          <button className="brand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <div className="navRight"><span>course setup</span></div>
        </nav>
        <section className="onboardingWrap">
          <span className="stepPill">Built around your destination</span>
          <h1>Make <em>{selected.title}</em> useful to you.</h1>
          <p className="lede">Knowable changes the sequence, examples, visuals, labs, and mastery checks around what you actually want to do.</p>
          <div className="formCard">
            <label className="bigLabel">
              Why are you learning this?
              <textarea autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="I want enough calculus intuition to understand optimization in ML papers." />
            </label>
            <label className="bigLabel">
              What would success look like?
              <textarea value={success} onChange={(e) => setSuccess(e.target.value)} placeholder="I can explain gradients and reason through gradient descent without memorizing formulas." />
            </label>
            <label className="bigLabel">
              What do you already know? <span>optional</span>
              <textarea value={background} onChange={(e) => setBackground(e.target.value)} placeholder="Basic algebra, almost no calculus." />
            </label>
            {error && <p className="errorBox">{error}</p>}
            <button className="primary full" disabled={!why.trim() || !success.trim() || loading} onClick={generateCourse}>
              {loading ? "Designing your course…" : "Build my course →"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (screen === "course" && course) {
    const lesson = course.lessons[lessonIndex];
    const tutorState = tutorStates[lessonIndex] || {};
    const experience = experiences[lessonIndex];
    const progress = Math.round((completed.length / course.lessons.length) * 100);

    return (
      <main className="courseShell">
        <aside className="sidebar">
          <button className="brand sidebarBrand" onClick={() => setScreen("home")}>knowable<span>.</span></button>
          <div className="courseMeta">
            <span>Your course</span>
            <h2>{course.title}</h2>
            <p>{course.subtitle}</p>
          </div>
          <div className="progressRow">
            <span>{progress}% mastered</span>
            <div className="progressTrack"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="lessonList">
            {course.lessons.map((item, index) => {
              const locked = index > 0 && !completed.includes(index - 1) && !completed.includes(index);
              return (
                <button
                  key={`${index}-${item.title}`}
                  disabled={locked}
                  className={`lessonNav ${index === lessonIndex ? "active" : ""} ${locked ? "locked" : ""}`}
                  onClick={() => !locked && setLessonIndex(index)}
                >
                  <span className={completed.includes(index) ? "lessonNum done" : "lessonNum"}>
                    {completed.includes(index) ? "✓" : locked ? "·" : index + 1}
                  </span>
                  <span><b>{stripNumber(item.title)}</b><small>{locked ? "locked" : "10 min"}</small></span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="lessonPane">
          <div className="lessonTop">
            <span>Lesson {lessonIndex + 1} of {course.lessons.length}</span>
            {demo && <span className="demoPill" title={demoReason}>demo fallback</span>}
          </div>

          <div className="learningLayout">
            <article className="lessonContent">
              <header className="lessonHero">
                <div className="lessonMeta"><span>10 min</span><span>Personalized</span><span>Interactive</span></div>
                <h1>{stripNumber(lesson.title)}</h1>
                <p>{lesson.objective}</p>
              </header>

              <div className="whyBox">
                <span>Why this matters for you</span>
                <p>{lesson.whyItMatters}</p>
              </div>

              <section className="conceptCard">
                <span className="eyebrow">Build the intuition</span>
                <p className="explanationText">{lesson.explanation}</p>
                {lesson.keyIdeas?.length > 0 && (
                  <div className="ideaGrid">
                    {lesson.keyIdeas.map((idea, index) => (
                      <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{idea}</p></div>
                    ))}
                  </div>
                )}
              </section>

              <GeneratedExperience
                lesson={lesson}
                course={course}
                experience={experience}
                onLoaded={(data) =>
                  setExperiences((previous) => ({ ...previous, [lessonIndex]: data }))
                }
              />

              {tutorState.unlocked && (
                <button className="primary continueButton" onClick={markComplete}>
                  {lessonIndex === course.lessons.length - 1 ? "Finish course ✓" : "Continue to next lesson →"}
                </button>
              )}
            </article>

            <MasteryTutor
              lesson={lesson}
              course={course}
              state={tutorState}
              onChange={(nextState) => updateTutorState(lessonIndex, nextState)}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell homeShell">
      <nav className="nav">
        <button className="brand">knowable<span>.</span></button>
        <div className="navRight">
          <span>open source learning</span>
          <button className="textButton" onClick={() => course && setScreen("course")} disabled={!course}>Continue →</button>
        </div>
      </nav>

      <section className="hero">
        <div className="heroCopy">
          <span className="heroBadge">A course that rebuilds itself around you</span>
          <h1>Don’t consume a course.<br/><em>Make the idea click.</em></h1>
          <p>Tell Knowable what you want to understand and why. It builds the path, diagrams, interactive labs, and a tutor that won’t let you move on until you actually get it.</p>
          <div className="customBar">
            <input
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="What do you want to understand?"
              onKeyDown={(e) => {
                if (e.key === "Enter" && customTopic.trim()) chooseCourse({ title: customTopic.trim() });
              }}
            />
            <button onClick={() => customTopic.trim() && chooseCourse({ title: customTopic.trim() })}>Build my course →</button>
          </div>
        </div>
        <div className="heroVisual" aria-hidden="true">
          <div className="visualWindow">
            <div className="windowTop"><i/><i/><i/></div>
            <div className="miniLesson">
              <span>LESSON 03</span>
              <h3>Feel what a gradient does</h3>
              <div className="miniGraph"><b/><b/><b/><b/></div>
              <div className="miniTutor">Why does the ball move toward the valley?</div>
            </div>
          </div>
        </div>
      </section>

      <section className="examples">
        <div className="sectionHead">
          <div><span className="eyebrow">Start somewhere</span><h2>Pick a direction.</h2></div>
          <p>The topic is only the starting point. Your reason for learning it changes the course.</p>
        </div>
        <div className="courseGrid">
          {EXAMPLES.map((item) => (
            <button className="courseCard" key={item.title} onClick={() => chooseCourse(item)}>
              <div className="courseCardTop"><span className="courseIcon">{item.icon}</span><span className="kicker">{item.kicker}</span></div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <div className="cardFoot"><span>Personalize course</span><b>↗</b></div>
            </button>
          ))}
        </div>
      </section>

      <section className="manifesto">
        <span>HOW KNOWABLE TEACHES</span>
        <h2>See it. Touch it. Explain it.<br/><em>Then move on.</em></h2>
        <div className="three">
          <div><b>01</b><h3>Visualize</h3><p>Every lesson can generate the diagram that best exposes its structure.</p></div>
          <div><b>02</b><h3>Manipulate</h3><p>Gemini builds a bespoke sandboxed lab instead of choosing from four canned widgets.</p></div>
          <div><b>03</b><h3>Demonstrate mastery</h3><p>A Socratic tutor probes your explanation and unlocks the next lesson only when the idea holds up.</p></div>
        </div>
      </section>
    </main>
  );
}
