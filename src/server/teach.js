const ACTIONS = new Set(["explain", "question", "visual", "lab", "mastered"]);

function extractJson(text) {
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Gemini did not return JSON");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function uniqueStrings(values, limit = 12) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
}

function fallbackTurn({ lesson, transcript = [] }) {
  const userTurns = transcript.filter((message) => message.role === "user").length;
  if (userTurns === 0) {
    return {
      action: "question",
      reply: `We’ll build ${String(lesson?.title || "this idea").replace(/^\d+\.\s*/, "")} from something concrete. Before I explain it: what do you already think this idea means, even if you’re unsure?`,
      mastered: false,
      confidence: 0,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
    };
  }
  return {
    action: "question",
    reply: "Good start. Now give me one concrete example and tell me what you expect to happen. I want to see the idea in your own mental model, not a memorized definition.",
    mastered: false,
    confidence: 0.25,
    pitfalls: [],
    coveredConcepts: [],
    artifactBrief: null,
  };
}

function buildPrompt({ lesson, course, transcript, state }) {
  return `You are the live teacher inside Knowable. You are not writing a textbook page. You are having an adaptive one-on-one teaching conversation.

COURSE GOAL
${course?.learnerGoal || "Understand the subject deeply."}

SUCCESS METRIC
${course?.successMetric || "Use the subject independently."}

CURRENT LESSON
${JSON.stringify({
    title: lesson?.title,
    objective: lesson?.objective,
    keyIdeas: lesson?.keyIdeas,
    tutorSeed: lesson?.tutorSeed,
    labBrief: lesson?.labBrief,
    visualBrief: lesson?.visualBrief,
  }, null, 2)}

KNOWN SESSION STATE
${JSON.stringify({
    pitfalls: state?.pitfalls || [],
    coveredConcepts: state?.coveredConcepts || [],
  }, null, 2)}

CONVERSATION
${JSON.stringify(transcript || [], null, 2)}

Your job is to choose the single best NEXT teaching move.

Teaching rules:
- Teach one small idea at a time.
- Start concrete and intuitive. Use examples before abstraction.
- Never dump a paragraph of jargon.
- Keep your reply under 90 words, usually under 60.
- Ask at most ONE question in a reply.
- Do not use LaTeX delimiters such as $...$, \\(...\\), or \\[...\\]. The UI does not render them.
- Do not introduce symbols until you have explained what each symbol means in plain English.
- If the learner gives a nonsense answer, misconception, or partial answer, diagnose it gently and teach from there.
- Do not merely say an answer is wrong. Find the mistaken mental model.
- Use a visual when spatial structure, flow, comparison, geometry, or a process would become clearer by seeing it.
- Use a lab when changing a variable and observing the result would genuinely teach the idea.
- A lab must target ONE idea, not become a mini-dashboard.
- Do not force a visual or lab every turn.
- Before declaring mastery, get evidence that the learner can explain the idea and predict or transfer it to a new example.
- Mastery should feel earned, not bureaucratic.
- Track specific learner pitfalls that actually appeared in this conversation. These will go into their lesson notes.

Return ONLY valid JSON with this shape:
{
  "action": "explain | question | visual | lab | mastered",
  "reply": "the next short tutor message",
  "mastered": false,
  "confidence": 0.0,
  "pitfalls": ["specific misconception the learner showed"],
  "coveredConcepts": ["specific concept now demonstrated"],
  "artifactBrief": null
}

If action is visual or lab, artifactBrief must instead be:
{
  "kind": "visual" or "lab",
  "title": "short human title",
  "concept": "the single concept the artifact should teach",
  "purpose": "why this artifact helps right now",
  "task": "one short thing the learner should notice or try"
}

If action is mastered, make reply a concise, specific statement of what the learner demonstrated. Set mastered=true and confidence between 0 and 1.`;
}

export async function handleTeachRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!input?.lesson) return Response.json({ error: "lesson is required" }, { status: 400 });

  const transcript = Array.isArray(input.transcript)
    ? input.transcript
        .filter((message) => message && (message.role === "user" || message.role === "assistant"))
        .map((message) => ({ role: message.role, content: String(message.content || "").slice(0, 4000) }))
        .slice(-24)
    : [];

  const key = env?.GEMINI_API_KEY;
  if (!key) return Response.json(fallbackTurn({ lesson: input.lesson, transcript }));

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt({ ...input, transcript }) }] }],
        }),
      },
    );

    if (!response.ok) {
      console.error("Teaching model error", response.status, await response.text());
      return Response.json(fallbackTurn({ lesson: input.lesson, transcript }));
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
    const raw = extractJson(text);
    const userTurns = transcript.filter((message) => message.role === "user").length;
    const confidence = Math.max(0, Math.min(1, Number(raw?.confidence || 0)));
    const canMaster = Boolean(raw?.mastered) && confidence >= 0.82 && userTurns >= 2;
    const requestedAction = ACTIONS.has(raw?.action) ? raw.action : "question";
    const action = canMaster ? "mastered" : requestedAction === "mastered" ? "question" : requestedAction;

    let artifactBrief = null;
    if ((action === "visual" || action === "lab") && raw?.artifactBrief) {
      artifactBrief = {
        kind: action,
        title: String(raw.artifactBrief.title || (action === "lab" ? "Try it" : "See it")),
        concept: String(raw.artifactBrief.concept || input.lesson?.objective || "current concept"),
        purpose: String(raw.artifactBrief.purpose || "Make the current idea concrete."),
        task: String(raw.artifactBrief.task || "Change one thing and notice what happens."),
      };
    }

    return Response.json({
      action,
      reply: String(raw?.reply || "Tell me what you think is happening here, in your own words."),
      mastered: canMaster,
      confidence,
      pitfalls: uniqueStrings(raw?.pitfalls),
      coveredConcepts: uniqueStrings(raw?.coveredConcepts),
      artifactBrief,
    });
  } catch (error) {
    console.error("Teaching loop error", error);
    return Response.json(fallbackTurn({ lesson: input.lesson, transcript }));
  }
}
