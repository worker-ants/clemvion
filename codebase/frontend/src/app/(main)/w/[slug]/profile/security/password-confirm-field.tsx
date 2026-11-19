"use client";

import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TFunction } from "@/lib/i18n";
import { useT } from "@/lib/i18n";
import { MIN_ACCOUNT_PASSWORD_LENGTH } from "@/lib/utils/password";

interface PasswordConfirmFieldProps {
  /** 입력 id. `label` 이 있으면 라벨이 이 id 를 가리킨다. */
  id?: string;
  /** 입력 위에 붙일 라벨. 없으면 입력만 그린다. */
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * 민감 작업 앞에서 계정 비밀번호를 다시 받는 입력이다(NERV Task `CLE-T-CJ7HB1`). 2단계 인증 설정 · 끄기와 Passkey 등록 ·
 * 복구 코드 재발급 · 삭제가 같은 입력을 쓴다. 제출 전 검사는 `confirmPasswordOrToast` 로 한다.
 */
export function PasswordConfirmField({
  id,
  label,
  value,
  onChange,
  className,
}: PasswordConfirmFieldProps) {
  const t = useT();
  const input = (
    <Input
      id={id}
      type="password"
      autoComplete="current-password"
      placeholder={t("profile.security.accountPasswordPlaceholder")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
  if (!label) return input;
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      {input}
    </>
  );
}

/**
 * 비밀번호 확인 입력을 제출해도 되는지 본다. 최소 길이보다 짧으면 안내 토스트를 띄우고 `false` 를 돌려준다.
 * 서버도 같은 최소 길이로 거르므로(400) 보내기 전에 막는다.
 */
export function confirmPasswordOrToast(
  password: string,
  t: TFunction,
): boolean {
  if (password.length >= MIN_ACCOUNT_PASSWORD_LENGTH) return true;
  toast.error(t("profile.security.passwordRequired"));
  return false;
}
