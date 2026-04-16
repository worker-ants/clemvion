"use client";

import { FieldGroup } from "../node-configs/shared";
import {
  ButtonListEditor,
  type ButtonDef,
} from "../node-configs/shared/button-list-editor";
import type { WidgetProps } from "./widgets";

/** Auto-form widget wrapping ButtonListEditor for button arrays. */
export function ButtonListWidget({ ui, label, value, onChange }: WidgetProps) {
  const buttons = (value as ButtonDef[]) ?? [];
  return (
    <FieldGroup label={label} hint={ui?.hint}>
      <ButtonListEditor
        buttons={buttons}
        onChange={(updated) => onChange(updated)}
      />
    </FieldGroup>
  );
}
