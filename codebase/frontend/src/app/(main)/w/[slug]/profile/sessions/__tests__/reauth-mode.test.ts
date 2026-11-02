import { describe, it, expect } from "vitest";
import { nextReauthMode } from "../reauth-mode";

function apiError(status: number, body: unknown) {
  return {
    isAxiosError: true,
    message: `Request failed with status code ${status}`,
    response: { status, data: body },
  };
}

const wrapped = (code: string) => ({ error: { code, message: "m" } });

// 근거: NERV CLE-ACCT-SESSION REQ-SESSION-025 (CLE-T-KTZ9YV)
describe("nextReauthMode", () => {
  it.each([
    {
      name: "403 REAUTH_NOT_AVAILABLE",
      status: 403,
      code: "REAUTH_NOT_AVAILABLE",
      current: "password",
      hasTotp: false,
      expected: "unavailable",
    },
    {
      name: "403 REAUTH_NOT_AVAILABLE (TOTP 켬)",
      status: 403,
      code: "REAUTH_NOT_AVAILABLE",
      current: "password",
      hasTotp: true,
      expected: "unavailable",
    },
    {
      name: "400 REAUTH_REQUIRED + TOTP 켬 + 비밀번호 입력 중",
      status: 400,
      code: "REAUTH_REQUIRED",
      current: "password",
      hasTotp: true,
      expected: "totp",
    },
  ] as const)(
    "$name → $expected",
    ({ status, code, current, hasTotp, expected }) => {
      expect(
        nextReauthMode(apiError(status, wrapped(code)), current, hasTotp),
      ).toBe(expected);
    },
  );

  it.each([
    ["TOTP 가 꺼진 계정", 400, "REAUTH_REQUIRED", "password", false],
    ["이미 인증 코드 입력 중", 400, "REAUTH_REQUIRED", "totp", true],
    ["비밀번호 오류(401)", 401, "PASSWORD_INVALID", "password", true],
    ["다른 400 코드", 400, "VALIDATION_ERROR", "password", true],
    [
      "REAUTH_REQUIRED 인데 상태가 400 이 아님",
      401,
      "REAUTH_REQUIRED",
      "password",
      true,
    ],
    [
      "REAUTH_NOT_AVAILABLE 인데 상태가 403 이 아님",
      400,
      "REAUTH_NOT_AVAILABLE",
      "password",
      true,
    ],
    ["403 인데 다른 코드", 403, "FORBIDDEN", "password", true],
  ] as const)("%s → 바꾸지 않는다", (_name, status, code, current, hasTotp) => {
    expect(
      nextReauthMode(apiError(status, wrapped(code)), current, hasTotp),
    ).toBeNull();
  });

  it("평탄한 { code } 본문도 읽는다", () => {
    expect(
      nextReauthMode(
        apiError(400, { code: "REAUTH_REQUIRED" }),
        "password",
        true,
      ),
    ).toBe("totp");
    expect(
      nextReauthMode(
        apiError(403, { code: "REAUTH_NOT_AVAILABLE" }),
        "password",
        false,
      ),
    ).toBe("unavailable");
  });

  it("응답이 없거나 axios 오류가 아니면 바꾸지 않는다", () => {
    expect(
      nextReauthMode(
        { isAxiosError: true, message: "Network Error" },
        "password",
        true,
      ),
    ).toBeNull();
    expect(nextReauthMode(new Error("boom"), "password", true)).toBeNull();
    expect(nextReauthMode(undefined, "password", true)).toBeNull();
  });
});
