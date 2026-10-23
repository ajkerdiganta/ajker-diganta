import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasTrustedMutationOrigin, jsonError, parseJson } from "@/lib/cms-api";
import { cmsErrorResponse } from "@/lib/cms-error-response";
import { allowCmsMutation } from "@/lib/cms-rate-limit";
import { publicSubmissionSchema } from "@/lib/site-content-schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) return jsonError("অনুরোধের origin অনুমোদিত নয়", 403);
  const raw = await parseJson(request);
  if (!raw) return jsonError("JSON তথ্য সঠিক নয়", 400);
  const parsed = publicSubmissionSchema.safeParse(raw);
  if (!parsed.success) return cmsErrorResponse(parsed.error);
  if (parsed.data.website) return NextResponse.json({ message: "তথ্য গ্রহণ করা হয়েছে" }, { headers: { "Cache-Control": "no-store" } });

  const ip = request.headers.get("x-real-ip")?.trim().slice(0, 128) || "unknown-client";
  const actorKey = createHash("sha256").update(ip).digest("hex");
  const bucket = parsed.data.type === "CONTACT" ? "public-contact-submission" : "public-footer-submission";
  if (!(await allowCmsMutation(actorKey, bucket, 5, 60_000))) return jsonError("অনেকবার অনুরোধ হয়েছে; কিছুক্ষণ পরে আবার চেষ্টা করুন", 429);

  try {
    if (parsed.data.type === "CONTACT") {
      await prisma.contactSubmission.create({ data: {
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        phone: parsed.data.phone,
      } });
    } else {
      await prisma.footerSubmission.create({ data: {
        type: parsed.data.type,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        subject: parsed.data.subject,
        message: parsed.data.message,
        consentAt: parsed.data.type === "NEWSLETTER" ? new Date() : null,
      } });
    }
    return NextResponse.json({ message: "আপনার তথ্য নিরাপদে সংরক্ষণ করা হয়েছে। সম্পাদকীয় দল পর্যালোচনা করবে।" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return cmsErrorResponse(error);
  }
}
