const COURSE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    learnerGoal: { type: "string" },
    successMetric: { type: "string" },
    lessons: {
      type: "array",
      minItems: 8,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          durationMinutes: { type: "integer" },
          objective: { type: "string" },
          whyItMatters: { type: "string" },
          explanation: { type: "string" },
          challenge: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 },
              answerIndex: { type: "integer" },
              explanation: { type: "string" },
            },
            required: ["question", "options", "answerIndex", "explanation"],
          },
          lab: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["curve", "probability", "vector", "projectile"] },
              title: { type: "string" },
              instruction: { type: "string" },
              functionType: { type: "string", enum: ["linear", "quadratic", "exponential", "logistic", "sine"] },
              param1Label: { type: "string" },
              param1Min: { type: "number" },
              param1Max: { type: "number" },
              param1Default: { type: "number" },
              param1Step: { type: "number" },
              param2Label: { type: "string" },
              param2Min: { type: "number" },
              param2Max: { type: "number" },
              param2Default: { type: "number" },
              param2Step: { type: "number" },
              xLabel: { type: "string" },
              yLabel: { type: "string" },
              prediction: { type: "string" },
            },
            required: [
              "kind", "title", "instruction", "functionType",
              "param1Label", "param1Min", "param1Max", "param1Default", "param1Step",
              "param2Label", "param2Min", "param2Max", "param2Default", "param2Step",
              "xLabel", "yLabel", "prediction",
            ],
          },
        },
        required: ["title", "durationMinutes", "objective", "whyItMatters", "explanation", "challenge", "lab"],
      },
    },
  },
  required: ["title", "subtitle", "learnerGoal", "successMetric", "lessons"],
};

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
      explanation: `Start with a simple model. Change one assumption at a time, predict what should happen, then compare your prediction with the visualization. ${background ? `We will assume this starting point: ${background}.` : "No prior knowledge is required."} The point is to make the relationship feel inevitable before adding notation or detail.`,
      challenge: {
        question: "What is the best next move when a variable changes in the model?",
        options: ["Predict the direction first", "Memorize a formula", "Ignore the change"],
        answerIndex: 0,
        explanation: "Prediction forces you to expose your mental model before the visualization gives you the answer.",
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
  return `You are the curriculum engine for Knowable, an open-source interactive learning product designed to be more adaptive and hands-on than a fixed paid course.

Design a short personalized course about: ${input.topic}
Why the learner wants it: ${input.why || "not specified"}
How they will measure success: ${input.success || "not specified"}
What they already know: ${input.background || "not specified"}

Rules:
- Return 8-10 lessons. Every lesson is exactly 10 minutes.
- Lessons must form a dependency chain: each lesson should use something learned earlier.
- Optimize the sequence for THIS learner's motivation and success metric, not for a generic textbook.
- Teach through prediction, manipulation, feedback, and transfer, not long exposition.
- Keep each explanation under 120 words and intuitive.
- Every lesson gets one multiple-choice conceptual check and one interactive lab.
- Labs are AI-authored specs rendered by a trusted UI. Pick the closest lab primitive:
  * curve: relationships, growth, economics, functions, biology, scaling
  * probability: uncertainty, sampling, frequencies, Bayesian intuition
  * vector: geometry, forces, components, embeddings
  * projectile: motion, optimization, trajectories
- The lab parameters should be pedagogically meaningful for the lesson.
- functionType is only used by curve labs; choose linear/quadratic/exponential/logistic/sine.
- For other lab kinds, still fill every schema field with sensible values.
- answerIndex is zero-based.
- End with a lesson that directly tests the learner's stated success metric.`;
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
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": key,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
          generationConfig: {
            temperature: 0.75,
            responseMimeType: "application/json",
            responseSchema: COURSE_SCHEMA,
          },
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
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no course JSON");
    const course = JSON.parse(text);
    return Response.json({ course, demo: false });
  } catch (error) {
    console.error(error);
    return Response.json({
      course: fallbackCourse(input),
      demo: true,
      demoReason: `Generation failed: ${error?.message || "unknown error"}`,
    });
  }
}
