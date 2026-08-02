import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import manifest from "../everyapp.config";
import { handleCourseRequest } from "./server/course";

const handler = async (request, env) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/course" && request.method === "POST") {
    return handleCourseRequest(request, env);
  }

  return tanstackEntry.fetch(request);
};

export default {
  async fetch(request, env, ctx) {
    // everyapp dev mints local identity tokens with this issuer, but some
    // current CLI builds do not inject EVERYAPP_IDENTITY_ISSUER into the
    // worker env. Fall back only when EVERYAPP_DEV is explicitly enabled.
    const issuer =
      env?.EVERYAPP_IDENTITY_ISSUER ||
      (env?.EVERYAPP_DEV === "1" || env?.EVERYAPP_DEV === "true"
        ? "https://gateway.dev.localhost"
        : undefined);

    return everyApp(handler, manifest, { issuer }).fetch(request, env, ctx);
  },
};
