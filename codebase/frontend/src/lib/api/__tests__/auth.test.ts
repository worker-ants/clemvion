import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AxiosResponse } from "axios";

// ─── mock client before importing the module under test ─────────────────────
const postMock = vi.fn();
const setAccessTokenMock = vi.fn();

vi.mock("../client", () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
  setAccessToken: (...args: unknown[]) => setAccessTokenMock(...args),
}));

import { switchWorkspaceApi, decodeActiveWorkspaceId } from "../auth";

function fakeAxios<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: {},
  } as unknown as AxiosResponse<T>;
}

/** base64url-encode a JWT payload into a `h.<payload>.sig` token. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${b64}.signature`;
}

beforeEach(() => vi.clearAllMocks());

describe("switchWorkspaceApi (결정1)", () => {
  it("POSTs /auth/workspaces/:id/switch and stores the re-issued access token", async () => {
    postMock.mockResolvedValue(fakeAxios({ data: { accessToken: "new-tok" } }));

    await switchWorkspaceApi("ws-9");

    expect(postMock).toHaveBeenCalledWith("/auth/workspaces/ws-9/switch");
    expect(setAccessTokenMock).toHaveBeenCalledWith("new-tok");
  });

  it("does not overwrite the token when the response lacks accessToken", async () => {
    postMock.mockResolvedValue(fakeAxios({ data: {} }));

    await switchWorkspaceApi("ws-9");

    expect(setAccessTokenMock).not.toHaveBeenCalled();
  });
});

describe("decodeActiveWorkspaceId (결정2 dual-read)", () => {
  it("reads the activeWorkspaceId claim", () => {
    expect(
      decodeActiveWorkspaceId(makeJwt({ sub: "u1", activeWorkspaceId: "ws-a" })),
    ).toBe("ws-a");
  });

  it("dual-read: falls back to legacy workspaceId when activeWorkspaceId is absent", () => {
    expect(
      decodeActiveWorkspaceId(makeJwt({ sub: "u1", workspaceId: "ws-legacy" })),
    ).toBe("ws-legacy");
  });

  it("prefers activeWorkspaceId over legacy workspaceId", () => {
    expect(
      decodeActiveWorkspaceId(
        makeJwt({ activeWorkspaceId: "ws-a", workspaceId: "ws-b" }),
      ),
    ).toBe("ws-a");
  });

  it("returns null for a token with no workspace claim", () => {
    expect(decodeActiveWorkspaceId(makeJwt({ sub: "u1" }))).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(decodeActiveWorkspaceId("not-a-jwt")).toBeNull();
    expect(decodeActiveWorkspaceId("")).toBeNull();
  });
});
