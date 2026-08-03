import { generateGeminiText } from "./gemini";

function fallbackCourse({ topic, why, success, background }) {
  const names = [
    "Build the mental model",
    "See the system move",
    "Change one variable",
    "Predict before calculating",
    "Connect representations",
    "Break the model",
    "Transfer the idea",
    "Prove you can use it",
  ];

  return {
    title: topic,
    subtitle: "Learn one idea at a time, then make it move",
    learnerGoal: why || `Understand ${topic} well enough to use it`,
    successMetric: success || `Use ${topic} confidently without outside help`,
    lessons: names.map((name, index) => ({
      title: `${index + 1}. ${name}`,
      durationMinutes: 10,
      objective: `Build one concrete piece of your ${topic} mental model and connect it to what came before.`,
      whyItMatters: `This lesson is here because your goal is: ${why || `understand ${topic}`}.`,
      explanation: `Build the intuition in small steps, then test it interactively. ${background ? `Build from what you already know: ${background}.` : "No prior knowledge is assumed."}`,
      keyIdeas: [
        `Identify the mechanism behind this part of ${topic}.`,
        "Predict what will happen before interacting.",
        "Explain what the result means in plain language.",
      ],
      visualBrief: `A minimal supporting diagram for lesson ${index + 1} of ${topic}, only if it helps before or after the lab.`,
      labBrief: {
        title: `Explore ${topic}`,
        concept: `The central causal idea in lesson ${index + 1}.`,
        scene: `A concrete, familiar miniature world that makes this ${topic} concept feel real rather than abstract.`,
        purpose: "Let the learner discover the central relationship by doing something and immediately seeing the consequence.",
        interaction: "One obvious primary action plus at most one optional control. The visual state must visibly change every time.",
        learnerTask: "Try the main action several times, make a prediction, and notice the pattern.",
        checkpoint: "Send a teaching checkpoint to the parent after a meaningful experiment so the lesson can react to what happened.",
      },
      tutorSeed: {
        openingQuestion: "Start with a short conceptual setup. Ask a focused prediction when useful, and reveal the lab only when the learner has enough context to learn from it.",
        masteryCriteria: [
          "Explains the mechanism rather than repeating vocabulary",
          "Can predict what changes when a relevant variable changes",
          "Can apply the idea to a slightly different example",
        ],
      },
    })),
  };
}

function buildPrompt(input) {
  return `You are the curriculum designer for Knowable, an adaptive interactive learning product.

Create a personalized course about: ${input.topic}
Why the learner wants it: ${input.why || "not specified"}
How they measure success: ${input.success || "not specified"}
What they already know: ${input.background || "not specified"}

Return ONLY one valid JSON object. No markdown, code fences, or commentary.

Use this shape:
{
  "title": "string",
  "subtitle": "string",
  "learnerGoal": "string",
  "successMetric": "string",
  "lessons": [
    {
      "title": "string",
      "durationMinutes": 10,
      "objective": "string",
      "whyItMatters": "string",
      "explanation": "one-sentence internal summary; the UI will NOT show a textbook paragraph",
      "keyIdeas": ["string", "string", "string"],
      "visualBrief": "optional supporting diagram idea",
      "labBrief": {
        "title": "short name for the interactive experience",
        "concept": "the ONE concept this lab makes tangible",
        "scene": "the concrete miniature world or objects the learner sees",
        "purpose": "what they should discover",
        "interaction": "exact interaction mechanics",
        "learnerTask": "a short experiment the adaptive lesson can ask them to do",
        "checkpoint": "what meaningful interaction/result should trigger the next teaching step"
      },
      "tutorSeed": {
        "openingQuestion": "pacing guidance for how to set up, question, and eventually reveal the lab",
        "masteryCriteria": ["criterion", "criterion", "criterion"]
      }
    }
  ]
}

Rules:
- Return exactly 8 lessons, each about 10 minutes.
- Build a dependency chain; later lessons must use earlier ideas.
- Optimize for THIS learner's goal and success metric.
- EVERY lesson must have one primary interactive lab, but the lab does NOT have to appear first. The lesson should unfold in small steps: concise explanation, prediction/question when useful, interactive exploration at the right moment, then interpretation and transfer.
- The lab must feel like a tiny real situation, toy, simulation, instrument, or game—not a generic dashboard and not a pair of arbitrary sliders.
- Prefer familiar concrete worlds before symbols.
- Give the lab one obvious primary action. At most one secondary control unless the concept truly requires more.
- Design the learnerTask so interaction reveals something that is difficult to learn from prose alone.
- Examples:
  * expected value / casino probability → a roulette wheel or repeated wager simulator with a Spin button, visible wins/losses, balance, and running average so the learner sees short-run randomness and long-run house edge;
  * derivatives → drag a point along a curve and watch the tangent slope change;
  * supply and demand → move one market condition and watch price/quantity settle;
  * neural networks → change one weight and watch a tiny classifier boundary move;
  * molecular biology → toggle a regulator and watch downstream expression change;
  * music theory → playable keys/chords where changing one note changes the harmony;
  * orbital mechanics → launch an object and adjust one initial condition to see the orbit change.
- Do not force every subject into charts.
- The visualBrief is secondary; use it only when a static picture adds something the lab cannot.
- Do not prescribe a chatbot-style conversation. Design the lesson as a sequence of clean instructional steps.
- The final lesson must directly test the learner's stated success metric.
- Do NOT generate HTML or JavaScript here; the lab is generated lazily when the lesson reaches it.`;
}

function extractJson(text) {
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("Gemini did not return a JSON object");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function stringArray(value, fallback) {
  const values = Array.isArray(value) ? value.map((x) => String(x).trim()).filter(Boolean) : [];
  return values.length ? values.slice(0, 5) : fallback;
}

function normalizeCourse(raw, input) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.lessons)) {
    throw new Error("Gemini returned an invalid course shape");
  }

  const lessons = raw.lessons.slice(0, 8).map((lesson, index) => ({
    title: String(lesson?.title || `${index + 1}. Lesson ${index + 1}`),
    durationMinutes: 10,
    objective: String(lesson?.objective || `Understand the next part of ${input.topic}.`),
    whyItMatters: String(lesson?.whyItMatters || `This connects ${input.topic} to your goal.`),
    explanation: String(lesson?.explanation || "Build the intuition in a small step, then test it interactively."),
    keyIdeas: stringArray(lesson?.keyIdeas, [
      `Identify the mechanism behind this part of ${input.topic}.`,
      "Predict how the system changes.",
      "Explain the result in plain language.",
    ]),
    visualBrief: String(lesson?.visualBrief || `A minimal supporting diagram for this ${input.topic} lesson.`),
    labBrief: {
      title: String(lesson?.labBrief?.title || "Interactive experiment"),
      concept: String(lesson?.labBrief?.concept || lesson?.objective || `A core ${input.topic} relationship.`),
      scene: String(lesson?.labBrief?.scene || `A concrete miniature world that makes this ${input.topic} concept tangible.`),
      purpose: String(lesson?.labBrief?.purpose || "Discover the lesson's central relationship by interacting."),
      interaction: String(lesson?.labBrief?.interaction || "One obvious action with an immediate visible consequence."),
      learnerTask: String(lesson?.labBrief?.learnerTask || "Try the main action several times and notice the pattern."),
      checkpoint: String(lesson?.labBrief?.checkpoint || "After a meaningful experiment, report a concise checkpoint so the next teaching step can react."),
    },
    tutorSeed: {
      openingQuestion: String(lesson?.tutorSeed?.openingQuestion || "Start with a concise setup, ask a prediction when useful, and reveal the lab when it will clarify the idea."),
      masteryCriteria: stringArray(lesson?.tutorSeed?.masteryCriteria, [
        "Explains the mechanism",
        "Can make a correct prediction",
        "Can transfer the idea to a new example",
      ]),
    },
  }));

  if (lessons.length < 6) throw new Error(`Gemini returned only ${lessons.length} lessons`);

  return {
    title: String(raw.title || input.topic),
    subtitle: String(raw.subtitle || "Learn one idea at a time, then make it move"),
    learnerGoal: String(raw.learnerGoal || input.why || `Understand ${input.topic}`),
    successMetric: String(raw.successMetric || input.success || `Use ${input.topic} independently`),
    lessons,
  };
}

function geminiErrorMessage(result) {
  try {
    const parsed = JSON.parse(result?.detail || "");
    const message = parsed?.error?.message;
    if (message) return `Gemini API ${result.status}: ${message}`;
  } catch {}
  return `Gemini API ${result?.status || "error"}: request failed`;
}

export async function handleCourseRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!input?.topic) return Response.json({ error: "topic is required" }, { status: 400 });

  const key = env?.GEMINI_API_KEY;
  if (!key) {
    return Response.json({ course: fallbackCourse(input), demo: true, demoReason: "GEMINI_API_KEY is not visible to the Worker." });
  }

  try {
    const generated = await generateGeminiText(key, buildPrompt(input), { label: "Course" });
    if (!generated.ok) {
      return Response.json({ course: fallbackCourse(input), demo: true, demoReason: geminiErrorMessage(generated) });
    }

    const raw = extractJson(generated.text);
    return Response.json({ course: normalizeCourse(raw, input), demo: false, model: generated.model });
  } catch (error) {
    console.error("Gemini course generation/parsing error", error);
    return Response.json({ course: fallbackCourse(input), demo: true, demoReason: `Generation failed: ${error?.message || "unknown error"}` });
  }
}
