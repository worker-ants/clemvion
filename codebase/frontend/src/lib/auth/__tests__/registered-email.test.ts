import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCheckEmail = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  authApi: {
    checkEmail: (...args: unknown[]) => mockCheckEmail(...args),
  },
}));

import { REGISTERED_EMAIL_CHECK_TIMEOUT_MS, isRegisteredEmail } from "../registered-email";

/**
 * 초대 가입 화면의 가입 여부 확인(CLE-ACCT-WS 「초대 가입 화면」 2 · 4단계). 확인하지 못하면 가입되지
 * 않은 것으로 보고 가입 폼을 띄운다.
 */
describe("isRegisteredEmail", () => {
  beforeEach(() => {
    mockCheckEmail.mockReset();
  });

  it("available=false 면 이미 가입된 이메일이다", async () => {
    mockCheckEmail.mockResolvedValue({ data: { data: { available: false } } });
    await expect(isRegisteredEmail("a@example.com")).resolves.toBe(true);
    expect(mockCheckEmail).toHaveBeenCalledWith("a@example.com", {
      timeout: REGISTERED_EMAIL_CHECK_TIMEOUT_MS,
    });
  });

  it("available=true 면 가입되지 않은 이메일이다", async () => {
    mockCheckEmail.mockResolvedValue({ data: { data: { available: true } } });
    await expect(isRegisteredEmail("a@example.com")).resolves.toBe(false);
  });

  it("응답에 data 가 없으면 가입되지 않은 것으로 본다", async () => {
    mockCheckEmail.mockResolvedValue({ data: {} });
    await expect(isRegisteredEmail("a@example.com")).resolves.toBe(false);
  });

  it.each([
    ["요청 한도 초과(429)", Object.assign(new Error("429"), { response: { status: 429 } })],
    ["네트워크 에러", new Error("Network Error")],
    ["시간 초과", Object.assign(new Error("timeout of 5000ms exceeded"), { code: "ECONNABORTED" })],
  ])("%s 면 가입되지 않은 것으로 본다", async (_label, error) => {
    mockCheckEmail.mockRejectedValue(error);
    await expect(isRegisteredEmail("a@example.com")).resolves.toBe(false);
  });

  it("시간 제한은 5초다", () => {
    expect(REGISTERED_EMAIL_CHECK_TIMEOUT_MS).toBe(5_000);
  });
});
