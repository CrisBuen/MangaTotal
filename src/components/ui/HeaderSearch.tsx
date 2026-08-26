"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form
      className="group relative flex h-11 w-11 items-center overflow-hidden rounded-xl border border-line bg-[color-mix(in_oklch,var(--surface)_88%,transparent)] transition-[width,border-color] duration-200 focus-within:w-56 focus-within:border-accent hover:border-accent"
      onSubmit={(event) => {
        event.preventDefault();
        const value = query.trim();
        router.push(value ? `/biblioteca?f=normal&q=${encodeURIComponent(value)}` : "/biblioteca?f=normal");
      }}
      role="search"
      data-od-id="header-search"
    >
      <button
        type="submit"
        onClick={(event) => {
          if (!query.trim()) {
            event.preventDefault();
            inputRef.current?.focus();
          }
        }}
        className="absolute left-0 grid h-11 w-11 shrink-0 place-items-center text-subtle transition hover:text-accent focus-visible:outline-none"
        aria-label="Buscar en la biblioteca"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      </button>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-full w-full min-w-0 bg-transparent pl-11 pr-3 text-sm text-ink outline-none placeholder:text-subtle"
        placeholder="Buscar manga…"
        aria-label="Buscar manga"
      />
    </form>
  );
}
