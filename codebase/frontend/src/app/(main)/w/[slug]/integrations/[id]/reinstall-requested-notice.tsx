"use client";

import { formatDate } from "@/lib/utils/date";
import type { TFunction } from "@/lib/i18n";

/**
 * Cafe24 Private 재설치 대기 안내 (Inline Alert, info 톤).
 *
 * Cafe24 Private 앱은 우리 쪽에서 동의 화면을 열 수 없다. 권한 추가 · 재인증은 행에
 * `reinstallRequestedAt` 표시만 남기고, 사용자가 Cafe24 Developers 에서 '테스트 실행'을
 * 눌러야 App URL 이 OAuth 로 이어진다. 표시는 콜백이 성공하면 지워지고 그때까지 행의
 * `status` 와 토큰은 그대로라 실행도 계속된다. 그래서 상태 배지와 따로 이 안내를 둔다.
 * 표시가 없으면 `null`. NERV CLE-INT-OAUTH · CLE-T-NNENG8.
 */
export function ReinstallRequestedNotice({
  reinstallRequestedAt,
  t,
}: {
  reinstallRequestedAt: string | null | undefined;
  t: TFunction;
}) {
  if (!reinstallRequestedAt) return null;
  return (
    <div
      role="status"
      className="rounded-lg border border-blue-300 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950"
    >
      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
        {t("integrations.cafe24ReinstallRequestedTitle")}
      </p>
      <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
        {t("integrations.cafe24ReinstallRequestedDesc")}
      </p>
      <p className="mt-1 text-xs text-blue-800 dark:text-blue-300">
        {t("integrations.cafe24ReinstallRequestedAt", {
          at: formatDate(reinstallRequestedAt, "datetime"),
        })}
      </p>
    </div>
  );
}
