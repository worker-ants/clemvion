import { describe, it, expect } from "vitest";
import type { TFunction } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import { formatIntegrationErrorToast } from "../integration-error-codes";

/*
 * 통합 추가 화면의 오류 토스트 — NERV CLE-INT-MANAGE 「오류 코드」 · CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」,
 * Task CLE-T-EDQYGH. 서버의 전역 예외 필터는 오류를 `{error:{code,message,details}}` 로 감싸서 낸다.
 */

/** 키와 인자를 그대로 드러내는 가짜 번역 함수. 어떤 키를 어떤 인자로 골랐는지 본다. */
const t: TFunction = (key, params) =>
  params ? `${key}${JSON.stringify(params)}` : key;

const FALLBACK = "integrations.oauthStartFailed" as const;

function axiosError(
  data: unknown,
  message = "Request failed with status code 409",
) {
  return Object.assign(new Error(message), { response: { data } });
}

const wrapped = (code: string, message?: string, details?: unknown) =>
  axiosError({
    error: {
      code,
      ...(message ? { message } : {}),
      ...(details ? { details } : {}),
    },
  });

describe("formatIntegrationErrorToast", () => {
  it.each([
    [
      "CAFE24_PRIVATE_APP_ALREADY_CONNECTED",
      "integrations.cafe24DuplicateMallToast",
    ],
    [
      "CAFE24_PRIVATE_APP_INSTALL_PENDING",
      "integrations.cafe24InstallPendingByOtherToast",
    ],
    [
      "MAKESHOP_INSTALL_PENDING",
      "integrations.makeshopInstallPendingByOtherToast",
    ],
    ["EDITOR_REQUIRED", "integrations.editorRequiredToast"],
    ["ADMIN_REQUIRED", "integrations.adminRequiredToast"],
  ])(
    "감싼 응답의 %s 를 번역 문구로 바꾸고 서버 문구는 괄호에 둔다",
    (code, key) => {
      expect(
        formatIntegrationErrorToast(wrapped(code, "서버 문구"), t, FALLBACK),
      ).toBe(`${key} (서버 문구)`);
    },
  );

  it("평탄한 응답의 코드도 읽는다", () => {
    const err = axiosError({ code: "ADMIN_REQUIRED", message: "서버 문구" });
    expect(formatIntegrationErrorToast(err, t, FALLBACK)).toBe(
      "integrations.adminRequiredToast (서버 문구)",
    );
  });

  it("설치 대기 409 는 설치 기한을 화면 시각으로 붙인다", () => {
    const expiresAt = "2026-10-30T03:00:00.000Z";
    const err = wrapped("MAKESHOP_INSTALL_PENDING", "서버 문구", {
      pendingInstallExpiresAt: expiresAt,
    });
    const retry = t("integrations.retryAfterPendingInstallExpiry", {
      expiresAt: formatDate(expiresAt, "datetime"),
    });
    expect(formatIntegrationErrorToast(err, t, FALLBACK)).toBe(
      `integrations.makeshopInstallPendingByOtherToast ${retry} (서버 문구)`,
    );
  });

  it.each([
    ["details 가 없다", undefined],
    ["기한이 문자열이 아니다", { pendingInstallExpiresAt: 123 }],
  ])("설치 기한을 못 읽으면(%s) 기한 문장을 빼고 보인다", (_label, details) => {
    const err = wrapped(
      "CAFE24_PRIVATE_APP_INSTALL_PENDING",
      undefined,
      details,
    );
    expect(formatIntegrationErrorToast(err, t, FALLBACK)).toBe(
      "integrations.cafe24InstallPendingByOtherToast",
    );
  });

  it("매핑에 없는 코드는 서버 문구를 그대로 보인다", () => {
    expect(
      formatIntegrationErrorToast(
        wrapped("VALIDATION_ERROR", "이름이 비었습니다"),
        t,
        FALLBACK,
      ),
    ).toBe("이름이 비었습니다");
  });

  it("응답 본문이 없으면 오류 메시지, 그것도 없으면 대체 문구다", () => {
    expect(
      formatIntegrationErrorToast(new Error("Network Error"), t, FALLBACK),
    ).toBe("Network Error");
    expect(formatIntegrationErrorToast({}, t, FALLBACK)).toBe(FALLBACK);
    expect(formatIntegrationErrorToast(null, t, FALLBACK)).toBe(FALLBACK);
  });
});
