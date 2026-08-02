# Knowable

Knowable is an open-source, personalized alternative to fixed paid learning apps. Pick a topic, explain why you want to learn it and what success means, and Knowable builds a sequence of 10-minute lessons with interactive labs.

This version is built for **Every App** and runs on Cloudflare through the Every App Gateway.

## Stack

- Every App (`@every-app/sdk`)
- TanStack Start / React
- Cloudflare Workers
- Gemini 2.5 Flash for personalized course generation
- Browser `localStorage` for MVP progress

No database is required for the hackathon MVP.

## Local development

Every App currently expects Node 22+ and pnpm 9+.

```bash
pnpm install
pnpm dev
```

`pnpm dev` runs `everyapp dev`. Open the local Knowable URL printed by the CLI (normally `http://knowable.localhost:8787`). The CLI creates `.everyapp/.dev.vars` containing its local identity keys and `EVERYAPP_DEV=1`.

To enable Gemini locally, stop the dev server after its first run and append your key to that generated file:

```bash
printf '\nGEMINI_API_KEY=PASTE_YOUR_KEY_HERE\n' >> .everyapp/.dev.vars
pnpm dev
```

Do not overwrite `.everyapp/.dev.vars`: Every App needs the identity variables it generated there. Do not commit the file or your API key.

If `GEMINI_API_KEY` is absent or Gemini fails, Knowable deliberately falls back to a deterministic demo course so the UI still works.

## One-time Every App / Cloudflare setup

You only need this to deploy, not to edit the code.

1. Have a Cloudflare account and a domain on Cloudflare.
2. Authenticate the CLI:

```bash
npx -y wrangler login
```

3. Deploy your Every App Gateway:

```bash
npx -y everyapp@latest gateway deploy --domain YOUR_DOMAIN
```

If the CLI asks for a wildcard DNS record, add a proxied CNAME `*` pointing to your domain in Cloudflare DNS.

4. Open the Gateway URL, create the owner account, then create a deploy token in the Gateway admin UI.
5. Connect this computer to the Gateway:

```bash
npx -y everyapp@latest login
```

## Deploy Knowable

From this repository:

```bash
pnpm install
pnpm deploy
```

The first deploy can run without Gemini and will use demo mode. After the app exists in Cloudflare, generate its Wrangler config and add the production secret:

```bash
npx -y everyapp@latest app generate-config
npx wrangler secret put GEMINI_API_KEY -c .everyapp/wrangler.json
```

Paste your Gemini API key when prompted.

## Architecture

`everyapp.config.ts` is the Every App manifest. `src/entry.worker.js` is the authenticated Worker entry. It intercepts `POST /api/course`, calls Gemini server-side, and sends everything else to TanStack Start.

The Worker uses `EVERYAPP_IDENTITY_ISSUER` in production. In local Every App dev mode, it safely falls back to Every App's documented local issuer only when `EVERYAPP_DEV=1`, working around current CLI versions that generate local signing keys but omit the issuer variable.

The model does not emit executable JavaScript. It returns a constrained course/lab JSON spec. The React frontend renders trusted interactive primitives (`curve`, `probability`, `vector`, and `projectile`).

## MVP flow

1. Choose an example course or type any topic.
2. Say why you want to learn it.
3. Define what success looks like.
4. Gemini designs an 8–10 lesson dependency chain.
5. Each lesson takes about 10 minutes and includes explanation, prediction, an interactive lab, and a conceptual check.
6. Progress is stored locally in the browser.
