import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSION_CATALOG, ROLE_NAMES, ROLE_PERMISSION_CODES, type PermissionCode } from "../src/lib/permissions";
import type { NavigationMenuLocation, RoleCode } from "../src/generated/prisma/enums";
import { DEFAULT_SITE_PAGES, DEFAULT_SITE_SETTINGS } from "../src/lib/site-content-defaults";
import { DEFAULT_PAYMENT_GATEWAYS, DEFAULT_SUBSCRIPTION_PACKAGES } from "../src/lib/subscription-schemas";
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

const roles = Object.entries(ROLE_PERMISSION_CODES) as Array<[RoleCode, readonly PermissionCode[]]>;

// Preserved from the project’s supplied original menu-tree seed. Do not replace
// labels, order, parent relationships, or derive substitute categories here.
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
const quickLinks = [
  { label: "প্রচ্ছদ", href: "/" },
  { label: "সর্বশেষ", href: "/latest" },
  { label: "ভিডিও", href: "/video" },
];

async function addMenuItemIfMissing(input: {
  menuId: string;
  parentId?: string | null;
  label: string;
  href: string;
  categoryId?: string | null;
  sortOrder: number;
}) {
  const parentId = input.parentId ?? null;
  const existing = await prisma.navigationMenuItem.findFirst({
    where: { menuId: input.menuId, label: input.label, parentId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const item = await prisma.navigationMenuItem.create({
    data: {
      menuId: input.menuId,
      parentId,
      label: input.label,
      href: input.href,
      categoryId: input.categoryId ?? null,
      sortOrder: input.sortOrder,
      isActive: true,
    },
  });
  return item.id;
}

async function seedCategoryAndNavigationTree() {
  const categoryByName = new Map<string, { id: string; slug: string; isActive: boolean; deletedAt: Date | null }>();
  for (const [rootOrder, [rootName, children]] of Object.entries(menuTree).entries()) {
    const rootSlug = asciiSlug(rootName);
    const root = await prisma.category.upsert({
      where: { slug: rootSlug },
      update: {},
      create: { name: rootName, slug: rootSlug, sortOrder: rootOrder },
    });
    categoryByName.set(rootName, root);
    for (const [childOrder, childName] of children.entries()) {
      const childSlug = `${asciiSlug(childName)}-${asciiSlug(rootName)}`;
      const child = await prisma.category.upsert({
        where: { slug: childSlug },
        update: {},
        create: { name: childName, slug: childSlug, parentId: root.id, sortOrder: childOrder },
      });
      categoryByName.set(`${rootName}:${childName}`, child);
    }
  }

  const header = await prisma.navigationMenu.findUnique({ where: { slug: "header-main" } });
  if (header?.isActive) {
    for (const [sortOrder, label] of headerItems.entries()) {
      const category = categoryByName.get(label);
      if (category && (!category.isActive || category.deletedAt)) continue;
      const href = label === "সর্বশেষ" ? "/latest" : label === "ভিডিও" ? "/video" : category ? `/category/${category.slug}` : null;
      if (!href) continue;
      await addMenuItemIfMissing({ menuId: header.id, label, href, categoryId: category?.id ?? null, sortOrder });
    }
  }

  const hamburger = await prisma.navigationMenu.findUnique({ where: { slug: "hamburger" } });
  if (hamburger?.isActive) {
    const quickGroupId = await addMenuItemIfMissing({ menuId: hamburger.id, label: "দ্রুত লিংক", href: "/", sortOrder: 0 });
    for (const [sortOrder, link] of quickLinks.entries()) {
      await addMenuItemIfMissing({ menuId: hamburger.id, parentId: quickGroupId, label: link.label, href: link.href, sortOrder });
    }

    for (const [groupOrder, [group, children]] of Object.entries(menuTree).entries()) {
      const root = categoryByName.get(group);
      if (!root || !root.isActive || root.deletedAt) continue;
      const parentId = await addMenuItemIfMissing({ menuId: hamburger.id, label: group, href: `/category/${root.slug}`, categoryId: root.id, sortOrder: groupOrder + 1 });
      for (const [childOrder, childName] of children.entries()) {
        const child = categoryByName.get(`${group}:${childName}`);
        if (!child || !child.isActive || child.deletedAt) continue;
        await addMenuItemIfMissing({ menuId: hamburger.id, parentId, label: childName, href: `/category/${child.slug}`, categoryId: child.id, sortOrder: childOrder });
      }
    }
  }
}

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

  const navigationMenus: Array<{ name: string; slug: string; location: NavigationMenuLocation }> = [
    { name: "হেডারের মূল নেভিগেশন", slug: "header-main", location: "HEADER_MAIN" },
    { name: "হ্যামবার্গার মেনু", slug: "hamburger", location: "HAMBURGER" },
  ];
  for (const menu of navigationMenus) {
    await prisma.navigationMenu.upsert({
      where: { slug: menu.slug },
      update: {},
      create: menu,
    });
  }
  await seedCategoryAndNavigationTree();

  for (const [slug, page] of Object.entries(DEFAULT_SITE_PAGES)) {
    await prisma.sitePage.upsert({ where: { slug }, update: {}, create: { slug, ...page } });
  }
  await prisma.siteSetting.upsert({ where: { id: "global" }, update: {}, create: { id: "global", companyLinks: DEFAULT_SITE_SETTINGS.companyLinks } });
  for (const gateway of DEFAULT_PAYMENT_GATEWAYS) {
    await prisma.paymentGatewaySetting.upsert({ where: { method: gateway.method }, update: {}, create: gateway });
  }
  for (const subscriptionPackage of DEFAULT_SUBSCRIPTION_PACKAGES) {
    await prisma.subscriptionPackage.upsert({ where: { code: subscriptionPackage.code }, update: {}, create: subscriptionPackage });
  }
}

main()
  .catch((error) => {
    console.error("Role/permission seed failed", error instanceof Error ? error.name : "unknown error");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
