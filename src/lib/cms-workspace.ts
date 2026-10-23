import type { Principal } from "@/lib/cms-api";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/authorization";

export async function loadArticleEditorOptions(actor: Principal, excludeArticleId?: string) {
  const [canReadTaxonomy, canReadAuthors, canReadAnyArticles] = await Promise.all([
    hasPermission(actor.id, "taxonomy.read"),
    hasPermission(actor.id, "author.read"),
    hasPermission(actor.id, "article.read.any"),
  ]);
  const [categories, authors, tags, relatedOptions] = await Promise.all([
    canReadTaxonomy ? prisma.category.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, parentId: true } }) : [],
    canReadAuthors ? prisma.author.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    canReadTaxonomy ? prisma.tag.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, take: 300, select: { id: true, name: true } }) : [],
    canReadAnyArticles ? prisma.article.findMany({ where: { id: { not: excludeArticleId }, status: { in: ["APPROVED", "SCHEDULED", "PUBLISHED"] }, deletedAt: null }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, title: true, status: true } }) : [],
  ]);
  return { categories, authors, tags, relatedOptions };
}
