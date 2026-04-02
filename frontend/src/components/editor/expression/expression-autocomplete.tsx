"use client";

import { useEffect, useRef, useCallback } from "react";
import type { Suggestion } from "./use-expression-suggestions";

interface ExpressionAutocompleteProps {
  suggestions: Suggestion[];
  selectedIndex: number;
  onSelect: (suggestion: Suggestion) => void;
  onNavigate: (direction: "up" | "down") => void;
  visible: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}

const TYPE_COLORS: Record<string, string> = {
  variable: "text-blue-400",
  field: "text-green-400",
  node: "text-orange-400",
  function: "text-purple-400",
};

const TYPE_LABELS: Record<string, string> = {
  variable: "var",
  field: "field",
  node: "node",
  function: "fn",
};

export function ExpressionAutocomplete({
  suggestions,
  selectedIndex,
  onSelect,
  onNavigate,
  visible,
  anchorRef,
}: ExpressionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onNavigate("down");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        onNavigate("up");
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (suggestions.length > 0) {
          e.preventDefault();
          onSelect(suggestions[selectedIndex]);
        }
      }
    },
    [visible, suggestions, selectedIndex, onSelect, onNavigate],
  );

  useEffect(() => {
    const el = anchorRef.current;
    if (!el) return;
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [anchorRef, handleKeyDown]);

  if (!visible || suggestions.length === 0) return null;

  return (
    <div
      className="absolute z-50 mt-1 w-64 max-h-48 overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--popover))] text-[hsl(var(--popover-foreground))] shadow-md"
      ref={listRef}
    >
      {suggestions.slice(0, 20).map((s, i) => (
        <button
          key={`${s.type}-${s.label}`}
          className={`flex w-full items-center justify-between px-2 py-1 text-left text-xs hover:bg-[hsl(var(--accent))] ${
            i === selectedIndex ? "bg-[hsl(var(--accent))]" : ""
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(s);
          }}
        >
          <span className="truncate">{s.label}</span>
          <span className="flex items-center gap-1 shrink-0 ml-2">
            {s.detail && (
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {s.detail}
              </span>
            )}
            <span className={`text-[9px] font-mono ${TYPE_COLORS[s.type] ?? ""}`}>
              {TYPE_LABELS[s.type] ?? s.type}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
