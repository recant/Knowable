import { generateGeminiText } from "./gemini";

const ACTIONS = new Set(["explain", "question", "lab", "visual", "mastered"]);

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
  return /\b(i\s*(?:do not|don't|dont)\s*know|no idea|i(?:'m| am)\s*(?:lost|confused|stuck)|what does that mean|i don't understand|i dont understand|help me|teach me|explain it|not sure)\b/i.test(text);
}

function isContinue(text) {
  return /^continue\.?$/i.test(String(text || "").trim());
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

function demoTurn({ lesson, transcript = [], labEvents = [], state = {} }) {
  const firstTurn = transcript.length === 0;
  const task = lesson?.labBrief?.learnerTask || "Try the main action and watch what changes.";
  const latestEvent = labEvents[labEvents.length - 1]?.summary;
  const labVisible = Boolean(state?.showLab || labEvents.length);
  const meaningfulAnswers = transcript.filter((message) => message.role === "user" && !isContinue(message.content));

  if (firstTurn) {
    return {
      action: "explain",
      reply: `Start with one idea: ${lesson?.objective || "this system changes for a reason"}. Look for the cause-and-effect relationship rather than memorizing a rule. You’ll test that relationship in a moment.`,
      showLab: false,
      mastered: false,
      confidence: 0,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (latestEvent) {
    return {
      action: "question",
      reply: `The experiment reported: ${latestEvent} What does that result tell you about the relationship this lesson is trying to show?`,
      showLab: true,
      mastered: false,
      confidence: 0.35,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (learnerIsLost(transcript)) {
    return {
      action: "explain",
      reply: `Focus on just one relationship. ${task} Ignore the formal rule for now; watch what changes when you take the main action, and use that observation as your starting point.`,
      showLab: labVisible,
      mastered: false,
      confidence: 0,
      pitfalls: ["Needed the idea rebuilt from a concrete relationship."],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (!labVisible && meaningfulAnswers.length === 0) {
    return {
      action: "question",
      reply: `Before you experiment, make a prediction: if the key input in this lesson changes, what do you expect the outcome to do, and why?`,
      showLab: false,
      mastered: false,
      confidence: 0.15,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  if (!labVisible) {
    return {
      action: "lab",
      reply: `Now test that prediction. ${task} Pay attention to the result that would confirm or contradict what you just said.`,
      showLab: true,
      mastered: false,
      confidence: 0.25,
      pitfalls: [],
      coveredConcepts: [],
      artifactBrief: null,
      demo: true,
    };
  }

  return {
    action: "question",
    reply: "Use the experiment to explain the mechanism in your own words. What changed, what caused it, and what would you predict in a new case?",
    showLab: true,
    mastered: false,
    confidence: 0.45,
    pitfalls: [],
    coveredConcepts: [],
    artifactBrief: null,
    demo: true,
  };
}

function buildPrompt({ lesson, course, transcript, state, labEvents }) {
  const firstTurn = !transcript?.length;
  const needsTeaching = learnerIsLost(transcript);
  const recentLabEvents = normalizeLabEvents(labEvents);
  const labVisible = Boolean(state?.showLab || recentLabEvents.length);
  const lastUser = lastUserText(transcript);

  return `You are the adaptive lesson engine inside Knowable. The learner must NEVER feel like they are chatting with a bot. The UI presents one clean learning step at a time, similar to a polished interactive course.

Your job is to choose exactly ONE next step.

AVAILABLE STEP TYPES
- explain: a short self-contained teaching block. The UI shows a Continue button.
- question: one focused question. The UI opens a small answer panel.
- lab: reveal the lesson's one primary interactive lab and tell the learner exactly what to try and notice.
- visual: show one supporting static visual only when it genuinely helps.
- mastered: finish the lesson only after the learner has demonstrated understanding.

CURRENT UI STATE
- First turn: ${firstTurn ? "yes" : "no"}
- Lab already visible: ${labVisible ? "yes" : "no"}
- Latest learner input: ${JSON.stringify(lastUser || "")}
- Learner appears confused: ${needsTeaching ? "yes" : "no"}

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

KNOWN LEARNER STATE
${JSON.stringify({
    pitfalls: state?.pitfalls || [],
    coveredConcepts: state?.coveredConcepts || [],
  }, null, 2)}

INTERNAL HISTORY
${JSON.stringify(transcript || [], null, 2)}

SEQUENCING RULES
- FIRST TURN MUST be action="explain" and showLab=false. Give a useful 45-90 word conceptual setup. Do not ask a question. Do not tell them to use the lab yet. Do not end with "what do you think?". The UI itself supplies Continue.
- A learner message exactly equal to "Continue." is an INTERNAL navigation event, not something to respond to conversationally. Use it as permission to advance to the next pedagogical step.
- Before revealing the lab, it is often useful to ask one prediction or diagnostic question. Do this when it improves learning, but do not mechanically ask one every time.
- Reveal the lab only at an opportune moment, with action="lab" and showLab=true. Give one exact action and one thing to watch.
- Once the lab has been revealed, keep showLab=true on all later steps so the learner can refer back to it.
- When a meaningful lab checkpoint exists, usually ask a specific question about the learner's ACTUAL observed result. Name the observed quantities or outcome.
- If the learner is confused or says they are not sure, use action="explain". Teach the missing link; do not immediately test them again.
- After an answer, give concise corrective teaching if needed, then either Continue into the next idea, ask a sharper question, or reveal/use the lab.
- Never mention being an AI, tutor, chatbot, conversation, message, transcript, or model.
- Never produce chatty filler such as "Great question", "Nice job", "You're on the right track", or "Let's dive in".
- Keep explanation steps under 110 words and questions under 55 words.
- Ask at most ONE question in a question step.
- Start concrete and causal; introduce formal terminology only after the learner has an intuition for it.
- Track only misconceptions actually demonstrated by the learner.
- Mastery requires evidence that the learner can explain the mechanism AND predict or transfer it to a new case.

Return ONLY valid JSON:
{
  "action": "explain | question | lab | visual | mastered",
  "reply": "the complete text for this one learning step",
  "showLab": false,
  "mastered": false,
  "confidence": 0.0,
  "pitfalls": ["specific observed misconception"],
  "coveredConcepts": ["specific concept demonstrated"],
  "artifactBrief": null
}

If action="lab", set showLab=true.
If the lab is already visible, keep showLab=true.
If action="visual", artifactBrief is:
{
  "kind": "visual",
  "title": "short title",
  "concept": "one static structure to show",
  "purpose": "why it helps here",
  "task": "one thing to notice"
}
If action="mastered", set mastered=true, confidence between 0 and 1, and make reply a concise statement of what the learner demonstrated.`;
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
        .slice(-28)
    : [];
  const labEvents = normalizeLabEvents(input.labEvents);
  const state = input.state || {};

  const key = env?.GEMINI_API_KEY;
  if (!key) return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents, state }));

  try {
    const generated = await generateGeminiText(
      key,
      buildPrompt({ ...input, transcript, labEvents, state }),
      { label: "Teaching" },
    );

    if (!generated.ok) {
      console.warn("Teaching: Gemini unavailable; using deterministic lesson fallback");
      return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents, state }));
    }

    let raw;
    try {
      raw = extractJson(generated.text);
    } catch (error) {
      console.error("Teaching JSON parse failure", generated.model, generated.text);
      return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents, state }));
    }

    const firstTurn = transcript.length === 0;
    const meaningfulUserTurns = transcript.filter(
      (message) => message.role === "user" && !isContinue(message.content),
    ).length;
    const confidence = Math.max(0, Math.min(1, Number(raw?.confidence || 0)));
    const canMaster = Boolean(raw?.mastered) && confidence >= 0.82 && meaningfulUserTurns >= 2;
    const requestedAction = ACTIONS.has(raw?.action) ? raw.action : "explain";
    let action = canMaster ? "mastered" : requestedAction === "mastered" ? "question" : requestedAction;

    if (firstTurn) action = "explain";

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

    const showLab = firstTurn
      ? false
      : Boolean(state?.showLab || labEvents.length || action === "lab");

    return Response.json({
      action,
      reply: String(raw?.reply || "Focus on the relationship between the action and the result."),
      showLab,
      mastered: canMaster,
      confidence,
      pitfalls: uniqueStrings(raw?.pitfalls),
      coveredConcepts: uniqueStrings(raw?.coveredConcepts),
      artifactBrief,
      model: generated.model,
    });
  } catch (error) {
    console.error("Teaching loop error", error);
    return Response.json(demoTurn({ lesson: input.lesson, transcript, labEvents, state }));
  }
}
