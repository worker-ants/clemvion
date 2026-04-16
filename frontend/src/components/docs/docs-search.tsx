"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Fuse, { type IFuseOptions } from "fuse.js";
import { Search } from "lucide-react";
import type { DocsSearchEntry } from "@/lib/docs/registry";
import { cn } from "@/lib/utils/cn";

const FUSE_OPTIONS: IFuseOptions<DocsSearchEntry> = {
  keys: [
    { name: "title", weight: 0.6 },
    { name: "headings", weight: 0.25 },
    { name: "summary", weight: 0.1 },
    { name: "sectionLabel", weight: 0.05 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

export function DocsSearch({ entries }: { entries: DocsSearchEntry[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevQuery, setPrevQuery] = useState("");

  const fuse = useMemo(() => new Fuse(entries, FUSE_OPTIONS), [entries]);

  const results = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return [];
    return fuse.search(q, { limit: 8 }).map((r) => r.item);
  }, [fuse, query]);

  // query가 바뀌면 active index를 0으로 — render 중 파생 상태 재설정 패턴
  if (query !== prevQuery) {
    setPrevQuery(query);
    setActiveIndex(0);
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) {
        router.push(target.href);
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="매뉴얼 검색 (⌘K)"
          aria-label="매뉴얼 검색"
          className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-8 pr-3 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
        />
      </div>
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[360px] overflow-y-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg"
        >
          {results.map((item, i) => (
            <li key={item.href}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]",
                  i === activeIndex && "bg-[hsl(var(--accent))]",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  router.push(item.href);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {item.sectionLabel} · {item.summary}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
