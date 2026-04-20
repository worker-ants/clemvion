import { afterEach, describe, expect, it, vi } from "vitest";

const getMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: getMock }),
}));

import {
  LOCALE_COOKIE_NAME,
  readLocaleCookie,
} from "../server-locale";

describe("readLocaleCookie", () => {
  afterEach(() => {
    getMock.mockReset();
  });

  it("returns the locale when the cookie holds a supported value", async () => {
    getMock.mockImplementationOnce((name: string) => {
      expect(name).toBe(LOCALE_COOKIE_NAME);
      return { value: "en" };
    });
    await expect(readLocaleCookie()).resolves.toBe("en");
  });

  it("returns null when the cookie is missing", async () => {
    getMock.mockReturnValueOnce(undefined);
    await expect(readLocaleCookie()).resolves.toBeNull();
  });

  it("returns null when the cookie value is not a supported locale", async () => {
    getMock.mockReturnValueOnce({ value: "jp" });
    await expect(readLocaleCookie()).resolves.toBeNull();
  });
});
