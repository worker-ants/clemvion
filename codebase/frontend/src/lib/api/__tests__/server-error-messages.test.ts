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
