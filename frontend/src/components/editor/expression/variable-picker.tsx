"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Braces, ChevronRight, ChevronDown } from "lucide-react";
import type { ExpressionData } from "./use-expression-context";

interface VariablePickerProps {
  expressionData: ExpressionData;
  onInsert: (expressionText: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TYPE_COLORS: Record<string, string> = {
  variable: "text-blue-400",
  field: "text-green-400",
  node: "text-orange-400",
  function: "text-purple-400",
};

const BUILT_IN_VARIABLES = [
  { label: "$execution", insert: "$execution", detail: "Execution context" },
  { label: "$now", insert: "$now", detail: "Current timestamp" },
  { label: "$today", insert: "$today", detail: "Current date" },
  { label: "$loop", insert: "$loop", detail: "Loop context" },
  { label: "$item", insert: "$item", detail: "ForEach current item" },
  { label: "$itemIndex", insert: "$itemIndex", detail: "ForEach index" },
];

function CategoryHeader({
  label,
  expanded,
  onToggle,
  count,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]"
    >
      {expanded ? (
        <ChevronDown className="h-3 w-3" />
      ) : (
        <ChevronRight className="h-3 w-3" />
      )}
      <span className="flex-1 text-left">{label}</span>
      <span className="text-[9px] font-normal">{count}</span>
    </button>
  );
}

function PickerItem({
  label,
  detail,
  colorClass,
  onClick,
}: {
  label: string;
  detail?: string;
  colorClass?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-1 px-3 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
    >
      <span className={`truncate ${colorClass ?? ""}`}>{label}</span>
      {detail && (
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
          {detail}
        </span>
      )}
    </button>
  );
}

function NodeSection({
  node,
  onInsert,
}: {
  node: { label: string; type: string; outputFields: string[] };
  onInsert: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (node.outputFields.length > 0) {
            setExpanded(!expanded);
          } else {
            onInsert(`$node["${node.label}"].output`);
          }
        }}
        className="flex w-full items-center gap-1 px-3 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
      >
        {node.outputFields.length > 0 ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="flex-1 truncate text-orange-400">{node.label}</span>
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
          {node.type}
        </span>
      </button>
      {expanded &&
        node.outputFields.map((field) => (
          <PickerItem
            key={field}
            label={`.${field}`}
            colorClass="text-green-400 pl-4"
            onClick={() =>
              onInsert(`$node["${node.label}"].output.${field}`)
            }
          />
        ))}
      {expanded && node.outputFields.length === 0 && (
        <div className="px-6 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          No output fields (run workflow first)
        </div>
      )}
    </div>
  );
}

export function VariablePicker({
  expressionData,
  onInsert,
  open,
  onOpenChange,
}: VariablePickerProps) {
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({
    $input: true,
    $node: true,
    $var: true,
    builtin: false,
    functions: false,
  });

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const handleInsert = (text: string) => {
    onInsert(text);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          tabIndex={-1}
          title="Insert variable"
        >
          <Braces className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[280px] max-h-[360px] overflow-y-auto p-0"
      >
        <div className="border-b border-[hsl(var(--border))] px-3 py-2">
          <p className="text-xs font-medium">Insert Variable</p>
        </div>

        {/* $input section */}
        {expressionData.inputFields.length > 0 && (
          <div>
            <CategoryHeader
              label="$input"
              expanded={expandedCategories.$input ?? true}
              onToggle={() => toggleCategory("$input")}
              count={expressionData.inputFields.length}
            />
            {expandedCategories.$input &&
              expressionData.inputFields.map((field) => (
                <PickerItem
                  key={field}
                  label={`$input.${field}`}
                  colorClass={TYPE_COLORS.field}
                  onClick={() => handleInsert(`$input.${field}`)}
                />
              ))}
          </div>
        )}

        {/* $node section */}
        {expressionData.availableNodes.length > 0 && (
          <div>
            <CategoryHeader
              label="$node"
              expanded={expandedCategories.$node ?? true}
              onToggle={() => toggleCategory("$node")}
              count={expressionData.availableNodes.length}
            />
            {expandedCategories.$node &&
              expressionData.availableNodes.map((node) => (
                <NodeSection
                  key={node.id}
                  node={node}
                  onInsert={handleInsert}
                />
              ))}
          </div>
        )}

        {/* $var section */}
        {expressionData.variables.length > 0 && (
          <div>
            <CategoryHeader
              label="$var"
              expanded={expandedCategories.$var ?? true}
              onToggle={() => toggleCategory("$var")}
              count={expressionData.variables.length}
            />
            {expandedCategories.$var &&
              expressionData.variables.map((v) => (
                <PickerItem
                  key={v.name}
                  label={`$var.${v.name}`}
                  detail={v.type}
                  colorClass={TYPE_COLORS.variable}
                  onClick={() => handleInsert(`$var.${v.name}`)}
                />
              ))}
          </div>
        )}

        {/* Built-in variables */}
        <div>
          <CategoryHeader
            label="Built-in"
            expanded={expandedCategories.builtin ?? false}
            onToggle={() => toggleCategory("builtin")}
            count={BUILT_IN_VARIABLES.length}
          />
          {expandedCategories.builtin &&
            BUILT_IN_VARIABLES.map((v) => (
              <PickerItem
                key={v.label}
                label={v.label}
                detail={v.detail}
                colorClass={TYPE_COLORS.variable}
                onClick={() => handleInsert(v.insert)}
              />
            ))}
        </div>

        {/* Functions */}
        {expressionData.functionNames.length > 0 && (
          <div>
            <CategoryHeader
              label="Functions"
              expanded={expandedCategories.functions ?? false}
              onToggle={() => toggleCategory("functions")}
              count={expressionData.functionNames.length}
            />
            {expandedCategories.functions &&
              expressionData.functionNames.map((fn) => (
                <PickerItem
                  key={fn}
                  label={`${fn}()`}
                  colorClass={TYPE_COLORS.function}
                  onClick={() => handleInsert(`${fn}(`)}
                />
              ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
