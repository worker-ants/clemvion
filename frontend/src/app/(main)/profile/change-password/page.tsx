"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { axiosMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useT, useLocale } from "@/lib/i18n";

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function ChangePasswordPageInner() {
  const t = useT();
  const router = useRouter();
  const currentErrId = useId();
  const newErrId = useId();
  const confirmErrId = useId();
  const [isPending, setIsPending] = useState(false);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("profile.enterCurrentPassword")),
          newPassword: z
            .string()
            .min(8, t("profile.changePasswordMinLength"))
            .max(100, t("profile.changePasswordMaxLength")),
          confirmPassword: z.string().min(1, t("profile.enterConfirmPassword")),
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          message: t("profile.passwordsDoNotMatch"),
          path: ["confirmPassword"],
        }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: FormValues) {
    setIsPending(true);
    try {
      await apiClient.post("/users/me/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      setIsPending(false);
      toast.success(t("profile.changePasswordSuccess"));
      router.push("/profile");
    } catch (err) {
      toast.error(axiosMessage(err, t("profile.saveFailed")));
      setIsPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card>
        <CardHeader>
          <CardTitle as="h1">{t("profile.changePasswordPageTitle")}</CardTitle>
          <CardDescription>
            {t("profile.changePasswordPageDescription")}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">
                {t("profile.currentPassword")}
              </Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.currentPassword ? "true" : undefined}
                aria-describedby={
                  errors.currentPassword ? currentErrId : undefined
                }
                placeholder={t("profile.currentPasswordPlaceholder")}
                {...register("currentPassword")}
              />
              {errors.currentPassword && (
                <p
                  id={currentErrId}
                  role="alert"
                  className="text-sm text-[hsl(var(--destructive))]"
                >
                  {errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">{t("profile.newPassword")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.newPassword ? "true" : undefined}
                aria-describedby={errors.newPassword ? newErrId : undefined}
                placeholder={t("profile.newPasswordPlaceholder")}
                {...register("newPassword")}
              />
              {errors.newPassword && (
                <p
                  id={newErrId}
                  role="alert"
                  className="text-sm text-[hsl(var(--destructive))]"
                >
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">
                {t("profile.confirmPassword")}
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={errors.confirmPassword ? "true" : undefined}
                aria-describedby={
                  errors.confirmPassword ? confirmErrId : undefined
                }
                placeholder={t("profile.confirmPasswordPlaceholder")}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && (
                <p
                  id={confirmErrId}
                  role="alert"
                  className="text-sm text-[hsl(var(--destructive))]"
                >
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.push("/profile")}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("profile.changePasswordSubmit")}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

export default function ChangePasswordPage() {
  // locale 변경 시 강제 리마운트 — useMemo 안의 zod 스키마가 새 locale 의 t() 로
  // 검증 메시지를 다시 빌드하도록. 기존 폼 입력값 초기화는 의도된 부수효과.
  const locale = useLocale();
  return <ChangePasswordPageInner key={locale} />;
}
