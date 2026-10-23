import { describe, expect, it } from "vitest";
import { PERMISSION_CATALOG, ROLE_NAMES, ROLE_PERMISSION_CODES } from "@/lib/permissions";

describe("Bengali-first RBAC catalog", () => {
  it("contains all approved identity roles with Bengali labels", () => {
    expect(Object.keys(ROLE_NAMES)).toEqual([
      "SUPER_ADMIN", "ADMIN", "EDITOR", "REPORTER", "VIDEO_EDITOR", "MODERATOR", "USER",
    ]);
    expect(ROLE_NAMES.ADMIN).toBe("অ্যাডমিন");
    expect(ROLE_NAMES.USER).toBe("পাঠক");
  });

  it("defines a minimal dashboard permission and separate admin permission", () => {
    const codes = PERMISSION_CATALOG.map(([code]) => code);
    expect(codes).toContain("dashboard.access");
    expect(codes).toContain("admin.access");
    expect(PERMISSION_CATALOG.find(([code]) => code === "admin.access")?.[1]).toBe("অ্যাডমিন ড্যাশবোর্ড দেখা");
  });

  it("restricts administrative analytics to ADMIN and SUPER_ADMIN by default", () => {
    expect(ROLE_PERMISSION_CODES.ADMIN).toContain("analytics.read");
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toContain("analytics.read");
    expect(ROLE_PERMISSION_CODES.EDITOR).not.toContain("analytics.read");
    expect(ROLE_PERMISSION_CODES.REPORTER).not.toContain("analytics.read");
    expect(ROLE_PERMISSION_CODES.USER).not.toContain("analytics.read");
  });

  it("allows only admins to manage accounts while limiting audit viewing to admins", () => {
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.ADMIN).toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.EDITOR).not.toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.REPORTER).not.toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.VIDEO_EDITOR).not.toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.MODERATOR).not.toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.USER).not.toContain("users.manage");
    expect(ROLE_PERMISSION_CODES.ADMIN).toContain("audit.read");
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toContain("audit.read");
    expect(ROLE_PERMISSION_CODES.REPORTER).not.toContain("audit.read");
  });

  it("restricts category and subcategory management to administrators", () => {
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.ADMIN).toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.EDITOR).not.toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.REPORTER).not.toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.VIDEO_EDITOR).not.toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.MODERATOR).not.toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.USER).not.toContain("category.manage");
    expect(ROLE_PERMISSION_CODES.EDITOR).toContain("taxonomy.manage");
  });

  it("keeps the article review/publish workflow with Editors/Admins and story removal with Admins only", () => {
    expect(ROLE_PERMISSION_CODES.EDITOR).toEqual(expect.arrayContaining(["article.review", "article.approve", "article.reject", "article.publish"]));
    expect(ROLE_PERMISSION_CODES.ADMIN).toEqual(expect.arrayContaining(["article.review", "article.approve", "article.reject", "article.publish", "article.delete.any"]));
    expect(ROLE_PERMISSION_CODES.SUPER_ADMIN).toContain("article.delete.any");
    expect(ROLE_PERMISSION_CODES.REPORTER).toEqual(expect.arrayContaining(["article.submit", "article.resubmit"]));
    expect(ROLE_PERMISSION_CODES.REPORTER).not.toContain("article.publish");
    expect(ROLE_PERMISSION_CODES.EDITOR).not.toContain("article.delete.any");
  });

  it("keeps Video Editor permissions least-privileged and separate from newsroom publication", () => {
    const videoEditor = ROLE_PERMISSION_CODES.VIDEO_EDITOR;
    expect(videoEditor).toEqual(expect.arrayContaining(["video.read.own", "video.create", "video.edit.own.draft", "video.submit", "video.resubmit"]));
    expect(videoEditor).not.toEqual(expect.arrayContaining(["video.read.any", "video.edit.any", "video.approve", "video.publish", "video.archive"]));
    expect(ROLE_PERMISSION_CODES.EDITOR).toEqual(expect.arrayContaining(["video.read.any", "video.review", "video.approve", "video.publish"]));
  });
});
