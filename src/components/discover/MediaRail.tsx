"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function MediaRail({ title, href, action = "Ver todo", onAction, wide = false, children }: {
  title: string; href?: string; action?: string; onAction?: () => void; wide?: boolean; children: ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [ends, setEnds] = useState([true, true]);
  const id = useId();
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setEnds([el.scrollLeft <= 2, el.scrollLeft + el.clientWidth >= el.scrollWidth - 2]);
    const observer = new ResizeObserver(update);
    observer.observe(el);
    el.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); el.removeEventListener("scroll", update); };
  }, [children]);
  const scroll = (direction: number) => {
    const el = track.current;
    el?.scrollBy({ left: el.clientWidth * .82 * direction, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  return <section className="od-rail" aria-labelledby={id}>
    <div className="od-rail-heading"><h2 id={id}>{title}</h2>
      {onAction ? <button onClick={onAction}>{action} ›</button> : href && (href.startsWith("/explorar?") ? <a href={href}>{action} ›</a> : <Link href={href} prefetch={false}>{action} ›</Link>)}
    </div>
    <div className="od-rail-body">
      <button className="od-rail-arrow prev" disabled={ends[0]} onClick={() => scroll(-1)} aria-label={`Anterior en ${title}`}>‹</button>
      <div className="od-track" data-wide={wide} ref={track}>{children}</div>
      <button className="od-rail-arrow next" disabled={ends[1]} onClick={() => scroll(1)} aria-label={`Siguiente en ${title}`}>›</button>
    </div>
  </section>;
}
