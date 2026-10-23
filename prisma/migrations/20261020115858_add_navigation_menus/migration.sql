-- CreateEnum
CREATE TYPE "NavigationMenuLocation" AS ENUM ('HEADER_MAIN', 'HAMBURGER');

-- CreateTable
CREATE TABLE "navigation_menus" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "location" "NavigationMenuLocation" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "navigation_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_menu_items" (
    "id" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "parentId" UUID,
    "categoryId" UUID,
    "label" VARCHAR(100) NOT NULL,
    "href" VARCHAR(2048) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "navigation_menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "navigation_menus_slug_key" ON "navigation_menus"("slug");

-- CreateIndex
CREATE INDEX "navigation_menus_location_isActive_idx" ON "navigation_menus"("location", "isActive");

-- CreateIndex
CREATE INDEX "navigation_menu_items_menuId_isActive_parentId_sortOrder_idx" ON "navigation_menu_items"("menuId", "isActive", "parentId", "sortOrder");

-- CreateIndex
CREATE INDEX "navigation_menu_items_categoryId_idx" ON "navigation_menu_items"("categoryId");

-- AddForeignKey
ALTER TABLE "navigation_menu_items" ADD CONSTRAINT "navigation_menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "navigation_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_menu_items" ADD CONSTRAINT "navigation_menu_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "navigation_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_menu_items" ADD CONSTRAINT "navigation_menu_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
