"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

type Item = { id: string; label: string; href: string; parentId: string | null };

export function HamburgerMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const groups = items.filter((item) => !item.parentId);

  function closeMenu() {
    setOpen(false);
    setExpanded(null);
  }

  return <>
    <button type="button" aria-label="সব মেনু খুলুন" aria-expanded={open} onClick={() => setOpen(true)} className="relative z-[81] grid size-10 place-items-center rounded-lg border border-line bg-white text-forest shadow-sm transition hover:bg-paper-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest">
      <Menu size={18} aria-hidden="true" />
    </button>
    {open && <>
      <button type="button" aria-label="মেনু বন্ধ করুন" onClick={closeMenu} className="fixed inset-0 z-[81] cursor-default bg-black/30" />
      <div id="hamburger-navigation" role="dialog" aria-modal="true" aria-label="সব মেনু" className="fixed inset-x-2 top-20 z-[82] max-h-[calc(100dvh-5.5rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white shadow-2xl sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-[calc(100vh-7rem)] sm:w-[min(92vw,48rem)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-4 py-3 sm:px-5">
          <p className="font-serif text-lg font-bold text-forest">সব মেনু</p>
          <button type="button" aria-label="মেনু বন্ধ করুন" onClick={closeMenu} className="grid size-9 place-items-center rounded-full text-ink transition hover:bg-paper-100 hover:text-red-brand focus-visible:outline-2 focus-visible:outline-forest"><X size={24} aria-hidden="true" /></button>
        </div>
        <nav aria-label="মেনু বিভাগ" className="divide-y divide-line px-4 pb-4 sm:px-5">
          {groups.map((group) => {
            const children = items.filter((item) => item.parentId === group.id);
            const isExpanded = expanded === group.id;
            return <div key={group.id}>
              {children.length ? <>
                <button type="button" aria-expanded={isExpanded} onClick={() => setExpanded(isExpanded ? null : group.id)} className="flex min-h-14 w-full items-center justify-between gap-4 py-3 text-left font-serif text-lg font-bold text-ink transition hover:text-forest sm:text-xl">
                  <span>{group.label}</span><ChevronDown size={21} aria-hidden="true" className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && <div className="mb-2 ml-4 border-l-2 border-forest/15 pl-4">{children.map((item) => <Link key={item.id} href={item.href} onClick={closeMenu} className="block border-b border-line/70 py-3 text-base text-ink-muted transition last:border-b-0 hover:text-forest sm:text-lg">{item.label}</Link>)}</div>}
              </> : <Link href={group.href} onClick={closeMenu} className="flex min-h-14 items-center py-3 font-serif text-lg font-bold text-ink transition hover:text-forest sm:text-xl">{group.label}</Link>}
            </div>;
          })}
        </nav>
      </div>
    </>}
  </>;
}
