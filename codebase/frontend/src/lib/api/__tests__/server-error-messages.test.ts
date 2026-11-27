import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";
import type { TFunction } from "@/lib/i18n";
import { en } from "@/lib/i18n/dict/en";
import { ko } from "@/lib/i18n/dict/ko";
import {
  SERVER_ERROR_CODE_TO_I18N,
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

  it("serverErrorKey 는 모르는 코드에 undefined 다", () => {
    expect(serverErrorKey(wrapped("SOMETHING_ELSE"))).toBeUndefined();
    expect(serverErrorKey(wrapped("TOTP_INVALID"))).toBe(
      "auth.login.invalidTotp",
    );
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
});

/**
 * 백엔드 `modules/auth` 가 내는 에러 코드가 매핑되거나 알고 있는 예외 목록에 있는지 대조한다. 영문이 된 서버 문구가
 * 한국어 화면에 그대로 보이는 코드를 새로 만들 때 여기서 걸린다(NERV Task CLE-T-1K5CWP).
 */
describe("백엔드 auth 에러 코드 대조", () => {
  /** 매핑 없이 서버 문구를 보이거나 화면이 직접 고르는 코드. 더하려면 사용자에게 보이는지 먼저 따진다. */
  const UNMAPPED_CODES = new Set([
    "ACCOUNT_LOCKED",
    "EMAIL_VERIFICATION_REQUIRED",
    "LOGIN_FAILED",
    "NO_WORKSPACE_AVAILABLE",
    "OAUTH_ACCOUNT_AMBIGUOUS",
    "OAUTH_CONFIG_MISSING",
    "OAUTH_EMAIL_REQUIRED",
    "OAUTH_PROFILE_FAILED",
    "OAUTH_PROVIDER_UNKNOWN",
    "OAUTH_STATE_MISMATCH",
    "OAUTH_TOKEN_EXCHANGE_FAILED",
    "RESOURCE_CONFLICT",
    "TOKEN_EXPIRED",
    "TOKEN_INVALID",
    "TOTP_NOT_INITIALIZED",
    "UNAUTHENTICATED",
    "VALIDATION_ERROR",
    "WEBAUTHN_CREDENTIAL_EXISTS",
    "WEBAUTHN_CREDENTIAL_NOT_FOUND",
    "WEBAUTHN_INVALID",
    "WEBAUTHN_VERIFY_FAILED",
    "invitation_email_mismatch",
  ]);

  function listTsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listTsFiles(full);
      return full.endsWith(".ts") && !full.endsWith(".spec.ts") ? [full] : [];
    });
  }

  const authDir = path.resolve(
    __dirname,
    "../../../../../backend/src/modules/auth",
  );
  const backendCodes = new Set(
    listTsFiles(authDir).flatMap((file) =>
      [...fs.readFileSync(file, "utf8").matchAll(/code: '([A-Za-z_]+)'/g)].map(
        (m) => m[1],
      ),
    ),
  );

  it("백엔드 코드를 찾는다(경로가 어긋나 빈 집합이 되지 않는다)", () => {
    expect(backendCodes.size).toBeGreaterThan(20);
  });

  it("모든 백엔드 auth 코드가 매핑되었거나 알고 있는 예외 목록에 있다", () => {
    const missing = [...backendCodes].filter(
      (code) => !(code in SERVER_ERROR_CODE_TO_I18N) && !UNMAPPED_CODES.has(code),
    );
    expect(missing).toEqual([]);
  });

  it("예외 목록에 매핑된 코드나 백엔드에 없는 코드가 남지 않는다", () => {
    const stale = [...UNMAPPED_CODES].filter(
      (code) => code in SERVER_ERROR_CODE_TO_I18N || !backendCodes.has(code),
    );
    expect(stale).toEqual([]);
  });
});
