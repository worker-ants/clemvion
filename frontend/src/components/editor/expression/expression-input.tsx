"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { validate } from "@workflow/expression-engine";
import { cn } from "@/lib/utils/cn";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useExpressionContext } from "./use-expression-context";
import { useExpressionSuggestions, type Suggestion } from "./use-expression-suggestions";
import { ExpressionAutocomplete } from "./expression-autocomplete";
import { ExpressionHighlight } from "./expression-highlight";

interface ExpressionInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}

const EXPR_BLOCK_RE = /\{\{.+?\}\}/g;

function validateExpressions(value: string): string | null {
  const matches = value.match(EXPR_BLOCK_RE);
  if (!matches) return null;

  for (const block of matches) {
    const result = validate(block);
    if (!result.valid && result.errors.length > 0) {
      return result.errors[0].message;
    }
  }
  return null;
}

export function ExpressionInput({
  label: fieldLabel,
  value,
  onChange,
  placeholder,
  hint,
  multiline = false,
  rows = 4,
  mono = false,
}: ExpressionInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [cursorPos, setCursorPos] = useState(0);
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const expressionData = useExpressionContext(selectedNodeId);
  const { suggestions, tokenStart, tokenEnd } = useExpressionSuggestions(
    value,
    cursorPos,
    expressionData,
  );

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      setValidationError(validateExpressions(value));
    }, 500);
    return () => clearTimeout(timer);
  }, [value]);

  // Show autocomplete when open AND there are suggestions
  const shouldShowAutocomplete = autocompleteOpen && suggestions.length > 0;

  // Clamp selected index to suggestions length
  const clampedIndex = suggestions.length > 0 ? Math.min(selectedIndex, suggestions.length - 1) : 0;

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(e.target.value);
      setCursorPos(e.target.selectionStart ?? 0);
      setAutocompleteOpen(true);
      setSelectedIndex(0);
    },
    [onChange],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setCursorPos((e.target as HTMLInputElement).selectionStart ?? 0);
    },
    [],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        setAutocompleteOpen(false);
        return;
      }
      setCursorPos((e.target as HTMLInputElement).selectionStart ?? 0);
    },
    [],
  );

  const handleSelect = useCallback(
    (suggestion: Suggestion) => {
      const before = value.slice(0, tokenStart);
      const after = value.slice(tokenEnd);
      const newValue = before + suggestion.insertText + after;
      onChange(newValue);

      const newCursor = tokenStart + suggestion.insertText.length;
      setCursorPos(newCursor);
      setAutocompleteOpen(false);

      // Restore focus + cursor
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(newCursor, newCursor);
        }
      });
    },
    [value, tokenStart, tokenEnd, onChange],
  );

  const handleNavigate = useCallback(
    (direction: "up" | "down") => {
      setSelectedIndex((prev) => {
        if (direction === "down") {
          return prev < suggestions.length - 1 ? prev + 1 : 0;
        }
        return prev > 0 ? prev - 1 : suggestions.length - 1;
      });
    },
    [suggestions.length],
  );

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAutocompleteOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasExpression = value.includes("{{");

  const inputClasses = cn(
    "w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-xs text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]",
    mono && "font-mono",
    validationError && "border-red-500/50",
  );

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <Label className="text-xs">{fieldLabel}</Label>
      <div className="relative">
        {/* Highlight overlay for expressions */}
        {hasExpression && (
          <div
            className={cn(
              "absolute inset-0 px-3 text-xs pointer-events-none overflow-hidden",
              multiline ? "py-2" : "flex items-center",
            )}
            aria-hidden
          >
            <ExpressionHighlight
              value={value}
              hasError={!!validationError}
            />
          </div>
        )}

        {multiline ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={handleInput}
            onClick={handleClick}
            onKeyUp={handleKeyUp}
            rows={rows}
            placeholder={placeholder}
            className={inputClasses}
          />
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={value}
            onChange={handleInput}
            onClick={handleClick}
            onKeyUp={handleKeyUp}
            placeholder={placeholder}
            className={cn(inputClasses, "h-8")}
          />
        )}

        <ExpressionAutocomplete
          suggestions={suggestions}
          selectedIndex={clampedIndex}
          onSelect={handleSelect}
          onNavigate={handleNavigate}
          visible={shouldShowAutocomplete}
          anchorRef={inputRef as React.RefObject<HTMLElement>}
        />
      </div>

      {validationError ? (
        <span className="text-[10px] text-red-400">{validationError}</span>
      ) : hint ? (
        <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
