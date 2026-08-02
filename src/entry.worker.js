import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import manifest from "../everyapp.config";
import { handleCourseRequest } from "./server/course";

export default everyApp(async (request, env) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/course" && request.method === "POST") {
    return handleCourseRequest(request, env);
  }

  return tanstackEntry.fetch(request);
}, manifest);
