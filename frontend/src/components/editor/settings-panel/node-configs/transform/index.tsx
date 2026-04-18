"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "../shared";
import { useT } from "@/lib/i18n";
import type { TransformOperation } from "@/types/transform";
import { OperationCard } from "./operation-card";
import { defaultForType } from "./defaults";
import { TransformPreview } from "./preview";
import {
  ArrayFilterFields,
  ArraySortFields,
  DateOpFields,
  MathOpFields,
  ObjectOmitFields,
  ObjectPickFields,
  RemoveFieldFields,
  RenameFieldFields,
  SetFieldFields,
  StringOpFields,
  TypeConvertFields,
} from "./ops";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

function renderOpFields(
  op: TransformOperation,
  onChange: (next: TransformOperation) => void,
) {
  switch (op.type) {
    case "rename_field":
      return <RenameFieldFields op={op} onChange={onChange} />;
    case "remove_field":
      return <RemoveFieldFields op={op} onChange={onChange} />;
    case "set_field":
      return <SetFieldFields op={op} onChange={onChange} />;
    case "type_convert":
      return <TypeConvertFields op={op} onChange={onChange} />;
    case "string_op":
      return <StringOpFields op={op} onChange={onChange} />;
    case "math_op":
      return <MathOpFields op={op} onChange={onChange} />;
    case "date_op":
      return <DateOpFields op={op} onChange={onChange} />;
    case "array_filter":
      return <ArrayFilterFields op={op} onChange={onChange} />;
    case "array_sort":
      return <ArraySortFields op={op} onChange={onChange} />;
    case "object_pick":
      return <ObjectPickFields op={op} onChange={onChange} />;
    case "object_omit":
      return <ObjectOmitFields op={op} onChange={onChange} />;
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Math.random().toString(36).slice(2, 10)}`;
}

type Entry = { id: string; op: TransformOperation };

export function TransformConfig({
  config,
  onChange,
}: {
  config: Config;
  onChange: OnChange;
}) {
  const t = useT();
  const incoming = useMemo<TransformOperation[]>(
    () => (config.operations as TransformOperation[]) ?? [],
    [config.operations],
  );

  // Local source of truth: each entry pairs an operation with a stable id for
  // dnd-kit. Syncs from `incoming` only when the parent passes a different
  // array reference (external reload / undo). Reference equality on both the
  // array and its op objects is the trigger — our own commits always pass the
  // same op refs we already stored, so this path is skipped for internal edits.
  const [entries, setEntries] = useState<Entry[]>(() =>
    incoming.map((op) => ({ id: makeId(), op })),
  );
  const [syncedIncoming, setSyncedIncoming] = useState(incoming);
  if (
    syncedIncoming !== incoming &&
    (entries.length !== incoming.length ||
      entries.some((e, i) => e.op !== incoming[i]))
  ) {
    setSyncedIncoming(incoming);
    setEntries((prev) =>
      incoming.map((op) => {
        const matching = prev.find((e) => e.op === op);
        return { id: matching?.id ?? makeId(), op };
      }),
    );
  } else if (syncedIncoming !== incoming) {
    setSyncedIncoming(incoming);
  }

  const commit = useCallback(
    (next: Entry[]) => {
      setEntries(next);
      onChange({ ...config, operations: next.map((e) => e.op) });
    },
    [onChange, config],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = entries.findIndex((e) => e.id === active.id);
    const newIndex = entries.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = [...entries];
    const [moved] = next.splice(oldIndex, 1);
    next.splice(newIndex, 0, moved);
    commit(next);
  };

  const addOperation = () => {
    commit([...entries, { id: makeId(), op: defaultForType("set_field") }]);
  };

  const duplicateOperation = (i: number) => {
    const next = [...entries];
    next.splice(i + 1, 0, {
      id: makeId(),
      op: structuredClone(entries[i].op),
    });
    commit(next);
  };

  const removeOperation = (i: number) => {
    commit(entries.filter((_, idx) => idx !== i));
  };

  const updateOperation = (i: number, op: TransformOperation) => {
    commit(entries.map((e, idx) => (idx === i ? { ...e, op } : e)));
  };

  const ids = entries.map((e) => e.id);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{t("nodeConfigs.transform.operations")}</SectionTitle>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <OperationCard
                key={entry.id}
                id={entry.id}
                index={i}
                op={entry.op}
                onChange={(next) => updateOperation(i, next)}
                onRemove={() => removeOperation(i)}
                onDuplicate={() => duplicateOperation(i)}
              >
                {renderOpFields(entry.op, (next) => updateOperation(i, next))}
              </OperationCard>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={addOperation}
      >
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.transform.addOperation")}
      </Button>
      <TransformPreview operations={entries.map((e) => e.op)} />
    </div>
  );
}
