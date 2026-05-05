import type { TFunction } from "@/lib/i18n";

/**
 * 비밀번호 강도 — 단일 출처. register / reset-password 폼이 동일 알고리즘
 * 사용 (review W-6 — drift 방지).
 *
 * 점수 산출:
 *   - 8자 이상 +1
 *   - 소문자 / 대문자 / 숫자 / 특수문자 각 +1
 *
 * 점수 → 라벨/색 매핑:
 *   0~1: weak (red)
 *   2:   fair (orange)
 *   3:   good (yellow)
 *   4:   strong (green-400)
 *   5:   very strong (green-600)
 */
export interface PasswordStrength {
  score: number;
  label: string;
  /** Tailwind background-color 클래스 — strength bar 가 사용. */
  color: string;
}

export function getPasswordStrength(
  password: string,
  t: TFunction,
): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1)
    return { score, label: t("auth.register.strengthWeak"), color: "bg-red-500" };
  if (score <= 2)
    return {
      score,
      label: t("auth.register.strengthFair"),
      color: "bg-orange-500",
    };
  if (score <= 3)
    return {
      score,
      label: t("auth.register.strengthGood"),
      color: "bg-yellow-500",
    };
  if (score <= 4)
    return {
      score,
      label: t("auth.register.strengthStrong"),
      color: "bg-green-400",
    };
  return {
    score,
    label: t("auth.register.strengthVeryStrong"),
    color: "bg-green-600",
  };
}
