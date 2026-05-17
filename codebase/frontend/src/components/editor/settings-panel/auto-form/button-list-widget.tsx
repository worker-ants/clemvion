"use client";

import { FieldGroup } from "../node-configs/shared";
import {
  ButtonListEditor,
  type ButtonDef,
} from "../node-configs/shared/button-list-editor";
import { useLocale } from "@/lib/i18n";
import { translateBackendHint } from "@/lib/i18n/backend-labels";
import type { WidgetProps } from "./widgets";

/** Auto-form widget wrapping ButtonListEditor for button arrays. */
export function ButtonListWidget({ ui, label, value, onChange }: WidgetProps) {
  const locale = useLocale();
  const buttons = (value as ButtonDef[]) ?? [];
  return (
    <FieldGroup label={label} hint={translateBackendHint(ui?.hint, locale)}>
      <ButtonListEditor
        buttons={buttons}
        onChange={(updated) => onChange(updated)}
      />
    </FieldGroup>
  );
}
