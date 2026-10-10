"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { READING_TABS, readingTab } from "@/lib/readingNavigation";

export function ReadingNavigation() {
  const path = usePathname();
  const params = useSearchParams();
  const active = readingTab(path, params);
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = nav.current;
    const selected = root?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!root || !selected) return;
    // Desplazar solo la barra: scrollIntoView también movería la página y
    // perdería el lugar del usuario al volver desde una ficha.
    const left = selected.offsetLeft - root.offsetLeft;
    if (left < root.scrollLeft) root.scrollLeft = left;
    else if (left + selected.offsetWidth > root.scrollLeft + root.clientWidth) root.scrollLeft = left + selected.offsetWidth - root.clientWidth;
  }, [active]);
  return <nav ref={nav} className="od-tabs od-reading-navigation" aria-label="Sección de lectura" data-od-id="reading-navigation">
    {READING_TABS.map(tab => <Link key={tab.id} href={tab.href} prefetch={false} aria-current={active === tab.id ? "page" : undefined}>{tab.label}</Link>)}
  </nav>;
}
