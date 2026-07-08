"use client";

import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AuthConfigFormFields } from "./auth-config-form-fields";
import type { UseAuthConfigForm } from "./use-auth-config-form";

/**
 * 인증 설정 **편집** 다이얼로그. type·비밀값 불변(type select 잠금, password 입력 없음) —
 * name·non-secret config·IP 화이트리스트만 PATCH 한다. 생성 흐름은 AuthConfigCreateForm.
 */
interface AuthConfigEditDialogProps {
  form: UseAuthConfigForm;
  isPending: boolean;
  onUpdate: () => void;
}

export function AuthConfigEditDialog({
  form,
  isPending,
  onUpdate,
}: AuthConfigEditDialogProps) {
  const t = useT();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("authentication.editConfigDialogTitle")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={form.close}
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="space-y-4">
          <AuthConfigFormFields
            form={form}
            typeDisabled={true}
            showTypeLockedHint={true}
            showPassword={false}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={form.close}>
              {t("common.cancel")}
            </Button>
            <Button onClick={onUpdate} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
