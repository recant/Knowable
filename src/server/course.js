const LAB_KINDS = new Set(["curve", "probability", "vector", "projectile"]);
const FUNCTION_TYPES = new Set(["linear", "quadratic", "exponential", "logistic", "sine"]);

function fallbackCourse({ topic, why, success, background }) {
  const names = [
    "Build the mental model",
    "See the moving parts",
    "Change one variable",
    "Predict before calculating",
    "Connect representations",
    "Find the edge cases",
    "Combine the ideas",
    "Solve a realistic problem",
    "Prove you can use it",
  ];
  const kinds = ["curve", "curve", "probability", "vector", "curve", "projectile", "curve", "probability", "curve"];
  const functions = ["linear", "quadratic", "linear", "linear", "exponential", "linear", "logistic", "linear", "sine"];

  return {
    title: topic,
    subtitle: "A personalized path from intuition to practical mastery",
    learnerGoal: why || `Understand ${topic} well enough to use it`,
    successMetric: success || `Solve a realistic ${topic} problem without outside help`,
    lessons: names.map((name, index) => ({
      title: `${index + 1}. ${name}`,
      durationMinutes: 10,
      objective: `Build one concrete piece of your ${topic} mental model and connect it to what came before.`,
      whyItMatters: `You said you want to learn ${topic}${why ? ` because ${why}` : ""}. This lesson turns that goal into something you can manipulate, not just memorize.`,
      explanation: `Start with a simple model. Change one assumption at a time, predict what should happen, then compare your prediction with the visualization. ${background ? `We will assume this starting point: ${background}.` : "No prior knowledge is required."}`,
      challenge: {
        question: "What is the best next move when a variable changes in the model?",
        options: ["Predict the direction first", "Memorize a formula", "Ignore the change"],
        answerIndex: 0,
        explanation: "Prediction exposes your mental model before the visualization gives you the answer.",
      },
      lab: {
        kind: kinds[index],
        title: "Play with the model",
        instruction: "Move the controls. Before each move, predict how the output should change.",
        functionType: functions[index],
        param1Label: index % 2 ? "strength" : "rate",
        param1Min: 0.2,
        param1Max: 3,
        param1Default: 1,
        param1Step: 0.1,
        param2Label: index % 2 ? "offset" : "starting value",
        param2Min: -2,
        param2Max: 4,
        param2Default: 1,
        param2Step: 0.1,
        xLabel: "input",
        yLabel: "output",
        prediction: "What do you expect to happen when you increase the first control?",
      },
    })),
  };
}

function buildPrompt(input) {
  return `You are the curriculum engine for Knowable, an interactive learning app.

Create a personalized course about: ${input.topic}
Why the learner wants it: ${input.why || "not specified"}
How they measure success: ${input.success || "not specified"}
What they already know: ${input.background || "not specified"}

IMPORTANT OUTPUT RULE: Return ONLY one valid JSON object. No markdown. No code fences. No commentary before or after it.

The JSON must have this exact overall shape:
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
      "explanation": "string under 120 words",
      "challenge": {
        "question": "string",
        "options": ["string", "string", "string"],
        "answerIndex": 0,
        "explanation": "string"
      },
      "lab": {
        "kind": "curve | probability | vector | projectile",
        "title": "string",
        "instruction": "string",
        "functionType": "linear | quadratic | exponential | logistic | sine",
        "param1Label": "string",
        "param1Min": 0,
        "param1Max": 3,
        "param1Default": 1,
        "param1Step": 0.1,
        "param2Label": "string",
        "param2Min": -2,
        "param2Max": 4,
        "param2Default": 1,
        "param2Step": 0.1,
        "xLabel": "string",
        "yLabel": "string",
        "prediction": "string"
      }
    }
  ]
}

Course rules:
- Return 8 to 10 lessons, each exactly 10 minutes.
- Make lessons a dependency chain; later lessons should use earlier ideas.
- Optimize specifically for the learner's stated reason and success metric.
- Teach through prediction, manipulation, feedback, and transfer rather than long exposition.
- Every lesson needs one conceptual multiple-choice check and one interactive lab.
- Use curve for relationships/growth/functions/biology/economics; probability for uncertainty/sampling; vector for geometry/forces/embeddings; projectile for trajectories/motion/optimization.
- For non-curve labs, still fill functionType and every numeric field with sensible values because the trusted renderer expects them.
- answerIndex is zero-based and must point to an existing option.
- The final lesson must directly test the learner's success metric.
- Do not generate JavaScript, HTML, or executable code. Only generate the JSON data object.`;
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

function number(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeLab(lab = {}) {
  const kind = LAB_KINDS.has(lab.kind) ? lab.kind : "curve";
  const functionType = FUNCTION_TYPES.has(lab.functionType) ? lab.functionType : "linear";
  const p1Min = number(lab.param1Min, 0.2);
  const p1Max = number(lab.param1Max, 3);
  const p2Min = number(lab.param2Min, -2);
  const p2Max = number(lab.param2Max, 4);
  return {
    kind,
    title: String(lab.title || "Explore the model"),
    instruction: String(lab.instruction || "Move the controls and observe what changes."),
    functionType,
    param1Label: String(lab.param1Label || "rate"),
    param1Min: Math.min(p1Min, p1Max),
    param1Max: Math.max(p1Min, p1Max),
    param1Default: number(lab.param1Default, 1),
    param1Step: Math.max(0.01, number(lab.param1Step, 0.1)),
    param2Label: String(lab.param2Label || "offset"),
    param2Min: Math.min(p2Min, p2Max),
    param2Max: Math.max(p2Min, p2Max),
    param2Default: number(lab.param2Default, 1),
    param2Step: Math.max(0.01, number(lab.param2Step, 0.1)),
    xLabel: String(lab.xLabel || "input"),
    yLabel: String(lab.yLabel || "output"),
    prediction: String(lab.prediction || "Predict what will change before moving the control."),
  };
}

function normalizeCourse(raw, input) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.lessons) || raw.lessons.length < 1) {
    throw new Error("Gemini returned an invalid course shape");
  }

  const lessons = raw.lessons.slice(0, 10).map((lesson, index) => {
    const options = Array.isArray(lesson?.challenge?.options)
      ? lesson.challenge.options.map(String).slice(0, 4)
      : [];
    while (options.length < 3) options.push(["It increases", "It decreases", "It depends"][options.length]);
    const requestedAnswer = Math.trunc(number(lesson?.challenge?.answerIndex, 0));
    const answerIndex = Math.max(0, Math.min(options.length - 1, requestedAnswer));

    return {
      title: String(lesson?.title || `${index + 1}. Lesson ${index + 1}`),
      durationMinutes: 10,
      objective: String(lesson?.objective || `Understand the next part of ${input.topic}.`),
      whyItMatters: String(lesson?.whyItMatters || `This connects ${input.topic} to your goal.`),
      explanation: String(lesson?.explanation || "Build the intuition by changing one thing at a time and predicting the result."),
      challenge: {
        question: String(lesson?.challenge?.question || "What should happen next?"),
        options,
        answerIndex,
        explanation: String(lesson?.challenge?.explanation || "Use the model you just built to justify the answer."),
      },
      lab: normalizeLab(lesson?.lab),
    };
  });

  if (lessons.length < 8) throw new Error(`Gemini returned only ${lessons.length} lessons`);

  return {
    title: String(raw.title || input.topic),
    subtitle: String(raw.subtitle || "A personalized path from intuition to practical mastery"),
    learnerGoal: String(raw.learnerGoal || input.why || `Understand ${input.topic}`),
    successMetric: String(raw.successMetric || input.success || `Use ${input.topic} independently`),
    lessons,
  };
}

function geminiErrorMessage(status, detail) {
  try {
    const parsed = JSON.parse(detail);
    const message = parsed?.error?.message;
    if (message) return `Gemini API ${status}: ${message}`;
  } catch {}
  return `Gemini API ${status}: request failed`;
}

export async function handleCourseRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!input?.topic) {
    return Response.json({ error: "topic is required" }, { status: 400 });
  }

  const key = env?.GEMINI_API_KEY;
  if (!key) {
    return Response.json({
      course: fallbackCourse(input),
      demo: true,
      demoReason: "GEMINI_API_KEY is not visible to the Worker.",
    });
  }

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      const message = geminiErrorMessage(response.status, detail);
      console.error("Gemini error", response.status, detail);
      return Response.json({
        course: fallbackCourse(input),
        demo: true,
        demoReason: message,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();
    const raw = extractJson(text);
    const course = normalizeCourse(raw, input);
    return Response.json({ course, demo: false });
  } catch (error) {
    console.error("Gemini generation/parsing error", error);
    return Response.json({
      course: fallbackCourse(input),
      demo: true,
      demoReason: `Generation failed: ${error?.message || "unknown error"}`,
    });
  }
}
