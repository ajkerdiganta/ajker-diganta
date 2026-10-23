import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest).slice(0, 128)
    : undefined;
  const errorName = error instanceof Error ? error.name : "UnknownError";
  // Avoid logging request URLs/query values, cookies, headers, message text, user IDs, or article content.
  console.error(JSON.stringify({
    level: "error",
    event: "next.request.error",
    method: request.method,
    route: context.routePath,
    routeType: context.routeType,
    router: context.routerKind,
    errorName: errorName.slice(0, 80),
    ...(digest ? { digest } : {}),
  }));
};
