/**
 * pickPlaintextSecret 순수 함수 단위 테스트 — create/regenerate/reveal 응답에서
 * 평문 비밀값 1개를 추출하는 보안 관련 로직(key ?? token ?? secret ?? password
 * 우선순위 체인)을 분리 후 회귀 가드한다.
 */
import { describe, it, expect } from "vitest";
import {
  canRegenerate,
  isUnreadableConfig,
  pickPlaintextSecret,
} from "../auth-config-types";

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

describe("canRegenerate", () => {
  it("allows the types whose secret the product issues", () => {
    expect(canRegenerate("api_key")).toBe(true);
    expect(canRegenerate("bearer_token")).toBe(true);
    expect(canRegenerate("hmac")).toBe(true);
  });

  // Basic Auth 는 사용자 입력이라 새로 발급할 값이 없다. 서버도 400 으로 거부한다.
  it("does not allow basic_auth", () => {
    expect(canRegenerate("basic_auth")).toBe(false);
  });
});

describe("isUnreadableConfig", () => {
  it("is true only for the unreadable marker", () => {
    expect(isUnreadableConfig({ __unreadable: true })).toBe(true);
    expect(isUnreadableConfig({ key: "***1234" })).toBe(false);
    expect(isUnreadableConfig({ __unreadable: "true" })).toBe(false);
    expect(isUnreadableConfig(undefined)).toBe(false);
  });
});
