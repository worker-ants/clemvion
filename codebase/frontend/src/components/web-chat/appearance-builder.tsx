"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n";
import type { WebChatDraft } from "./use-appearance-draft";

interface Props {
  draft: WebChatDraft;
  onChange: (patch: Partial<WebChatDraft>) => void;
}

export function AppearanceBuilder({ draft, onChange }: Props) {
  const t = useT();

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("webChat.appearance.title")}</h3>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("webChat.appearance.note")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wc-color">{t("webChat.appearance.primaryColor")}</Label>
          <Input
            id="wc-color"
            type="color"
            value={draft.primaryColor}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            className="h-10 w-full p-1"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wc-position">{t("webChat.appearance.position")}</Label>
          <NativeSelect
            id="wc-position"
            value={draft.position}
            onChange={(e) =>
              onChange({ position: e.target.value as WebChatDraft["position"] })
            }
          >
            <option value="bottom-right">
              {t("webChat.appearance.positionBottomRight")}
            </option>
            <option value="bottom-left">
              {t("webChat.appearance.positionBottomLeft")}
            </option>
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-header">{t("webChat.appearance.headerTitle")}</Label>
        <Input
          id="wc-header"
          value={draft.headerTitle}
          placeholder={t("webChat.appearance.headerTitlePlaceholder")}
          onChange={(e) => onChange({ headerTitle: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-welcome">{t("webChat.appearance.welcomeText")}</Label>
        <Input
          id="wc-welcome"
          value={draft.welcomeText}
          placeholder={t("webChat.appearance.welcomeTextPlaceholder")}
          onChange={(e) => onChange({ welcomeText: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-suggestions">{t("webChat.appearance.suggestions")}</Label>
        <textarea
          id="wc-suggestions"
          value={draft.suggestions}
          rows={3}
          onChange={(e) => onChange({ suggestions: e.target.value })}
          className="flex w-full rounded-md border border-[hsl(var(--input))] bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
        />
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          {t("webChat.appearance.suggestionsHint")}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wc-disclaimer">{t("webChat.appearance.disclaimer")}</Label>
        <Input
          id="wc-disclaimer"
          value={draft.disclaimer}
          placeholder={t("webChat.appearance.disclaimerPlaceholder")}
          onChange={(e) => onChange({ disclaimer: e.target.value })}
        />
      </div>
    </section>
  );
}
