import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import type { TFunction } from "@/lib/i18n";
import { en } from "@/lib/i18n/dict/en";
import { ko } from "@/lib/i18n/dict/ko";
import {
  SERVER_ERROR_CODE_TO_I18N,
  resolveServerError,
  serverErrorKey,
  serverErrorMessage,
} from "../server-error-messages";

/*
 * 서버 에러 코드 → 화면 문구 — NERV CLE-UI-I18N-BACKEND 규칙 5, Task CLE-T-MNX9KP · CLE-T-CHP94Z.
 * 서버의 전역 예외 필터는 오류를 `{error:{code,message,details}}` 로 감싸고 `message` 는 영문이다.
 */

/** 키를 그대로 돌려주는 가짜 번역 함수. 어떤 키를 골랐는지 본다. */
const t: TFunction = (key) => key;

const wrapped = (code: string, message = "Server text.") =>
  Object.assign(new Error("Request failed with status code 403"), {
    response: { data: { error: { code, message } } },
  });

function lookup(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Record<string, unknown>)[part];
  }, dict);
}

describe("serverErrorMessage", () => {
  it("아는 코드는 사전 문구를 고른다", () => {
    expect(serverErrorMessage(wrapped("NOT_A_MEMBER"), t, "fallback")).toBe(
      "errors.codes.notAMember",
    );
    expect(serverErrorMessage(wrapped("REAUTH_REQUIRED"), t, "fallback")).toBe(
      "errors.codes.reauthRequired",
    );
  });

  it("평탄한 {code, message} 본문의 코드도 읽는다", () => {
    const err = Object.assign(new Error("x"), {
      response: {
        data: { code: "WORKSPACE_NOT_FOUND", message: "Workspace not found." },
      },
    });
    expect(serverErrorMessage(err, t, "fallback")).toBe(
      "errors.codes.workspaceNotFound",
    );
  });

  it("모르는 코드는 서버 문구를 그대로 보인다", () => {
    expect(
      serverErrorMessage(wrapped("SOMETHING_ELSE", "Raw text."), t, "fallback"),
    ).toBe("Raw text.");
  });

  it("응답 본문이 없으면 fallback 이다(axios 오류 문구를 보이지 않는다)", () => {
    expect(serverErrorMessage(new Error("Network Error"), t, "fallback")).toBe(
      "fallback",
    );
    expect(serverErrorMessage(undefined, t, "fallback")).toBe("fallback");
  });

  it("서버가 message 를 가린 5xx 코드도 사전 문구를 고른다(CLE-T-KKJ2A0)", () => {
    const masked = "An unexpected error occurred. Please try again later.";
    expect(
      serverErrorMessage(
        wrapped("OAUTH_CONFIG_MISSING", masked),
        t,
        "fallback",
      ),
    ).toBe("errors.codes.oauthConfigMissing");
    expect(
      serverErrorMessage(wrapped("INTERNAL_ERROR", masked), t, "fallback"),
    ).toBe("errors.codes.internalError");
  });

  it("serverErrorKey 는 모르는 코드에 undefined 다", () => {
    expect(serverErrorKey(wrapped("SOMETHING_ELSE"))).toBeUndefined();
    expect(serverErrorKey(wrapped("TOTP_INVALID"))).toBe(
      "errors.codes.totpInvalid",
    );
  });

  it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])(
    "프로토타입 이름 %s 은 코드로 보지 않고 서버 문구를 보인다",
    (code) => {
      expect(serverErrorKey(wrapped(code))).toBeUndefined();
      expect(
        serverErrorMessage(wrapped(code, "Raw text."), t, "fallback"),
      ).toBe("Raw text.");
    },
  );
});

describe("워크스페이스 · 초대 · 사용자 코드 (CLE-T-MBMPX5)", () => {
  it("초대 흐름의 소문자 코드는 철자 그대로만 찾는다(대소문자를 접지 않는다)", () => {
    expect(serverErrorKey(wrapped("invitation_expired"))).toBe(
      "errors.codes.invitationExpired",
    );
    expect(serverErrorKey(wrapped("INVITATION_EXPIRED"))).toBeUndefined();
    expect(serverErrorKey(wrapped("Invitation_Expired"))).toBeUndefined();
  });

  it("같은 뜻의 대소문자 코드 둘은 같은 사전 문구를 고른다", () => {
    expect(serverErrorKey(wrapped("already_a_member"))).toBe(
      serverErrorKey(wrapped("ALREADY_A_MEMBER")),
    );
    expect(serverErrorKey(wrapped("workspace_not_found"))).toBe(
      serverErrorKey(wrapped("WORKSPACE_NOT_FOUND")),
    );
  });

  it("비밀번호가 없는 계정의 PASSWORD_REQUIRED 를 사전 문구로 고른다(비밀번호 변경 화면)", () => {
    expect(
      serverErrorMessage(
        wrapped("PASSWORD_REQUIRED", "This account has no password."),
        t,
        "fallback",
      ),
    ).toBe("errors.codes.passwordNotSet");
  });
});

describe("resolveServerError · overrides (CLE-T-7QQPK7)", () => {
  const overrides = {
    VALIDATION_ERROR: "auth.verifyEmail.genericFailed",
    NOT_A_MEMBER: "integrations.editorRequiredToast",
  } as const;

  it("overrides 를 공용 표보다 먼저 본다", () => {
    expect(resolveServerError(wrapped("NOT_A_MEMBER"), overrides)).toEqual({
      code: "NOT_A_MEMBER",
      key: "integrations.editorRequiredToast",
      source: "override",
      serverMessage: "Server text.",
    });
    expect(
      serverErrorMessage(wrapped("VALIDATION_ERROR"), t, "fallback", overrides),
    ).toBe("auth.verifyEmail.genericFailed");
  });

  it("overrides 에 없으면 공용 표를 본다", () => {
    expect(resolveServerError(wrapped("REAUTH_REQUIRED"), overrides)).toEqual({
      code: "REAUTH_REQUIRED",
      key: "errors.codes.reauthRequired",
      source: "shared",
      serverMessage: "Server text.",
    });
  });

  it("두 표에 다 없으면 키 없이 코드와 서버 문구만 돌려준다", () => {
    expect(resolveServerError(wrapped("SOMETHING_ELSE"), overrides)).toEqual({
      code: "SOMETHING_ELSE",
      serverMessage: "Server text.",
    });
  });

  it("overrides 의 프로토타입 이름도 키로 보지 않는다", () => {
    expect(
      resolveServerError(wrapped("constructor"), overrides).key,
    ).toBeUndefined();
  });

  it("응답이 아니면 빈 결과다", () => {
    expect(resolveServerError(new Error("Network Error"))).toEqual({});
    expect(resolveServerError("text")).toEqual({});
  });
});

describe("SERVER_ERROR_CODE_TO_I18N", () => {
  it.each(Object.entries(SERVER_ERROR_CODE_TO_I18N))(
    "%s 의 키 %s 가 ko · en 사전에 모두 있다",
    (_code, key) => {
      expect(typeof lookup(ko, key)).toBe("string");
      expect(typeof lookup(en, key)).toBe("string");
    },
  );

  it("공용 표의 키는 모두 errors.codes 아래다(화면 고유 키를 빌리지 않는다)", () => {
    const outside = Object.values(SERVER_ERROR_CODE_TO_I18N).filter(
      (key) => !key.startsWith("errors.codes."),
    );
    expect(outside).toEqual([]);
  });
});

/**
 * 서버 문구 언어 가드(`server-message-language-guard.ts`)의 범위 `SCANNED_PATHS` 가 내는 에러 코드가 매핑되거나 알고
 * 있는 예외 목록에 있는지 대조한다. 가드가 영문으로 묶은 범위와 같은 범위를 봐서, 영문 서버 문구가 한국어 화면에
 * 그대로 보이는 코드를 새로 만들 때 여기서 걸린다(NERV Task CLE-T-1K5CWP · CLE-T-7QQPK7).
 */
describe("백엔드 에러 코드 대조(가드 범위)", () => {
  /** 매핑 없이 서버 문구를 보이거나 화면이 직접 고르는 코드. 더하려면 사용자에게 보이는지 먼저 따진다. */
  const UNMAPPED_CODES = new Set([
    "ACCOUNT_LOCKED",
    "AUTH_CONFIG_NOT_FOUND",
    "CHAT_CHANNEL_ENDPOINT_REQUIRED",
    "CHAT_CHANNEL_NOT_CONFIGURED",
    "CHAT_CHANNEL_PROVIDER_UNKNOWN",
    "CHAT_CHANNEL_SETUP_FAILED",
    "EMAIL_VERIFICATION_REQUIRED",
    "FILE_REQUIRED",
    "INVALID_BOT_TOKEN",
    "INVALID_FILE_TYPE",
    "INVALID_FIELD",
    "INVALID_NOTIFICATION_URL",
    "LOGIN_FAILED",
    "NOTIFICATION_NOT_CONFIGURED",
    "NOT_PER_TRIGGER_STRATEGY",
    "NO_WORKSPACE_AVAILABLE",
    "OAUTH_ACCOUNT_AMBIGUOUS",
    "OAUTH_EMAIL_REQUIRED",
    "OAUTH_PROFILE_FAILED",
    "OAUTH_PROVIDER_UNKNOWN",
    "OAUTH_STATE_MISMATCH",
    "OAUTH_TOKEN_EXCHANGE_FAILED",
    "RESOURCE_CONFLICT",
    "RESOURCE_NOT_FOUND",
    "TOKEN_EXPIRED",
    "TOKEN_INVALID",
    "TOTP_NOT_INITIALIZED",
    "TRIGGER_ENDPOINT_PATH_CONFLICT",
    "UNAUTHENTICATED",
    "VALIDATION_ERROR",
    "WEBAUTHN_CREDENTIAL_EXISTS",
    "WEBAUTHN_CREDENTIAL_NOT_FOUND",
    "WEBAUTHN_INVALID",
    "WEBAUTHN_VERIFY_FAILED",
  ]);

  const backendSrc = path.resolve(__dirname, "../../../../../backend/src");

  /** 가드 파일의 `SCANNED_PATHS` 배열을 글자로 읽는다. 프런트 테스트가 백엔드 모듈을 import 하지 않게 한다. */
  function readScannedPaths(): string[] {
    const guard = fs.readFileSync(
      path.join(
        backendSrc,
        "repo-guards/__tests__/server-message-language-guard.ts",
      ),
      "utf8",
    );
    const body = /SCANNED_PATHS[^=]*=\s*\[([^\]]*)\]/.exec(guard)?.[1] ?? "";
    return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }

  function listTsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listTsFiles(full);
      return full.endsWith(".ts") && !full.endsWith(".spec.ts") ? [full] : [];
    });
  }

  const scannedPaths = readScannedPaths();
  const scannedFiles = scannedPaths.flatMap((rel) => {
    const abs = path.join(backendSrc, rel);
    return fs.statSync(abs).isDirectory() ? listTsFiles(abs) : [abs];
  });
  const backendCodes = new Set(
    scannedFiles.flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(/code: '([A-Za-z_]+)'/g)].map(
        (m) => m[1],
      ),
    ),
  );

  it("가드 범위를 읽고 백엔드 코드를 찾는다(경로가 어긋나 빈 집합이 되지 않는다)", () => {
    expect(scannedPaths).toContain("modules/auth");
    expect(scannedPaths).toContain("common/constants/workspace-roles.ts");
    expect(backendCodes.size).toBeGreaterThan(30);
  });

  it("모든 백엔드 auth 코드가 매핑되었거나 알고 있는 예외 목록에 있다", () => {
    const missing = [...backendCodes].filter(
      (code) =>
        !Object.hasOwn(SERVER_ERROR_CODE_TO_I18N, code) &&
        !UNMAPPED_CODES.has(code),
    );
    expect(missing).toEqual([]);
  });

  it("예외 목록에 매핑된 코드나 백엔드에 없는 코드가 남지 않는다", () => {
    const stale = [...UNMAPPED_CODES].filter(
      (code) =>
        Object.hasOwn(SERVER_ERROR_CODE_TO_I18N, code) ||
        !backendCodes.has(code),
    );
    expect(stale).toEqual([]);
  });
});
