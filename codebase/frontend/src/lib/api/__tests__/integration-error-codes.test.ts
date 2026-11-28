import { describe, it, expect } from "vitest";
import type { TFunction } from "@/lib/i18n";
import { formatDate } from "@/lib/utils/date";
import {
  formatIntegrationErrorToast,
  formatOAuthCallbackError,
  isIntegrationNameTaken,
} from "../integration-error-codes";

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
    ["INTEGRATION_NAME_TAKEN", "integrations.nameTakenToast"],
    ["INTEGRATION_OWNER_NOT_MEMBER", "integrations.ownerNotMemberToast"],
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

  // 가드 거부 문구가 영문이 되어 한국어 화면이 영문을 보이지 않게 공용 매핑을 먼저 본다(NERV CLE-T-CHP94Z).
  it.each([
    ["NOT_A_MEMBER", "errors.codes.notAMember"],
    ["OWNER_REQUIRED", "errors.codes.ownerRequired"],
    ["WORKSPACE_NOT_FOUND", "errors.codes.workspaceNotFound"],
    // 5xx 는 서버가 message 를 고정 문구로 가리므로 코드로 고른다(CLE-T-KKJ2A0).
    ["OAUTH_CONFIG_MISSING", "errors.codes.oauthConfigMissing"],
  ])(
    "통합 표에 없고 공용 매핑에 있는 %s 는 공용 사전 문구 %s 만 보인다",
    (code, key) => {
      expect(
        formatIntegrationErrorToast(wrapped(code, "Server text."), t, FALLBACK),
      ).toBe(key);
    },
  );

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

describe("isIntegrationNameTaken", () => {
  it("감싼 응답과 평탄한 응답의 INTEGRATION_NAME_TAKEN 을 알아본다", () => {
    expect(isIntegrationNameTaken(wrapped("INTEGRATION_NAME_TAKEN"))).toBe(
      true,
    );
    expect(
      isIntegrationNameTaken(axiosError({ code: "INTEGRATION_NAME_TAKEN" })),
    ).toBe(true);
  });

  it("다른 코드나 본문 없는 오류는 이름 충돌이 아니다", () => {
    // 이 경로가 예전에 내던 코드다. 코드 값으로 분기하는 화면은 새 코드만 이름 충돌로 본다.
    expect(isIntegrationNameTaken(wrapped("RESOURCE_CONFLICT"))).toBe(false);
    expect(isIntegrationNameTaken(new Error("Network Error"))).toBe(false);
    expect(isIntegrationNameTaken(null)).toBe(false);
  });
});

/*
 * OAuth 콜백 팝업 실패 문구 — NERV CLE-INT-OAUTH-CALLBACK 「에러 매핑」, Task CLE-T-3WGPC0.
 * payload 의 `error` 는 서버 문구 문자열로 남고 `code` 가 따로 온다.
 */
describe("formatOAuthCallbackError", () => {
  it.each([
    ["OAUTH_DENIED", "integrations.oauthCallbackDenied"],
    ["OAUTH_STATE_MISMATCH", "integrations.oauthCallbackStateInvalid"],
    ["OAUTH_STATE_EXPIRED", "integrations.oauthCallbackStateExpired"],
    [
      "OAUTH_TOKEN_EXCHANGE_FAILED",
      "integrations.oauthCallbackTokenExchangeFailed",
    ],
    ["INTEGRATION_INSTALL_EXPIRED", "integrations.oauthCallbackInstallExpired"],
    ["OAUTH_CALLBACK_FAILED", "integrations.oauthFailedShort"],
  ])("콜백 코드 %s 는 %s 를 고른다", (code, key) => {
    expect(formatOAuthCallbackError({ code, error: "server text" }, t)).toBe(
      key,
    );
  });

  it("역할 하한 코드는 통합 코드 매핑을 쓴다", () => {
    expect(
      formatOAuthCallbackError({ code: "ADMIN_REQUIRED", error: "x" }, t),
    ).toBe("integrations.adminRequiredToast");
  });

  it("공용 코드 매핑에만 있는 코드는 공용 문구를 쓴다", () => {
    expect(
      formatOAuthCallbackError({ code: "INTERNAL_ERROR", error: "x" }, t),
    ).toBe("errors.codes.internalError");
  });

  it("모르는 코드는 서버 문구를 보인다", () => {
    expect(
      formatOAuthCallbackError(
        { code: "RESOURCE_NOT_FOUND", error: "Not found" },
        t,
      ),
    ).toBe("Not found");
  });

  it("코드가 없는 옛 payload 는 서버 문구를, 문구도 없으면 기본 문구를 보인다", () => {
    expect(formatOAuthCallbackError({ error: "boom" }, t)).toBe("boom");
    expect(formatOAuthCallbackError({ code: null, error: null }, t)).toBe(
      "integrations.oauthFailedShort",
    );
  });
});
