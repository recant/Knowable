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
    subtitle: "A personalized path from intuition to practical mastery",
    learnerGoal: why || `Understand ${topic} well enough to use it`,
    successMetric: success || `Use ${topic} confidently without outside help`,
    lessons: names.map((name, index) => ({
      title: `${index + 1}. ${name}`,
      durationMinutes: 10,
      objective: `Build one concrete piece of your ${topic} mental model and connect it to what came before.`,
      whyItMatters: `This lesson is here because your goal is: ${why || `understand ${topic}`}.`,
      explanation: `Start from an intuitive model, manipulate it, and explain what changed. ${background ? `Build from what you already know: ${background}.` : "No prior knowledge is assumed."}`,
      keyIdeas: [
        `Identify the mechanism behind this part of ${topic}.`,
        "Predict what will change before you manipulate the model.",
        "Explain the result in plain language.",
      ],
      visualBrief: `Create a clean visual explanation that makes the core relationship in lesson ${index + 1} of ${topic} immediately legible.`,
      labBrief: {
        title: `Explore ${topic}`,
        purpose: `Make the central idea of this lesson tangible through direct manipulation.`,
        interaction: "Choose the most useful interaction for this concept: dragging, toggles, simulation, construction, annotation, matching, timeline, spatial manipulation, or another appropriate mechanic.",
      },
      tutorSeed: {
        openingQuestion: `Explain the main idea of this lesson in your own words. What is actually happening?`,
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
  return `You are the curriculum designer for Knowable, a premium interactive learning product.

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
      "explanation": "string, 80-150 words",
      "keyIdeas": ["string", "string", "string"],
      "visualBrief": "specific description of the diagram/illustration that would make this lesson click",
      "labBrief": {
        "title": "string",
        "purpose": "what the learner should discover by interacting",
        "interaction": "the best interaction design for this exact concept"
      },
      "tutorSeed": {
        "openingQuestion": "an open-ended question that tests understanding",
        "masteryCriteria": ["criterion", "criterion", "criterion"]
      }
    }
  ]
}

Rules:
- Return exactly 8 lessons, each about 10 minutes.
- Build a dependency chain; later lessons must use earlier ideas.
- Optimize for THIS learner's goal and success metric.
- Prefer visual intuition, manipulation, prediction, and transfer over exposition.
- Do not force every subject into charts. The labBrief can describe ANY browser-based interactive lab that would teach the concept best.
- Examples of valid labs: draggable tangent explorer, molecule builder, orbit simulator, supply/demand market, neural-network playground, timeline, circuit builder, grammar parser, anatomy labeling, algorithm visualizer, music keyboard, probability experiment, map, matching exercise, or something novel.
- The visualBrief should describe a useful diagram, not decorative art.
- The tutor question must require explanation, prediction, or transfer rather than recall.
- The final lesson must directly test the learner's stated success metric.
- Do NOT generate HTML or JavaScript here; keep this course request compact. Labs are generated lazily when a lesson opens.`;
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
    explanation: String(
      lesson?.explanation ||
        "Build the intuition by changing one thing at a time, making a prediction, and explaining the result.",
    ),
    keyIdeas: stringArray(lesson?.keyIdeas, [
      `Identify the mechanism behind this part of ${input.topic}.`,
      "Predict how the system changes.",
      "Explain the result in plain language.",
    ]),
    visualBrief: String(
      lesson?.visualBrief ||
        `Create a clean explanatory diagram for the central relationship in this ${input.topic} lesson.`,
    ),
    labBrief: {
      title: String(lesson?.labBrief?.title || "Interactive exploration"),
      purpose: String(
        lesson?.labBrief?.purpose ||
          "Turn the lesson's core abstraction into something the learner can manipulate.",
      ),
      interaction: String(
        lesson?.labBrief?.interaction ||
          "Choose the interaction that makes the causal relationship easiest to discover.",
      ),
    },
    tutorSeed: {
      openingQuestion: String(
        lesson?.tutorSeed?.openingQuestion ||
          "Explain the central idea of this lesson in your own words. What is actually happening?",
      ),
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
      console.error("Gemini course error", response.status, detail);
      return Response.json({
        course: fallbackCourse(input),
        demo: true,
        demoReason: geminiErrorMessage(response.status, detail),
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();

    const raw = extractJson(text);
    return Response.json({ course: normalizeCourse(raw, input), demo: false });
  } catch (error) {
    console.error("Gemini course generation/parsing error", error);
    return Response.json({
      course: fallbackCourse(input),
      demo: true,
      demoReason: `Generation failed: ${error?.message || "unknown error"}`,
    });
  }
}
