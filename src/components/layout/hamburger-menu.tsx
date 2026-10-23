"use client";

import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type MenuItem = {
  id: string;
  label: string;
  href: string;
  children?: Array<{ id: string; label: string; href: string }>;
};

export function HamburgerMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-menu-close]")?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hasAttribute("hidden"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
    setExpanded(null);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="সব মেনু খুলুন"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(true)}
        className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-forest shadow-sm transition hover:bg-paper-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[90]" data-testid="hamburger-overlay">
          <button
            type="button"
            aria-label="মেনু বন্ধ করুন"
            tabIndex={-1}
            onClick={closeMenu}
            className="absolute inset-0 cursor-default bg-ink/45"
          />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="সব মেনু"
            className="absolute inset-x-0 bottom-0 top-0 flex max-h-[100dvh] flex-col overflow-hidden border-t border-line bg-white shadow-2xl sm:bottom-auto sm:left-auto sm:right-4 sm:top-16 sm:max-h-[calc(100dvh-5rem)] sm:w-[min(92vw,30rem)] sm:rounded-2xl sm:border"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-red-brand">দৈনিক আজকের দিগন্ত</p>
                <h2 className="mt-1 font-serif text-xl font-bold text-forest">সব মেনু</h2>
              </div>
              <button
                type="button"
                data-menu-close
                aria-label="মেনু বন্ধ করুন"
                onClick={closeMenu}
                className="grid size-10 place-items-center rounded-full text-ink transition hover:bg-paper-100 hover:text-red-brand focus-visible:outline-2 focus-visible:outline-forest"
              >
                <X size={23} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="মেনু বিভাগ" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
              {items.map((item) => {
                const hasChildren = Boolean(item.children?.length);
                const isExpanded = expanded === item.id;
                return (
                  <section key={item.id} className="border-b border-line last:border-b-0">
                    <div className="flex min-h-14 items-center gap-2">
                      {hasChildren ? (
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`${panelId}-${item.id}`}
                          onClick={() => setExpanded(isExpanded ? null : item.id)}
                          className="flex min-h-14 min-w-0 flex-1 items-center py-3 text-left font-serif text-lg font-bold text-ink transition hover:text-forest focus-visible:outline-2 focus-visible:outline-forest"
                        >
                          {item.label}
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          className="flex min-h-14 min-w-0 flex-1 items-center py-3 font-serif text-lg font-bold text-ink transition hover:text-forest focus-visible:outline-2 focus-visible:outline-forest"
                        >
                          {item.label}
                        </Link>
                      )}
                      {hasChildren && (
                        <button
                          type="button"
                          aria-label={`${item.label} উপবিভাগ ${isExpanded ? "বন্ধ" : "খুলুন"}`}
                          aria-expanded={isExpanded}
                          aria-controls={`${panelId}-${item.id}`}
                          onClick={() => setExpanded(isExpanded ? null : item.id)}
                          className="grid size-11 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-paper-100 hover:text-forest focus-visible:outline-2 focus-visible:outline-forest"
                        >
                          <ChevronDown size={20} aria-hidden="true" className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        </button>
                      )}
                    </div>
                    {hasChildren && isExpanded && (
                      <div id={`${panelId}-${item.id}`} className="mb-3 ml-3 border-l-2 border-forest/20 pl-4">
                        {item.children?.map((child) => (
                          <Link
                            key={child.id}
                            href={child.href}
                            onClick={closeMenu}
                            className="block min-h-12 border-b border-line/70 py-3 text-base text-ink-muted last:border-b-0 hover:text-forest focus-visible:outline-2 focus-visible:outline-forest"
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
