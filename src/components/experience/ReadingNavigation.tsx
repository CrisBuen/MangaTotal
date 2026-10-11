"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { READING_TABS, readingTab } from "@/lib/readingNavigation";

export function ReadingNavigation() {
  const path = usePathname();
  const params = useSearchParams();
  const active = readingTab(path, params);
  const [fuente, setFuente] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const urlFuente = params.get("fuente");
    if (urlFuente) {
      setFuente(urlFuente);
      try { sessionStorage.setItem("mangatotal:fuente-lectura", urlFuente); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem("mangatotal:fuente-lectura");
        if (stored) setFuente(stored);
      } catch {}
    }
  }, [params]);

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

  return (
    <nav ref={nav} className="od-tabs od-reading-navigation hidden md:flex" aria-label="Sección de lectura" data-od-id="reading-navigation">
      {READING_TABS.map(tab => {
        let href: string = tab.href;
        if (tab.id === "descubrir" && fuente && fuente !== "mangadex") {
          href = `/lectura/descubrir?fuente=${fuente}`;
        } else if (tab.id === "catalogo" && fuente) {
          href = `/explorar?fuente=${fuente}`;
        }
        return (
          <Link key={tab.id} href={href} prefetch={false} aria-current={active === tab.id ? "page" : undefined}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
