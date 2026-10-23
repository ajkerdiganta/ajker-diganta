import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";
import { env } from "@/lib/env";
import { readBoundedJson } from "@/lib/request-json";

export type Principal = NonNullable<Awaited<ReturnType<typeof getPrincipal>>>;

export async function requirePermission(request: Request, permission: string): Promise<Principal | NextResponse> {
  const principal = await getPrincipal(request.headers);
  if (!principal) return NextResponse.json({ error: "লগইন প্রয়োজন" }, { status: 401 });
  if (!(await hasPermission(principal.id, permission))) {
    return NextResponse.json({ error: "এই কাজের অনুমতি নেই" }, { status: 403 });
  }
  return principal;
}

export function isApiError(value: Principal | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJson(request: Request): Promise<Record<string, unknown> | null> {
  const body = await readBoundedJson(request);
  return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
}

export function hasTrustedMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const supplied = new URL(origin).origin;
    const localTrustedOrigins = env.NODE_ENV === "development" ? ["http://localhost:3000", "http://127.0.0.1:3000"] : [];
    const trusted = [env.BETTER_AUTH_URL, env.PUBLIC_SITE_URL, ...env.ADDITIONAL_TRUSTED_ORIGINS, ...localTrustedOrigins]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map((value) => new URL(value).origin);
    return trusted.includes(supplied);
  } catch {
    return false;
  }
}
