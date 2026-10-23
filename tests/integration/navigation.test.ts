import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
const { revalidatePathMock } = vi.hoisted(() => ({ revalidatePathMock: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }));
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as navigationCollection from "@/app/api/admin/navigation/route";
import * as navigationItemRoute from "@/app/api/admin/navigation/[id]/route";

const randomTestPassword = () => `Test-${randomBytes(32).toString("base64url")}Aa9!`;
const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
const email = `navigation-${Date.now()}@example.test`;
const password = randomTestPassword();
let cookie = "";
let requestIpCounter = 90;

async function signupAdmin() {
  const signup = await auth.handler(new Request(`${origin}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": `198.51.100.${requestIpCounter++}` },
    body: JSON.stringify({ name: "নেভিগেশন পরীক্ষক", email, password }),
  }));
  expect(signup.status).toBe(200);
  const tokenCookie = signup.headers.getSetCookie().find((line) => /(?:__Secure-)?ajker-diganta\.session_token=/.test(line));
  expect(tokenCookie).toBeTruthy();
  cookie = tokenCookie!.split(";")[0];
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const admin = await prisma.role.findUniqueOrThrow({ where: { code: "ADMIN" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: admin.id } });
}

function request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", cookie);
  headers.set("origin", origin);
  if (init.body) headers.set("content-type", "application/json");
  return new Request(`${origin}${path}`, { ...init, headers });
}

async function invokeSave(body: Record<string, unknown>, itemId?: string) {
  const req = request(itemId ? `/api/admin/navigation/${itemId}` : "/api/admin/navigation", {
    method: itemId ? "PATCH" : "POST",
    body: JSON.stringify(body),
  });
  const response = await (itemId
    ? navigationItemRoute.PATCH(req, { params: Promise.resolve({ id: itemId }) })
    : navigationCollection.POST(req));
  if (!response) throw new Error("Navigation route handler returned no response");
  return response;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("admin navigation management API", () => {
  it("seeds the preserved category tree into the header and nested hamburger menus", async () => {
    const roots = await prisma.category.findMany({ where: { parentId: null, deletedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
    expect(roots.map(({ name }) => name)).toEqual(["বাংলাদেশ", "রাজনীতি", "বিশ্ব", "মতামত", "বাণিজ্য", "বিনোদন", "জীবনযাপন", "চাকরি", "খেলা", "প্রযুক্তি", "শিক্ষা", "ধর্ম", "অন্য আলো", "আরও"]);
    const categories = await prisma.category.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, parentId: true } });
    expect(categories).toHaveLength(115);
    expect(categories.filter((category) => category.parentId !== null)).toHaveLength(101);

    const header = await prisma.navigationMenu.findUniqueOrThrow({ where: { slug: "header-main" }, include: { items: { where: { isActive: true, parentId: null }, orderBy: { sortOrder: "asc" } } } });
    expect(header.items.map(({ label }) => label)).toEqual(["সর্বশেষ", "বাংলাদেশ", "রাজনীতি", "বিশ্ব", "বাণিজ্য", "মতামত", "খেলা", "বিনোদন", "চাকরি", "জীবনযাপন", "ভিডিও"]);

    const hamburger = await prisma.navigationMenu.findUniqueOrThrow({ where: { slug: "hamburger" }, include: { items: { where: { isActive: true }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }] } } });
    expect(hamburger.items.filter((item) => item.parentId === null)).toHaveLength(15);
    expect(hamburger.items.filter((item) => item.parentId !== null)).toHaveLength(104);
    const bangladesh = hamburger.items.find((item) => item.label === "বাংলাদেশ" && item.parentId === null);
    expect(bangladesh).toBeDefined();
    expect(hamburger.items.filter((item) => item.parentId === bangladesh?.id).map(({ label }) => label)).toEqual(["রাজধানী", "জেলা", "করোনাভাইরাস", "পরিবেশ", "অপরাধ"]);
    const categorySlugs = new Map(categories.map(({ id, slug }) => [id, slug]));
    const categoryLinks = [...header.items, ...hamburger.items].filter((item) => item.categoryId !== null);
    expect(categoryLinks).toHaveLength(124);
    expect(categoryLinks.every((item) => item.categoryId && item.href === `/category/${categorySlugs.get(item.categoryId)}`)).toBe(true);
  });

  it("requires authentication and rejects unsafe URL payloads", async () => {
    const anonymous = await navigationCollection.GET(new Request(`${origin}/api/admin/navigation`));
    expect(anonymous.status).toBe(401);
    await signupAdmin();
    const menu = await prisma.navigationMenu.findUniqueOrThrow({ where: { slug: "hamburger" } });
    const invalid = await invokeSave({ menuId: menu.id, label: "বিপজ্জনক", href: "javascript:alert(1)" });
    expect(invalid.status).toBe(400);
  });

  it("creates nested items, refuses a third level, and soft-deletes children with their parent", async () => {
    const menu = await prisma.navigationMenu.findUniqueOrThrow({ where: { slug: "hamburger" } });
    const parentResponse = await invokeSave({ menuId: menu.id, label: "পরীক্ষা বিভাগ", href: "/latest", sortOrder: 90 });
    expect(parentResponse.status).toBe(201);
    expect(parentResponse.headers.get("cache-control")).toBe("private, no-store");
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    const parent = (await parentResponse.json()).item as { id: string };

    const childResponse = await invokeSave({ menuId: menu.id, label: "উপবিভাগ", href: "/video", parentId: parent.id, sortOrder: 1 });
    expect(childResponse.status).toBe(201);
    const child = (await childResponse.json()).item as { id: string };

    const grandchild = await invokeSave({ menuId: menu.id, label: "আরও একটি স্তর", href: "/about", parentId: child.id });
    expect(grandchild.status).toBe(400);

    const deleteRequest = request(`/api/admin/navigation/${parent.id}`, { method: "DELETE" });
    const deleted = await navigationItemRoute.DELETE(deleteRequest, { params: Promise.resolve({ id: parent.id }) });
    if (!deleted) throw new Error("Navigation delete handler returned no response");
    expect(deleted.status).toBe(200);
    expect(revalidatePathMock).toHaveBeenCalledWith("/", "layout");
    const rows = await prisma.navigationMenuItem.findMany({ where: { id: { in: [parent.id, child.id] } }, select: { isActive: true } });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.isActive)).toBe(true);
  });
});
