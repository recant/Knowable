# Knowable

A free, personalized interactive learning prototype: choose a topic, explain why you want to learn it and how you will measure success, then get an AI-designed sequence of 10-minute lessons with interactive labs.

## Run locally

```bash
npm install
cp .env.example .env.local
# add GEMINI_API_KEY to .env.local
npm run dev
```

Open http://localhost:3000.

## AI provider

The app uses `gemini-2.5-flash` through the Gemini Developer API. If `GEMINI_API_KEY` is missing or the request fails, it falls back to a deterministic demo course so the UI is still testable.

## Product architecture

The model does **not** generate arbitrary JavaScript that is executed in the page. It generates a constrained JSON course specification. Each lab selects one of a trusted set of interactive primitives (`curve`, `probability`, `vector`, `projectile`) and supplies pedagogically meaningful parameters. This makes generation safer and more reliable while preserving personalization.

## MVP flow

1. Home page shows example courses plus a custom topic box.
2. Learner answers why they care, what success looks like, and optionally what they know already.
3. `/api/course` generates 8–10 chained lessons, each exactly 10 minutes.
4. Every lesson includes a concise explanation, an interactive lab, and a conceptual prediction/check.
5. Progress is stored in `localStorage`.

## Next upgrades

- Generate follow-up lessons based on mistakes, not only onboarding.
- Add richer lab primitives: drag-and-drop proofs, circuit builders, causal graphs, code sandboxes, molecular diagrams.
- Add user accounts and durable progress.
- Cache common generated courses so popular paths cost almost nothing.
- Add content verification and citations for factual domains before public launch.
