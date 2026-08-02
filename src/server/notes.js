function extractJson(text) {
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("Gemini did not return JSON");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function unique(values, limit = 10) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].slice(0, limit);
}

function ascii(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\n]/g, "");
}

function escapePdf(value) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(text, max = 82) {
  const words = ascii(text).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= max) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function buildDocumentLines(notes, lesson, course) {
  const lines = [];
  const add = (text, style = "body") => lines.push({ text: ascii(text), style });
  const blank = () => add("", "body");

  add(String(lesson?.title || "Lesson notes").replace(/^\d+\.\s*/, ""), "title");
  add(course?.title || "Knowable", "subtitle");
  blank();

  add("What you learned", "heading");
  for (const line of wrap(notes.summary || lesson?.objective || "")) add(line);
  blank();

  add("Key ideas", "heading");
  const ideas = unique(notes.keyIdeas?.length ? notes.keyIdeas : lesson?.keyIdeas, 8);
  for (const idea of ideas) for (const [index, line] of wrap(idea, 76).entries()) add(`${index ? "  " : "- "}${line}`);
  blank();

  add("Your common pitfalls", "heading");
  const pitfalls = unique(notes.pitfalls, 8);
  if (pitfalls.length) {
    for (const pitfall of pitfalls) for (const [index, line] of wrap(pitfall, 76).entries()) add(`${index ? "  " : "- "}${line}`);
  } else {
    add("No persistent misconception was recorded during this lesson.");
  }
  blank();

  add("Example to remember", "heading");
  for (const line of wrap(notes.example || "Try explaining the idea with a fresh example that was not used during the lesson.")) add(line);
  blank();

  add("One-minute review", "heading");
  for (const line of wrap(notes.reviewPrompt || "Explain the idea without notes, predict what changes in a new case, then check yourself.")) add(line);
  blank();
  add("Generated from your Knowable lesson conversation.", "footer");
  return lines;
}

function paginate(lines) {
  const pages = [];
  let page = [];
  let y = 738;
  const heightFor = (style) => style === "title" ? 30 : style === "heading" ? 24 : style === "subtitle" ? 20 : 16;
  for (const line of lines) {
    const h = heightFor(line.style);
    if (y - h < 54) {
      pages.push(page);
      page = [];
      y = 738;
    }
    page.push({ ...line, y });
    y -= h;
  }
  if (page.length) pages.push(page);
  return pages;
}

function makePdf(lines) {
  const pages = paginate(lines);
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("");
  const pagesId = addObject("");
  const regularFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const pageIds = [];

  for (const pageLines of pages) {
    const commands = [];
    for (const line of pageLines) {
      const style = line.style;
      const font = style === "title" || style === "heading" ? "/F2" : "/F1";
      const size = style === "title" ? 20 : style === "heading" ? 13 : style === "subtitle" ? 10 : style === "footer" ? 9 : 11;
      commands.push(`BT ${font} ${size} Tf 54 ${line.y} Td (${escapePdf(line.text)}) Tj ET`);
    }
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
    const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regularFontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  }

  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function fallbackNotes(input) {
  return {
    summary: input.lesson?.objective || "Lesson completed.",
    keyIdeas: unique(input.coveredConcepts?.length ? input.coveredConcepts : input.lesson?.keyIdeas, 8),
    pitfalls: unique(input.pitfalls, 8),
    example: "Create a fresh example and explain what should happen before checking the result.",
    reviewPrompt: "Explain the core idea in plain English, then apply it to a new case.",
  };
}

async function synthesizeNotes(input, key) {
  if (!key) return fallbackNotes(input);
  const transcript = Array.isArray(input.transcript)
    ? input.transcript.map((message) => ({ role: message.role, content: String(message.content || "").slice(0, 2500) })).slice(-24)
    : [];
  const prompt = `Create concise personalized lesson notes from this tutoring conversation.

Lesson: ${JSON.stringify({ title: input.lesson?.title, objective: input.lesson?.objective, keyIdeas: input.lesson?.keyIdeas })}
Learner goal: ${input.course?.learnerGoal || ""}
Recorded pitfalls: ${JSON.stringify(input.pitfalls || [])}
Concepts demonstrated: ${JSON.stringify(input.coveredConcepts || [])}
Conversation: ${JSON.stringify(transcript)}

Return ONLY JSON:
{
  "summary": "plain-language summary, 2-4 sentences",
  "keyIdeas": ["3-6 concise ideas"],
  "pitfalls": ["only mistakes or confusions this learner actually showed, phrased constructively"],
  "example": "one memorable concrete example",
  "reviewPrompt": "one short retrieval-practice prompt"
}
Do not use LaTeX. Keep it clear enough to reread a month later.`;

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  );
  if (!response.ok) return fallbackNotes(input);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim();
  try {
    const raw = extractJson(text);
    return {
      summary: String(raw?.summary || fallbackNotes(input).summary),
      keyIdeas: unique(raw?.keyIdeas?.length ? raw.keyIdeas : input.coveredConcepts, 8),
      pitfalls: unique(raw?.pitfalls?.length ? raw.pitfalls : input.pitfalls, 8),
      example: String(raw?.example || fallbackNotes(input).example),
      reviewPrompt: String(raw?.reviewPrompt || fallbackNotes(input).reviewPrompt),
    };
  } catch {
    return fallbackNotes(input);
  }
}

export async function handleNotesRequest(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!input?.lesson) return Response.json({ error: "lesson is required" }, { status: 400 });

  const notes = await synthesizeNotes(input, env?.GEMINI_API_KEY);
  const pdf = makePdf(buildDocumentLines(notes, input.lesson, input.course || {}));
  const slug = ascii(String(input.lesson?.title || "lesson-notes").replace(/^\d+\.\s*/, ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "lesson-notes";

  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-notes.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
