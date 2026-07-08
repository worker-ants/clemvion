/**
 * pickPlaintextSecret 순수 함수 단위 테스트 — create/regenerate/reveal 응답에서
 * 평문 비밀값 1개를 추출하는 보안 관련 로직(key ?? token ?? secret ?? password
 * 우선순위 체인)을 분리 후 회귀 가드한다.
 */
import { describe, it, expect } from "vitest";
import { pickPlaintextSecret } from "../auth-config-types";

describe("pickPlaintextSecret", () => {
  it("prefers `key` over the other secret fields", () => {
    expect(
      pickPlaintextSecret({ key: "k", token: "t", secret: "s", password: "p" }),
    ).toBe("k");
  });

  it("falls back to token, then secret, then password in order", () => {
    expect(pickPlaintextSecret({ token: "t", secret: "s", password: "p" })).toBe(
      "t",
    );
    expect(pickPlaintextSecret({ secret: "s", password: "p" })).toBe("s");
    expect(pickPlaintextSecret({ password: "p" })).toBe("p");
  });

  it("returns null when no secret field is present", () => {
    expect(pickPlaintextSecret({ headerName: "X-API-Key" })).toBeNull();
    expect(pickPlaintextSecret({})).toBeNull();
  });

  it("returns null for an undefined config", () => {
    expect(pickPlaintextSecret(undefined)).toBeNull();
  });

  it("returns null when the matched field is not a string", () => {
    expect(pickPlaintextSecret({ key: 1234 as unknown as string })).toBeNull();
  });
});
