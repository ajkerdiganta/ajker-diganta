import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function cmsErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "তথ্য যাচাই করা যায়নি", details: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) }, { status: 400 });
  }
  if (error && typeof error === "object" && "status" in error && "message" in error) {
    const status = Number((error as { status?: unknown }).status);
    const message = (error as { message?: unknown }).message;
    if (status >= 400 && status < 500 && typeof message === "string") return NextResponse.json({ error: message }, { status });
  }
  console.error("CMS request failed", error instanceof Error ? error.name : "unknown error");
  return NextResponse.json({ error: "অনুরোধ সম্পন্ন করা যায়নি" }, { status: 500 });
}
