"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n";

export function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setDraft("");
  };

  const remove = (i: number) =>
    onChange(values.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px]"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
              aria-label={t("nodeConfigs.chipInput.removeAria", { value: v })}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) {
            const pending = v.slice(0, -1).trim();
            if (pending && !values.includes(pending)) {
              onChange([...values, pending]);
            }
            setDraft("");
            return;
          }
          setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (
            e.key === "Backspace" &&
            draft === "" &&
            values.length > 0
          ) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={placeholder ?? t("nodeConfigs.chipInput.placeholder")}
        className="h-7 text-xs"
      />
    </div>
  );
}
