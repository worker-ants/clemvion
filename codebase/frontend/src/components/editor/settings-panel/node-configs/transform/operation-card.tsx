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
import { useT, type TFunction, type TranslationKey } from "@/lib/i18n";

/**
 * Map operation `value` → i18n dict key suffix (camelCase). Keeping the lookup
 * tables here (rather than re-exporting from `types/transform`) so the data
 * layer stays free of UI presentation concerns.
 */
const OPERATION_LABEL_KEY: Record<TransformOperationType, TranslationKey> = {
  rename_field: "nodeConfigs.transform.operationType.renameFieldLabel",
  remove_field: "nodeConfigs.transform.operationType.removeFieldLabel",
  set_field: "nodeConfigs.transform.operationType.setFieldLabel",
  type_convert: "nodeConfigs.transform.operationType.typeConvertLabel",
  string_op: "nodeConfigs.transform.operationType.stringOpLabel",
  math_op: "nodeConfigs.transform.operationType.mathOpLabel",
  date_op: "nodeConfigs.transform.operationType.dateOpLabel",
  array_filter: "nodeConfigs.transform.operationType.arrayFilterLabel",
  array_sort: "nodeConfigs.transform.operationType.arraySortLabel",
  object_pick: "nodeConfigs.transform.operationType.objectPickLabel",
  object_omit: "nodeConfigs.transform.operationType.objectOmitLabel",
};

const OPERATION_CAPTION_KEY: Record<TransformOperationType, TranslationKey> = {
  rename_field: "nodeConfigs.transform.operationType.renameFieldCaption",
  remove_field: "nodeConfigs.transform.operationType.removeFieldCaption",
  set_field: "nodeConfigs.transform.operationType.setFieldCaption",
  type_convert: "nodeConfigs.transform.operationType.typeConvertCaption",
  string_op: "nodeConfigs.transform.operationType.stringOpCaption",
  math_op: "nodeConfigs.transform.operationType.mathOpCaption",
  date_op: "nodeConfigs.transform.operationType.dateOpCaption",
  array_filter: "nodeConfigs.transform.operationType.arrayFilterCaption",
  array_sort: "nodeConfigs.transform.operationType.arraySortCaption",
  object_pick: "nodeConfigs.transform.operationType.objectPickCaption",
  object_omit: "nodeConfigs.transform.operationType.objectOmitCaption",
};

export function operationLabel(t: TFunction, type: TransformOperationType): string {
  return t(OPERATION_LABEL_KEY[type]);
}

export function operationCaption(t: TFunction, type: TransformOperationType): string {
  return t(OPERATION_CAPTION_KEY[type]);
}

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
  const t = useT();
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
            aria-label={t("nodeConfigs.transform.dragToReorder")}
          >
            <GripVertical size={12} />
          </button>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
            {t("nodeConfigs.transform.stepLabel", { index: index + 1 })}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onDuplicate}
            aria-label={t("nodeConfigs.transform.duplicateStep")}
          >
            <Copy size={10} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={onRemove}
            aria-label={t("nodeConfigs.transform.removeStep")}
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
        {TRANSFORM_OPERATION_TYPES.map((type) => (
          <option key={type} value={type}>
            {operationLabel(t, type)}
          </option>
        ))}
      </select>
      <span className="text-[10px] leading-tight text-[hsl(var(--muted-foreground))]">
        {operationCaption(t, op.type)}
      </span>
      {children}
    </div>
  );
}
