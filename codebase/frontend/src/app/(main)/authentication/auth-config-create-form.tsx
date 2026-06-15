"use client";

import { Button } from "@/components/ui/button";
import { Loader2, X, Copy } from "lucide-react";
import { useT } from "@/lib/i18n";
import { AuthConfigFormFields } from "./auth-config-form-fields";
import type { UseAuthConfigForm } from "./use-auth-config-form";

/**
 * 인증 설정 **생성** 다이얼로그. type 선택 자유 + basic_auth password 입력 가능 +
 * 발급 직후 평문 비밀값(generatedKey) 1회 표시. 편집 흐름은 AuthConfigEditDialog 가 담당.
 */
interface AuthConfigCreateFormProps {
  form: UseAuthConfigForm;
  isPending: boolean;
  onCreate: () => void;
  onCopy: (text: string) => void;
}

export function AuthConfigCreateForm({
  form,
  isPending,
  onCreate,
  onCopy,
}: AuthConfigCreateFormProps) {
  const t = useT();
  // 로컬 const 로 구조분해해 generatedKey 의 narrowing 이 onClick 클로저에서도 유지되게 한다.
  const { generatedKey } = form;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("authentication.addConfigDialogTitle")}
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
        {generatedKey ? (
          <div className="space-y-4">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {t("authentication.saveKeyNotice")}
            </p>
            <div className="flex items-center gap-2 rounded-md bg-[hsl(var(--muted))] p-3">
              <code className="flex-1 break-all text-sm">{generatedKey}</code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onCopy(generatedKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end">
              <Button onClick={form.close}>{t("authentication.done")}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AuthConfigFormFields
              form={form}
              typeDisabled={false}
              showTypeLockedHint={false}
              showPassword={true}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={form.close}>
                {t("common.cancel")}
              </Button>
              <Button onClick={onCreate} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {t("common.create")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
