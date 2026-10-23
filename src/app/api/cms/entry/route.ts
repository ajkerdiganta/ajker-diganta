import { NextResponse } from "next/server";
import { getPrincipal, hasPermission } from "@/lib/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleDestinations = {
  ADMIN: { destination: "/admin", permission: "admin.access" },
  REPORTER: { destination: "/admin/articles", permission: "article.read.own" },
  EDITOR: { destination: "/admin/review", permission: "article.review" },
} as const;
type CmsRole = keyof typeof roleDestinations;
const cmsRoleCodes = ["SUPER_ADMIN", "ADMIN", "EDITOR", "REPORTER", "VIDEO_EDITOR"] as const;

function response(body: Record<string, string>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const principal = await getPrincipal(request.headers);
  if (!principal) return response({ error: "লগইন প্রয়োজন" }, 401);

  const params = new URL(request.url).searchParams;
  const surface = params.get("surface");
  if (surface === "reader") {
    const hasCmsRole = principal.roles.some((role) => cmsRoleCodes.includes(role as (typeof cmsRoleCodes)[number]));
    if (hasCmsRole) return response({ error: "নিউজরুম account-এর জন্য নির্ধারিত কর্মী login route ব্যবহার করুন।" }, 403);
    return response({ destination: "/dashboard" });
  }

  if (surface === "admin") {
    const isAdmin = principal.roles.some((role) => role === "ADMIN" || role === "SUPER_ADMIN");
    if (!isAdmin || !(await hasPermission(principal.id, "admin.access"))) {
      return response({ error: "এই login route শুধু অ্যাডমিন ও সুপার অ্যাডমিনদের জন্য।" }, 403);
    }
    return response({ destination: roleDestinations.ADMIN.destination });
  }

  if (surface === "staff") {
    if (principal.roles.includes("EDITOR") && await hasPermission(principal.id, roleDestinations.EDITOR.permission)) {
      return response({ destination: roleDestinations.EDITOR.destination });
    }
    if (principal.roles.includes("REPORTER") && await hasPermission(principal.id, roleDestinations.REPORTER.permission)) {
      return response({ destination: roleDestinations.REPORTER.destination });
    }
    return response({ error: "এই login route শুধু রিপোর্টার ও এডিটরদের জন্য।" }, 403);
  }

  const selected = params.get("role");
  if (!selected || !Object.hasOwn(roleDestinations, selected)) return response({ error: "প্রবেশের ধরনটি বৈধ নয়।" }, 400);
  const role = selected as CmsRole;
  const permittedRole = role === "ADMIN"
    ? principal.roles.some((item) => item === "ADMIN" || item === "SUPER_ADMIN")
    : principal.roles.includes(role);
  const permission = await hasPermission(principal.id, roleDestinations[role].permission);
  if (!permittedRole || !permission) return response({ error: "এই প্রবেশ-ধরনের জন্য আপনার অনুমতি নেই। নিউজরুম প্রশাসকের সাথে যোগাযোগ করুন।" }, 403);
  return response({ destination: roleDestinations[role].destination });
}
