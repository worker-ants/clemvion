import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/auth-providers", () => ({
  fetchEnabledOauthProviders: vi.fn(async () => []),
}));
vi.mock("@/components/auth/login-form", () => ({
  LoginForm: () => null,
}));

import LoginPage from "../page";

/** REQ-SESSION-038 — `redirect` 값이 하나뿐일 때만 로그인 폼에 넘긴다. */
describe("LoginPage — redirect 쿼리", () => {
  async function redirectProp(redirect?: string | string[]) {
    const element = await LoginPage({ searchParams: Promise.resolve({ redirect }) });
    return (element.props as { redirect?: string }).redirect;
  }

  it("값이 하나면 그대로 넘긴다", async () => {
    await expect(redirectProp("/workflows?q=a")).resolves.toBe("/workflows?q=a");
  });

  it("여러 번 오면 없는 것으로 본다", async () => {
    await expect(redirectProp(["/a", "/b"])).resolves.toBeUndefined();
  });

  it("없으면 넘기지 않는다", async () => {
    await expect(redirectProp(undefined)).resolves.toBeUndefined();
  });
});
