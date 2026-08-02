import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import manifest from "../everyapp.config";
import { handleCourseRequest } from "./server/course";
import { handleLabRequest } from "./server/lab";
import { handleTutorRequest } from "./server/tutor";

const handler = async (request, env) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/status" && request.method === "GET") {
    return Response.json({
      ok: true,
      geminiConfigured: Boolean(env?.GEMINI_API_KEY),
      everyAppDev: env?.EVERYAPP_DEV === "1" || env?.EVERYAPP_DEV === "true",
    });
  }

  if (url.pathname === "/api/course" && request.method === "POST") {
    return handleCourseRequest(request, env);
  }

  if (url.pathname === "/api/lab" && request.method === "POST") {
    return handleLabRequest(request, env);
  }

  if (url.pathname === "/api/tutor" && request.method === "POST") {
    return handleTutorRequest(request, env);
  }

  return tanstackEntry.fetch(request);
};

export default {
  async fetch(request, env, ctx) {
    const issuer =
      env?.EVERYAPP_IDENTITY_ISSUER ||
      (env?.EVERYAPP_DEV === "1" || env?.EVERYAPP_DEV === "true"
        ? "https://gateway.dev.localhost"
        : undefined);

    return everyApp(handler, manifest, { issuer }).fetch(request, env, ctx);
  },
};
