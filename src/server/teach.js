import { generateGeminiText } from "./gemini";

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
  const firstTurn = transcript.length === 0;
  const task = lesson?.labBrief?.learnerTask || "Try the main action a few times and watch what changes.";
  const checkpoint = lesson?.labBrief?.checkpointQuestion || "What pattern did you notice?";
  const lastEvent = labEvents[labEvents.length - 1]?.summary;

  if (firstTurn) {
    return {
      action: "explain",
      reply: `Here’s the idea we’re going to discover: ${lesson?.objective || "how this system behaves"}. I’m going to give you a small interactive experiment. ${task} Don’t worry about formulas yet. When you’re done, I’ll ask: ${checkpoint}`,
      showLab: true,
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
      reply: `Your lab just reported: ${lastEvent} Based on that exact result, ${checkpoint}`,
      showLab: true,
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
      reply: `Let me teach it from the experiment instead of testing you. ${task} Focus on just one thing: what changes after each action. Then I’ll connect that observation to the idea in plain English.`,
      showLab: true,
      mastered: false,
      confidence: 0,
      pitfalls: ["Needed the idea rebuilt from the concrete experiment."],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  return {
    action: "question",
    reply: checkpoint,
    showLab: true,
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

  return `You are the live AI teacher inside Knowable. Every lesson has ONE primary interactive lab, but the lab is initially hidden until you orient the learner.

${learnerStatus}
${firstTurn ? `THIS IS THE FIRST TURN. The lab is NOT visible yet. First explain, in plain language, what single idea the learner is about to discover, what exact action they should take in the lab, what ONE thing to watch, and the specific question you will ask afterward. Do not quiz them yet. End by inviting them to try the lab.` : "The learner has now seen the lab. Teach from what they actually did."}

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

RECENT LAB EVENTS
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
- On the first turn, ORIENT BEFORE TESTING: explain the point of the lab, give one exact instruction, say what to watch, and preview one specific question.
- After the first turn, the lab is the shared concrete object of the lesson.
- When lab events are present, reference the learner's actual result and ask a SPECIFIC question about it. Avoid vague prompts like "what do you think?".
- Good questions name the observed quantities or choices: "Your balance fell from $100 to $90 after five spins. Does that prove the long-run average is -$2 per spin? Why or why not?"
- If the learner says "I don't know" or is confused, TEACH. Do not respond with another test question.
- Never call "I don't know" a good answer or a good start.
- Teach one small idea at a time. Start concrete; introduce the formal rule only after the pattern is visible.
- Keep replies under 100 words, usually under 70.
- Ask at most ONE question.
- Never dump jargon. No LaTeX delimiters. Explain symbols before using them.
- Diagnose misconceptions rather than merely marking answers wrong.
- You may request a small supporting visual only if the primary lab cannot show a needed static structure. Never request a second lab.
- Before mastery, get evidence that the learner can explain the mechanism AND predict or transfer it to a new case.
- Track only pitfalls the learner actually showed.

Return ONLY valid JSON:
{
  "action": "explain | question | visual | mastered",
  "reply": "short next tutor message",
  "showLab": true,
  "mastered": false,
  "confidence": 0.0,
  "pitfalls": ["specific observed misconception"],
  "coveredConcepts": ["specific concept demonstrated"],
  "artifactBrief": null
}

On the first successful turn set showLab=true so the UI reveals the lab immediately after your orientation. On later turns keep showLab=true.

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
    const generated = await generateGeminiText(
      key,
      buildPrompt({ ...input, transcript, labEvents }),
      { label: "Teaching" },
    );

    if (!generated.ok) {
      console.warn("Teaching: both Gemini models unavailable; using deterministic teaching fallback");
      return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents }));
    }

    let raw;
    try {
      raw = extractJson(generated.text);
    } catch (error) {
      console.error("Teaching JSON parse failure", generated.model, generated.text);
      return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents }));
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
      reply: String(raw?.reply || "I’ll walk you through the experiment one step at a time."),
      showLab: raw?.showLab !== false,
      mastered: canMaster,
      confidence,
      pitfalls: uniqueStrings(raw?.pitfalls),
      coveredConcepts: uniqueStrings(raw?.coveredConcepts),
      artifactBrief,
      model: generated.model,
    });
  } catch (error) {
    console.error("Teaching loop error", error);
    return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents }));
  }
}
