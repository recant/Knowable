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

function lastUserText(transcript = []) {
  return [...transcript].reverse().find((message) => message.role === "user")?.content?.trim() || "";
}

function learnerIsLost(transcript = []) {
  const text = lastUserText(transcript).toLowerCase();
  if (!text) return false;
  return /\b(i\s*(?:do not|don't|dont)\s*know|no idea|i(?:'m| am)\s*(?:lost|confused|stuck)|i\s*suck\s*at|what does that mean|i don't understand|i dont understand|help me|teach me|explain it)\b/i.test(text);
}

function demoTurn({ lesson, transcript = [] }) {
  const userTurns = transcript.filter((message) => message.role === "user").length;
  const keyIdea = Array.isArray(lesson?.keyIdeas) && lesson.keyIdeas[0]
    ? String(lesson.keyIdeas[0])
    : String(lesson?.objective || "the core idea");

  if (userTurns === 0) {
    return {
      action: "explain",
      reply: `Let’s start from zero. The first thing to understand is: ${keyIdea} I’ll build it with a concrete example, then you can tell me what part still feels fuzzy.`,
      mastered: false,
      confidence: 0,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (learnerIsLost(transcript)) {
    return {
      action: "explain",
      reply: `That tells me I should explain, not test you. Start with this one idea: ${keyIdea} Forget the formal definition for now. I’d rather make that single idea intuitive first.`,
      mastered: false,
      confidence: 0,
      pitfalls: ["Needed the concept rebuilt from first principles."],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  return {
    action: "question",
    reply: "What changed in your mental model after that explanation? Say it casually; one sentence is enough.",
    mastered: false,
    confidence: 0.2,
    pitfalls: [],
    coveredConcepts: [],
    artifactBrief: null,
    demo: true,
  };
}

function buildPrompt({ lesson, course, transcript, state }) {
  const needsTeaching = learnerIsLost(transcript);
  const learnerStatus = needsTeaching
    ? `CRITICAL LEARNER STATE: The learner explicitly indicated that they do not know, are confused, lost, or need help. DO NOT test them again yet. Your next move MUST teach or demonstrate the missing idea. Do not ask them to invent an example, define the concept, or prove understanding until after you have taught it.`
    : "LEARNER STATE: Continue adapting from the conversation.";

  return `You are the live teacher inside Knowable. You are not writing a textbook page. You are having an adaptive one-on-one teaching conversation.

${learnerStatus}

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
- Teach before testing. If the learner says they do not know or are confused, explain first.
- Teach one small idea at a time.
- Start concrete and intuitive. Use a tiny example before abstraction.
- Never dump a paragraph of jargon.
- Keep your reply under 90 words, usually under 60.
- Ask at most ONE question in a reply.
- Do not praise an answer that did not demonstrate understanding. Never call "I don't know" a good start.
- Do not use LaTeX delimiters such as $...$, \\(...\\), or \\[...\\]. The UI does not render them.
- Do not introduce symbols until you have explained what each symbol means in plain English.
- If the learner gives a nonsense answer, misconception, or partial answer, diagnose it and teach from there.
- If the learner says they lack prerequisite knowledge, lower the level and supply the prerequisite instead of demanding it.
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
  if (!key) return Response.json(demoTurn({ lesson: input.lesson, transcript }));

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
      const detail = await response.text();
      console.error("Teaching model error", response.status, detail);
      return Response.json(
        { error: "The AI tutor did not answer. Retry this turn.", code: `gemini_${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
    const raw = extractJson(text);
    const userTurns = transcript.filter((message) => message.role === "user").length;
    const confidence = Math.max(0, Math.min(1, Number(raw?.confidence || 0)));
    const canMaster = Boolean(raw?.mastered) && confidence >= 0.82 && userTurns >= 2;
    const requestedAction = ACTIONS.has(raw?.action) ? raw.action : "explain";
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
      reply: String(raw?.reply || "Let me explain that another way."),
      mastered: canMaster,
      confidence,
      pitfalls: uniqueStrings(raw?.pitfalls),
      coveredConcepts: uniqueStrings(raw?.coveredConcepts),
      artifactBrief,
    });
  } catch (error) {
    console.error("Teaching loop error", error);
    return Response.json(
      { error: "The AI tutor response could not be read. Retry this turn.", code: "tutor_parse_error" },
      { status: 502 },
    );
  }
}
