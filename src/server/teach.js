const ACTIONS = new Set(["explain", "question", "visual", "mastered"]);

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

function normalizeLabEvents(events) {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => ({
      event: String(event?.event || "action").slice(0, 80),
      summary: String(event?.summary || "").slice(0, 500),
    }))
    .filter((event) => event.summary)
    .slice(-12);
}

function demoTurn({ lesson, transcript = [], labEvents = [] }) {
  const userTurns = transcript.filter((message) => message.role === "user").length;
  const task = lesson?.labBrief?.learnerTask || "Try the main action in the lab a few times and notice what changes.";
  const lastEvent = labEvents[labEvents.length - 1]?.summary;

  if (userTurns === 0 && !lastEvent) {
    return {
      action: "explain",
      reply: `Start with the lab, not a definition. ${task} Don’t calculate anything yet—just notice what the system actually does.`,
      mastered: false,
      confidence: 0,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (lastEvent) {
    return {
      action: "question",
      reply: `You just got this result: ${lastEvent} What pattern do you think that is starting to show?`,
      mastered: false,
      confidence: 0.2,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (learnerIsLost(transcript)) {
    return {
      action: "explain",
      reply: `No problem—don’t solve it yet. Use the lab as the example. ${task} I’m looking for what changes over repeated tries, not a formula.`,
      mastered: false,
      confidence: 0,
      pitfalls: ["Needed the concept rebuilt from the concrete lab."],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  return {
    action: "question",
    reply: "What did the lab make you notice that you would not have noticed from a definition alone?",
    mastered: false,
    confidence: 0.2,
    pitfalls: [],
    coveredConcepts: [],
    artifactBrief: null,
    demo: true,
  };
}

function buildPrompt({ lesson, course, transcript, state, labEvents }) {
  const needsTeaching = learnerIsLost(transcript);
  const firstTurn = !transcript?.length;
  const recentLabEvents = normalizeLabEvents(labEvents);
  const learnerStatus = needsTeaching
    ? "The learner explicitly said they do not know, are confused, lost, or need help. Teach the missing idea before testing them again."
    : "Adapt from what the learner has actually said and done.";

  return `You are the live AI teacher inside Knowable. The INTERACTIVE LAB already visible on the page is the centerpiece of this lesson. You are the guide around it.

${learnerStatus}
${firstTurn ? "THIS IS THE FIRST TURN. Do not ask for a definition. Direct the learner to one specific action in the lab and tell them what to watch for." : ""}

COURSE GOAL
${course?.learnerGoal || "Understand the subject deeply."}

SUCCESS METRIC
${course?.successMetric || "Use the subject independently."}

CURRENT LESSON
${JSON.stringify({
    title: lesson?.title,
    objective: lesson?.objective,
    keyIdeas: lesson?.keyIdeas,
    labBrief: lesson?.labBrief,
    tutorSeed: lesson?.tutorSeed,
  }, null, 2)}

RECENT LAB EVENTS REPORTED BY THE INTERACTIVE EXPERIENCE
${JSON.stringify(recentLabEvents, null, 2)}

KNOWN SESSION STATE
${JSON.stringify({
    pitfalls: state?.pitfalls || [],
    coveredConcepts: state?.coveredConcepts || [],
  }, null, 2)}

CONVERSATION
${JSON.stringify(transcript || [], null, 2)}

Choose the single best NEXT teaching move.

Teaching rules:
- The lab is primary. Use it as the shared concrete object of the conversation.
- On the first turn, direct ONE specific lab action. Do not open with an abstract question.
- When lab events are present, refer to the learner's actual result. Do not act as if you cannot see it.
- If the learner says "I don't know", "I'm confused", or lacks prerequisites, TEACH. Do not respond with another test question.
- Never call "I don't know" a good answer or a good start.
- Teach one small idea at a time.
- Start concrete. Only introduce the formal rule after the learner has seen the pattern.
- Keep replies under 90 words, usually under 60.
- Ask at most ONE question.
- Never dump a paragraph of jargon.
- No LaTeX delimiters. Use normal prose and simple inline arithmetic.
- Explain every symbol before using it.
- Diagnose misconceptions rather than just marking answers wrong.
- You may request a small supporting visual only if the primary lab cannot show a needed static structure. Do not request a second lab.
- Before mastery, get evidence that the learner can explain the mechanism AND predict/transfer it to a new case.
- Track only pitfalls the learner actually showed.

Return ONLY valid JSON:
{
  "action": "explain | question | visual | mastered",
  "reply": "short next tutor message",
  "mastered": false,
  "confidence": 0.0,
  "pitfalls": ["specific observed misconception"],
  "coveredConcepts": ["specific concept demonstrated"],
  "artifactBrief": null
}

If action is visual, artifactBrief is:
{
  "kind": "visual",
  "title": "short title",
  "concept": "one static structure to show",
  "purpose": "why the lab alone is not enough",
  "task": "one thing to notice"
}

If action is mastered, set mastered=true and confidence between 0 and 1, and state specifically what the learner demonstrated.`;
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
  const labEvents = normalizeLabEvents(input.labEvents);

  const key = env?.GEMINI_API_KEY;
  if (!key) return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents }));

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt({ ...input, transcript, labEvents }) }] }],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      console.error("Teaching model error", response.status, detail);
      return Response.json({ error: "The AI tutor did not answer. Retry this turn.", code: `gemini_${response.status}` }, { status: 502 });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
    let raw;
    try {
      raw = extractJson(text);
    } catch (error) {
      console.error("Teaching JSON parse failure", text);
      throw error;
    }

    const userTurns = transcript.filter((message) => message.role === "user").length;
    const confidence = Math.max(0, Math.min(1, Number(raw?.confidence || 0)));
    const canMaster = Boolean(raw?.mastered) && confidence >= 0.82 && userTurns >= 2;
    const requestedAction = ACTIONS.has(raw?.action) ? raw.action : "explain";
    const action = canMaster ? "mastered" : requestedAction === "mastered" ? "question" : requestedAction;

    let artifactBrief = null;
    if (action === "visual" && raw?.artifactBrief) {
      artifactBrief = {
        kind: "visual",
        title: String(raw.artifactBrief.title || "See it"),
        concept: String(raw.artifactBrief.concept || input.lesson?.objective || "current concept"),
        purpose: String(raw.artifactBrief.purpose || "Make one structure visible."),
        task: String(raw.artifactBrief.task || "Notice the relationship."),
      };
    }

    return Response.json({
      action,
      reply: String(raw?.reply || "Let me explain that another way using the lab."),
      mastered: canMaster,
      confidence,
      pitfalls: uniqueStrings(raw?.pitfalls),
      coveredConcepts: uniqueStrings(raw?.coveredConcepts),
      artifactBrief,
    });
  } catch (error) {
    console.error("Teaching loop error", error);
    return Response.json({ error: "The AI tutor response could not be read. Retry this turn.", code: "tutor_parse_error" }, { status: 502 });
  }
}
