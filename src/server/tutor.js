function extractJson(text) {
  if (typeof text !== "string") throw new Error("Tutor returned no text");
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("Tutor did not return JSON");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function fallbackTutor({ lesson, transcript }) {
  const userTurns = transcript.filter((message) => message.role === "user");
  if (userTurns.length < 2) {
    return {
      reply:
        userTurns.length === 0
          ? lesson?.tutorSeed?.openingQuestion || "Explain the idea in your own words."
          : "Good start. Now make a prediction: if you changed the most important variable in the lab, what would happen, and why?",
      mastered: false,
      confidence: 0.45,
      missing: ["Show the mechanism and make a prediction."],
    };
  }

  const substantial = userTurns.filter((message) => String(message.content || "").trim().length >= 25).length;
  return {
    reply:
      substantial >= 2
        ? "That explanation connects the mechanism to a prediction. You're ready to continue."
        : "You're close. Give me one concrete example that uses the idea rather than just naming it.",
    mastered: substantial >= 2,
    confidence: substantial >= 2 ? 0.84 : 0.55,
    missing: substantial >= 2 ? [] : ["Apply the idea to a concrete example."],
  };
}

function buildPrompt({ lesson, transcript, learnerGoal, successMetric }) {
  return `You are Knowable's Socratic mastery tutor. You are evaluating ONE lesson.

Learner goal: ${learnerGoal || ""}
Course success metric: ${successMetric || ""}

Lesson:
${JSON.stringify(
  {
    title: lesson?.title,
    objective: lesson?.objective,
    explanation: lesson?.explanation,
    keyIdeas: lesson?.keyIdeas,
    labBrief: lesson?.labBrief,
    masteryCriteria: lesson?.tutorSeed?.masteryCriteria,
  },
  null,
  2,
)}

Conversation so far:
${JSON.stringify(transcript, null, 2)}

Return ONLY valid JSON:
{
  "reply": "your next short tutor response",
  "mastered": false,
  "confidence": 0.0,
  "missing": ["specific idea still missing"]
}

Evaluation rules:
- Be demanding but not pedantic.
- Do not unlock based on confidence, agreement, or vocabulary alone.
- Look for evidence that the learner can explain the mechanism, make a prediction, and transfer the idea.
- Ask ONE question at a time when evidence is incomplete.
- If the learner is wrong, identify the exact misconception without giving a lecture.
- If they are partially right, acknowledge the correct part and probe the missing part.
- mastered=true only when there is enough evidence to move on.
- confidence is 0 to 1 and should reflect your confidence in the mastery judgment.
- Keep reply under 80 words.
- missing should be empty when mastered=true.`;
}

export async function handleTutorRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  const lesson = input?.lesson;
  const transcript = Array.isArray(input?.transcript) ? input.transcript.slice(-12) : [];
  if (!lesson) return Response.json({ error: "lesson is required" }, { status: 400 });

  const userTurns = transcript.filter((message) => message.role === "user").length;
  const key = env?.GEMINI_API_KEY;

  if (!key) {
    const fallback = fallbackTutor({ lesson, transcript });
    return Response.json({
      ...fallback,
      unlocked: fallback.mastered && userTurns >= 2,
      demo: true,
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
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildPrompt({
                    lesson,
                    transcript,
                    learnerGoal: input?.learnerGoal,
                    successMetric: input?.successMetric,
                  }),
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini tutor error", response.status, detail);
      const fallback = fallbackTutor({ lesson, transcript });
      return Response.json({
        ...fallback,
        unlocked: fallback.mastered && userTurns >= 2,
        demo: true,
      });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("")
      .trim();
    const parsed = extractJson(text);

    const confidence = Math.max(0, Math.min(1, Number(parsed?.confidence) || 0));
    const mastered = Boolean(parsed?.mastered);
    const unlocked = mastered && confidence >= 0.78 && userTurns >= 2;

    return Response.json({
      reply: String(
        parsed?.reply ||
          (unlocked
            ? "You have enough of the idea to continue."
            : "Explain the mechanism one more time in your own words."),
      ),
      mastered,
      confidence,
      unlocked,
      missing: Array.isArray(parsed?.missing) ? parsed.missing.map(String).slice(0, 4) : [],
      demo: false,
    });
  } catch (error) {
    console.error("Gemini tutor generation/parsing error", error);
    const fallback = fallbackTutor({ lesson, transcript });
    return Response.json({
      ...fallback,
      unlocked: fallback.mastered && userTurns >= 2,
      demo: true,
    });
  }
}
