import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

let setAccessToken: typeof import("../client").setAccessToken;
let getAccessToken: typeof import("../client").getAccessToken;

describe("client token management", () => {
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("../client");
    setAccessToken = mod.setAccessToken;
    getAccessToken = mod.getAccessToken;
  });

  it("stores and retrieves token in memory", () => {
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
  });

  it("returns null when no token is set", () => {
    expect(getAccessToken()).toBeNull();
  });

  it("clears token when set to null", () => {
    setAccessToken("test-token");
    expect(getAccessToken()).toBe("test-token");
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  it("does not use sessionStorage", () => {
    setAccessToken("test-token");
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });
});

// `/auth/` 아래 401 은 대개 자격 증명 실패라 refresh 를 건너뛴다. 세션 관리 API 만
// refresh 쿠키 Path 때문에 `/auth/sessions` 아래에 있는 일반 JWT API 라서 예외다
// (NERV CLE-ACCT-SESSION, CLE-T-ERAJ7P).
describe("skipsRefreshRetry", () => {
  let skipsRefreshRetry: typeof import("../client").skipsRefreshRetry;

  beforeEach(async () => {
    vi.resetModules();
    ({ skipsRefreshRetry } = await import("../client"));
  });

  it.each([
    ["/auth/login", true],
    ["/auth/login/totp", true],
    ["/auth/refresh", true],
    ["/auth/2fa/disable", true],
    ["/auth/sessions", false],
    ["/auth/sessions/abc/revoke", false],
    ["/auth/sessions/revoke-others", false],
    ["/users/me", false],
    [undefined, false],
  ] as const)("%s → %s", (url, expected) => {
    expect(skipsRefreshRetry(url)).toBe(expected);
  });

  it("/auth/sessions 로 시작할 뿐 다른 경로면 건너뛴다", () => {
    expect(skipsRefreshRetry("/auth/sessionsx")).toBe(true);
  });
});

describe("401 응답의 refresh 재시도", () => {
  type Handler = (
    config: InternalAxiosRequestConfig,
    attempt: number,
  ) => AxiosResponse | number;

  async function setup(handlers: Record<string, Handler>) {
    vi.resetModules();
    const mod = await import("../client");
    const { AxiosError } = await import("axios");
    const calls: Array<{ method?: string; url?: string; auth?: unknown }> = [];
    const attempts = new Map<string, number>();
    mod.apiClient.defaults.adapter = async (config) => {
      const key = config.url ?? "";
      const attempt = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, attempt);
      calls.push({
        method: config.method,
        url: config.url,
        auth: config.headers.Authorization,
      });
      const handler = handlers[key];
      const result = handler ? handler(config, attempt) : 404;
      if (typeof result === "number") {
        throw new AxiosError(
          `status ${result}`,
          AxiosError.ERR_BAD_REQUEST,
          config,
          null,
          { data: {}, status: result, statusText: "", headers: {}, config },
        );
      }
      return result;
    };
    mod.setAccessToken("stale-token");
    return { mod, calls };
  }

  const ok = (
    config: InternalAxiosRequestConfig,
    data: unknown,
  ): AxiosResponse => ({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });

  it("/auth/sessions 의 401 은 refresh 뒤 새 토큰으로 다시 보낸다", async () => {
    const { mod, calls } = await setup({
      "/auth/sessions": (config, attempt) =>
        attempt === 1 ? 401 : ok(config, { data: { items: [] } }),
      "/auth/refresh": (config) =>
        ok(config, { data: { accessToken: "fresh-token" } }),
    });

    const res = await mod.apiClient.get("/auth/sessions");

    expect(res.data).toEqual({ data: { items: [] } });
    expect(calls.map((c) => c.url)).toEqual([
      "/auth/sessions",
      "/auth/refresh",
      "/auth/sessions",
    ]);
    expect(calls[2].auth).toBe("Bearer fresh-token");
    expect(mod.getAccessToken()).toBe("fresh-token");
  });

  it("/auth/login 의 401 은 refresh 없이 그대로 실패한다", async () => {
    const { mod, calls } = await setup({
      "/auth/login": () => 401,
      "/auth/refresh": (config) =>
        ok(config, { data: { accessToken: "fresh-token" } }),
    });

    await expect(
      mod.apiClient.post("/auth/login", { email: "a@b.c", password: "x" }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(calls.map((c) => c.url)).toEqual(["/auth/login"]);
  });
});
