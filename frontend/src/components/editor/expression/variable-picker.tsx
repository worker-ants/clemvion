import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Braces, ChevronRight, ChevronDown } from "lucide-react";
import type { ExpressionData } from "./use-expression-context";
import { getValueType } from "./resolve-nested-path";
import { BUILT_IN_PICKER_VARIABLES } from "./expression-constants";

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

const MAX_NESTING_DEPTH = 5;

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

function NestedFieldItem({
  fieldName,
  parentPath,
  sample,
  onInsert,
  depth,
}: {
  fieldName: string;
  parentPath: string;
  sample: Record<string, unknown>;
  onInsert: (text: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullPath = `${parentPath}.${fieldName}`;
  const value = sample[fieldName];
  const typeLabel = getValueType(value);

  // Determine if this field can be expanded (object or array of objects)
  let isExpandable = false;
  let childSample: Record<string, unknown> | null = null;

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    isExpandable = Object.keys(value as Record<string, unknown>).length > 0;
    childSample = value as Record<string, unknown>;
  } else if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      isExpandable = Object.keys(first as Record<string, unknown>).length > 0;
      childSample = first as Record<string, unknown>;
    }
  }

  // Respect max nesting depth
  if (depth >= MAX_NESTING_DEPTH) isExpandable = false;

  const paddingLeft = 12 + depth * 12;

  if (!isExpandable) {
    return (
      <button
        type="button"
        onClick={() => onInsert(fullPath)}
        className="flex w-full items-center justify-between gap-1 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
        style={{ paddingLeft, paddingRight: 12 }}
      >
        <span className="truncate text-green-400">.{fieldName}</span>
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
          {typeLabel}
        </span>
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
        style={{ paddingLeft, paddingRight: 12 }}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
        )}
        <span className="flex-1 truncate text-green-400">.{fieldName}</span>
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
          {typeLabel}
        </span>
      </button>
      {expanded &&
        childSample &&
        Object.keys(childSample).map((key) => (
          <NestedFieldItem
            key={key}
            fieldName={key}
            parentPath={fullPath}
            sample={childSample}
            onInsert={onInsert}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

function NodeSection({
  node,
  onInsert,
}: {
  node: {
    label: string;
    resolvedKey: string;
    type: string;
    outputFields: string[];
    outputSample: Record<string, unknown>;
  };
  onInsert: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const basePath = `$node["${node.resolvedKey}"].output`;
  const hasFields = Object.keys(node.outputSample).length > 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (hasFields) {
            setExpanded(!expanded);
          } else {
            onInsert(basePath);
          }
        }}
        className="flex w-full items-center gap-1 px-3 py-1 text-left text-xs hover:bg-[hsl(var(--accent))]"
      >
        {hasFields ? (
          expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-[hsl(var(--muted-foreground))]" />
          )
        ) : (
          <span className="w-3" />
        )}
        <span className="flex-1 truncate text-orange-400">{node.resolvedKey}</span>
        <span className="shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">
          {node.type}
        </span>
      </button>
      {expanded &&
        hasFields &&
        Object.keys(node.outputSample).map((field) => (
          <NestedFieldItem
            key={field}
            fieldName={field}
            parentPath={basePath}
            sample={node.outputSample}
            onInsert={onInsert}
            depth={0}
          />
        ))}
      {expanded && !hasFields && (
        <div className="px-6 py-1 text-[10px] text-[hsl(var(--muted-foreground))]">
          No output fields (run workflow first)
        </div>
      )}
    </div>
  );
}

function InputFieldSection({
  inputSample,
  onInsert,
}: {
  inputSample: Record<string, unknown>;
  onInsert: (text: string) => void;
}) {
  return (
    <>
      {Object.keys(inputSample).map((field) => (
        <NestedFieldItem
          key={field}
          fieldName={field}
          parentPath="$input"
          sample={inputSample}
          onInsert={onInsert}
          depth={0}
        />
      ))}
    </>
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
    $sourceItem: true,
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

  const inputFieldCount = Object.keys(expressionData.inputSample).length;

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
        {inputFieldCount > 0 && (
          <div>
            <CategoryHeader
              label="$input"
              expanded={expandedCategories.$input ?? true}
              onToggle={() => toggleCategory("$input")}
              count={inputFieldCount}
            />
            {expandedCategories.$input && (
              <InputFieldSection
                inputSample={expressionData.inputSample}
                onInsert={handleInsert}
              />
            )}
          </div>
        )}

        {/* $sourceItem section (table nodes only) */}
        {expressionData.isTableContext && (
          <div>
            <CategoryHeader
              label="$sourceItem"
              expanded={expandedCategories.$sourceItem ?? true}
              onToggle={() => toggleCategory("$sourceItem")}
              count={
                (expressionData.sourceItemSample
                  ? Object.keys(expressionData.sourceItemSample).length
                  : 0) + 3
              }
            />
            {expandedCategories.$sourceItem && (
              <>
                <PickerItem
                  label="$sourceItem"
                  detail="Current row item"
                  colorClass={TYPE_COLORS.variable}
                  onClick={() => handleInsert("$sourceItem")}
                />
                {expressionData.sourceItemSample &&
                  Object.keys(expressionData.sourceItemSample).map((field) => (
                    <NestedFieldItem
                      key={field}
                      fieldName={field}
                      parentPath="$sourceItem"
                      sample={expressionData.sourceItemSample!}
                      onInsert={handleInsert}
                      depth={0}
                    />
                  ))}
                <PickerItem
                  label="$sourceItemIndex"
                  detail="number"
                  colorClass={TYPE_COLORS.variable}
                  onClick={() => handleInsert("$sourceItemIndex")}
                />
                <PickerItem
                  label="$dataSource"
                  detail="array"
                  colorClass={TYPE_COLORS.variable}
                  onClick={() => handleInsert("$dataSource")}
                />
              </>
            )}
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
            count={BUILT_IN_PICKER_VARIABLES.length}
          />
          {expandedCategories.builtin &&
            BUILT_IN_PICKER_VARIABLES.map((v) => (
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
