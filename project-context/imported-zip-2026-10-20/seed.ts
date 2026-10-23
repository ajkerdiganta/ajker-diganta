import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_NAMES, ROLE_PERMISSION_CODES, type PermissionCode } from "../src/lib/permissions";
import type { RoleCode } from "../src/generated/prisma/enums";
import { asciiSlug } from "../src/lib/slug";

const databaseUrl = process.env.NODE_ENV === "production"
  ? process.env.MIGRATION_DATABASE_URL
  : process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(process.env.NODE_ENV === "production"
    ? "MIGRATION_DATABASE_URL is required for production role/permission seeding."
    : "DATABASE_URL is required for role/permission seeding.");
}
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const menuTree: Record<string, string[]> = {
  "বাংলাদেশ": ["রাজধানী", "জেলা", "করোনাভাইরাস", "পরিবেশ", "অপরাধ"],
  "রাজনীতি": [],
  "বিশ্ব": ["ইরান যুদ্ধ", "ভারত", "পাকিস্তান", "চীন", "মধ্যপ্রাচ্য", "যুক্তরাষ্ট্র", "এশিয়া", "ইউরোপ", "আফ্রিকা", "লাতিন আমেরিকা"],
  "মতামত": ["সম্পাদকীয়", "কলাম", "সাক্ষাৎকার", "স্মরণ", "প্রতিক্রিয়া", "চিঠি"],
  "বাণিজ্য": ["শেয়ারবাজার", "ব্যাংক", "শিল্প", "অর্থনীতি", "বিশ্ববাণিজ্য", "বিশ্লেষণ", "আপনার টাকা", "উদ্যোক্তা", "করপোরেট সংবাদ", "বাজেট ২০২৬–২৭", "হাটবাজার"],
  "বিনোদন": ["টেলিভিশন", "ওটিটি", "ঢালিউড", "টালিউড", "বলিউড", "হলিউড", "বিশ্ব চলচ্চিত্র", "গান", "নাটক", "আলাপন"],
  "জীবনযাপন": ["ভ্রমণ", "সম্পর্ক", "সুস্থতা", "রাশি", "ফ্যাশন", "স্টাইল", "রূপচর্চা", "গৃহসজ্জা", "রসনা", "কেনাকাটা"],
  "চাকরি": ["খবর", "নিয়োগ", "পরামর্শ", "সাক্ষাৎকার"],
  "খেলা": ["ক্রিকেট", "ফুটবল", "টেনিস", "অন্য খেলা", "সাক্ষাৎকার", "ফটো ফিচার", "কুইজ", "সাত রং", "ভিডিও", "আজকের খেলা"],
  "প্রযুক্তি": ["গ্যাজেট", "টিপস", "বিজ্ঞান", "অটোমোবাইল", "সাইবার–জগৎ", "ফ্রিল্যান্সিং", "এআই", "কুইজ"],
  "শিক্ষা": ["ভর্তি", "পরীক্ষা", "বৃত্তি", "পড়াশোনা", "উচ্চশিক্ষা", "ক্যাম্পাস", "গণিত ইশকুল"],
  "ধর্ম": ["ইসলাম", "সনাতন", "বৌদ্ধ", "খ্রিষ্টান"],
  "অন্য আলো": ["কবিতা", "গল্প", "নিবন্ধ", "বইপত্র", "শিল্পকলা", "সাক্ষাৎকার", "ভ্রমণ", "অন্যান্য", "অনুবাদ", "মুক্ত গদ্য", "শিশু-কিশোর"],
  "আরও": ["গোলটেবিল", "বিশেষ সংখ্যা", "অনলাইন ভোট", "প্রতিষ্ঠাবার্ষিকী", "একটু থামুন"],
};
const headerItems = ["সর্বশেষ", "বাংলাদেশ", "রাজনীতি", "বিশ্ব", "বাণিজ্য", "মতামত", "খেলা", "বিনোদন", "চাকরি", "জীবনযাপন", "ভিডিও"];
const hamburgerGroups: Record<string, string[]> = { "দ্রুত লিংক": ["প্রচ্ছদ", "সর্বশেষ", "রাজনীতি", "রস+আলো", "ছবি", "ভিডিও", "হালফ্যাশন"], ...menuTree };

async function seedNavigation() {
  const categoryIds = new Map<string, string>();
  for (const [name, children] of Object.entries(menuTree)) {
    const root = await prisma.category.upsert({ where: { slug: asciiSlug(name) }, update: { name, isActive: true, deletedAt: null }, create: { name, slug: asciiSlug(name), sortOrder: Object.keys(menuTree).indexOf(name) } });
    categoryIds.set(name, root.id);
    for (const [index, child] of children.entries()) {
      const slug = `${asciiSlug(child)}-${asciiSlug(name)}`;
      const row = await prisma.category.upsert({ where: { slug }, update: { name: child, parentId: root.id, isActive: true, deletedAt: null }, create: { name: child, slug, parentId: root.id, sortOrder: index } });
      categoryIds.set(`${name}:${child}`, row.id);
    }
  }
  const menus = [
    { name: "হেডারের মূল মেনু", slug: "header-main", location: "HEADER_MAIN" as const },
    { name: "হ্যামবার্গার / সব মেনু", slug: "hamburger", location: "HAMBURGER" as const },
  ];
  for (const menuData of menus) {
    const menu = await prisma.navigationMenu.upsert({ where: { slug: menuData.slug }, update: { name: menuData.name, location: menuData.location, isActive: true }, create: menuData });
    const groups = menuData.location === "HEADER_MAIN" ? Object.fromEntries(headerItems.map((name) => [name, []])) : hamburgerGroups;
    for (const [groupIndex, [group, children]] of Object.entries(groups).entries()) {
      const categoryId = categoryIds.get(group);
      const href = group === "প্রচ্ছদ" ? "/" : group === "সর্বশেষ" ? "/latest" : group === "ভিডিও" ? "/video" : categoryId ? `/category/${(await prisma.category.findUniqueOrThrow({ where: { id: categoryId }, select: { slug: true } })).slug}` : "/";
      const parent = await prisma.navigationMenuItem.findFirst({ where: { menuId: menu.id, label: group, parentId: null } });
      const parentRow = parent ?? await prisma.navigationMenuItem.create({ data: { menuId: menu.id, label: group, href, categoryId, sortOrder: groupIndex } });
      if (parent) await prisma.navigationMenuItem.update({ where: { id: parent.id }, data: { href, categoryId, sortOrder: groupIndex, isActive: true } });
      for (const [childIndex, child] of children.entries()) {
        const childCategoryId = categoryIds.get(`${group}:${child}`) ?? categoryIds.get(child);
        const childHref = childCategoryId ? `/category/${(await prisma.category.findUniqueOrThrow({ where: { id: childCategoryId }, select: { slug: true } })).slug}` : "/search";
        const existing = await prisma.navigationMenuItem.findFirst({ where: { menuId: menu.id, label: child, parentId: parentRow.id } });
        if (existing) await prisma.navigationMenuItem.update({ where: { id: existing.id }, data: { href: childHref, categoryId: childCategoryId, sortOrder: childIndex, isActive: true } });
        else await prisma.navigationMenuItem.create({ data: { menuId: menu.id, parentId: parentRow.id, label: child, href: childHref, categoryId: childCategoryId, sortOrder: childIndex } });
      }
    }
  }
}

const roles = Object.entries(ROLE_PERMISSION_CODES) as Array<[RoleCode, readonly PermissionCode[]]>;

async function main() {
  for (const [code, description] of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }

  for (const [code, permissionCodes] of roles) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: ROLE_NAMES[code] },
      create: { code, name: ROLE_NAMES[code] },
    });

    const permissions = await prisma.permission.findMany({ where: { code: { in: [...permissionCodes] } } });
    const permissionIds = permissions.map(({ id }) => id);
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId: { notIn: permissionIds } },
    });

    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  await seedNavigation();
}

main()
  .catch((error) => {
    console.error("Role/permission seed failed", error instanceof Error ? error.name : "unknown error");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
