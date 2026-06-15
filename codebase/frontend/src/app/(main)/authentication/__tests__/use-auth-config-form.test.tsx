/**
 * useAuthConfigForm 훅 직접 단위 테스트 — God Component 분리로 상태 전환 로직이
 * page.tsx 에서 본 훅으로 집중됐으므로 회귀 가드를 훅 레벨에서 확보한다.
 * dialogMode 제어(openCreate/openEdit/close)·필드 초기화·collectFormState·
 * validateAndProceed 각 검증 분기를 renderHook 으로 직접 검증한다.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocaleStore } from "@/lib/stores/locale-store";

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: (m: string) => toastError(m) },
}));

import { useAuthConfigForm } from "../use-auth-config-form";
import { AUTH_CONFIG_DEFAULTS } from "../auth-config-form";

const EXISTING = {
  id: "c1",
  name: "Prod Key",
  type: "api_key" as const,
  isActive: true,
  config: { headerName: "X-Old", key: "wfk_***1234" },
  ipWhitelist: ["10.0.0.0/8"],
};

describe("useAuthConfigForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLocaleStore.setState({ locale: "en" });
  });

  it("starts closed (mode null) with default field values", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    expect(result.current.mode).toBeNull();
    expect(result.current.editTargetId).toBeNull();
    expect(result.current.name).toBe("");
    expect(result.current.type).toBe("");
    expect(result.current.apiKeyHeader).toBe(AUTH_CONFIG_DEFAULTS.apiKeyHeader);
    expect(result.current.generatedKey).toBeNull();
  });

  it("openCreate switches to create mode without touching fields", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => result.current.setName("draft"));
    act(() => result.current.openCreate());
    expect(result.current.mode).toBe("create");
    expect(result.current.editTargetId).toBeNull();
    // openCreate 는 초기화하지 않는다(분리 전 page.tsx 와 동일 — close 가 초기화 담당).
    expect(result.current.name).toBe("draft");
  });

  it("openEdit populates non-secret fields from the masked config and locks the id", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => result.current.openEdit(EXISTING));
    expect(result.current.mode).toBe("edit");
    expect(result.current.editTargetId).toBe("c1");
    expect(result.current.name).toBe("Prod Key");
    expect(result.current.type).toBe("api_key");
    expect(result.current.apiKeyHeader).toBe("X-Old");
    expect(result.current.ipWhitelist).toBe("10.0.0.0/8");
    // 비밀값은 폼에 싣지 않는다.
    expect(result.current.password).toBe("");
  });

  it("close resets every field and returns to the closed state", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => result.current.openEdit(EXISTING));
    act(() => result.current.setName("changed"));
    act(() => result.current.setGeneratedKey("secret"));
    act(() => result.current.close());
    expect(result.current.mode).toBeNull();
    expect(result.current.editTargetId).toBeNull();
    expect(result.current.name).toBe("");
    expect(result.current.type).toBe("");
    expect(result.current.apiKeyHeader).toBe(AUTH_CONFIG_DEFAULTS.apiKeyHeader);
    expect(result.current.ipWhitelist).toBe("");
    expect(result.current.generatedKey).toBeNull();
  });

  it("collectFormState reflects the current field values", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => {
      result.current.setName("My Key");
      result.current.setType("api_key");
      result.current.setApiKeyHeader("X-Custom");
      result.current.setIpWhitelist("10.0.0.0/8");
    });
    expect(result.current.collectFormState()).toMatchObject({
      name: "My Key",
      type: "api_key",
      apiKeyHeader: "X-Custom",
      ipWhitelistRaw: "10.0.0.0/8",
    });
  });

  it("validateAndProceed blocks and toasts when the name is blank", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    const onValid = vi.fn();
    act(() => result.current.validateAndProceed(onValid, { requireType: true }));
    expect(onValid).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("validateAndProceed blocks when requireType is set but type is empty", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => result.current.setName("Has Name"));
    const onValid = vi.fn();
    act(() => result.current.validateAndProceed(onValid, { requireType: true }));
    expect(onValid).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
  });

  it("validateAndProceed enforces basic_auth password only when requirePassword is set", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => {
      result.current.setName("Basic");
      result.current.setType("basic_auth");
      result.current.setUsername("admin");
    });
    const onValid = vi.fn();
    // create 흐름(requirePassword) — password 비어 있으면 차단.
    act(() =>
      result.current.validateAndProceed(onValid, {
        requireType: true,
        requirePassword: true,
      }),
    );
    expect(onValid).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();

    // edit 흐름(requirePassword 미설정) — password 없이도 통과.
    onValid.mockClear();
    toastError.mockClear();
    act(() => result.current.validateAndProceed(onValid));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("validateAndProceed blocks on an invalid IP whitelist entry and names it", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => {
      result.current.setName("Key");
      result.current.setType("api_key");
      result.current.setIpWhitelist("10.0.0.0/8\nnot-an-ip");
    });
    const onValid = vi.fn();
    act(() => result.current.validateAndProceed(onValid, { requireType: true }));
    expect(onValid).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("not-an-ip"));
  });

  it("validateAndProceed invokes onValid for a well-formed payload", () => {
    const { result } = renderHook(() => useAuthConfigForm());
    act(() => {
      result.current.setName("Key");
      result.current.setType("api_key");
      result.current.setApiKeyHeader("X-API-Key");
      result.current.setIpWhitelist("10.0.0.0/8");
    });
    const onValid = vi.fn();
    act(() => result.current.validateAndProceed(onValid, { requireType: true }));
    expect(onValid).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });
});
