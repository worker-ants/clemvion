"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  TransformOperation,
  TransformOperationType,
} from "@/types/transform";
import { TRANSFORM_OPERATION_TYPES } from "@/types/transform";
import { defaultForType } from "./defaults";

export interface OperationCardProps {
  id: string;
  index: number;
  op: TransformOperation;
  onChange: (op: TransformOperation) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  children: React.ReactNode;
}

export function OperationCard({
  id,
  index,
  op,
  onChange,
  onRemove,
  onDuplicate,
  children,
}: OperationCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = TRANSFORM_OPERATION_TYPES.find((t) => t.value === op.type);

  const handleTypeChange = (next: TransformOperationType) => {
    if (next === op.type) return;
    onChange(defaultForType(next, op));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-1.5 rounded border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="cursor-grab touch-none p-0.5 text-[hsl(var(--muted-foreground))]"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
          >
            <GripVertical size={12} />
          </button>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Step {index + 1}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onDuplicate}
            aria-label="Duplicate"
          >
            <Copy size={10} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onRemove}
            aria-label="Remove"
          >
            <X size={10} />
          </Button>
        </div>
      </div>
      <select
        value={op.type}
        onChange={(e) =>
          handleTypeChange(e.target.value as TransformOperationType)
        }
        className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
      >
        {TRANSFORM_OPERATION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {meta && (
        <span className="text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">
          {meta.caption}
        </span>
      )}
      {children}
    </div>
  );
}
