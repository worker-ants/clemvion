import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWidget } from "./use-widget";

// host → iframe 명령(wc:command) 라우팅 + show/hide/updateProfile 핸들러(§3.2) 검증.
// bridge 는 window 에서 메시지를 받는다(source 미지정 → 부모로 간주, origin 핀 전이라 수용).

function postCommand(action: string, extra: Record<string, unknown> = {}) {
  window.dispatchEvent(
    new MessageEvent("message", { data: { type: "wc:command", payload: { action, ...extra } } }),
  );
}

beforeEach(() => {
  // embed-config fetch 는 네트워크 없이 즉시 실패 → soft 허용(fail-open) 경로로 결정적 동작.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network in test")));
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useWidget — host commands (wc:command)", () => {
  it("hide → hidden=true, show → hidden=false (가시성 축)", () => {
    const { result } = renderHook(() => useWidget());
    expect(result.current.state.hidden).toBe(false);
    act(() => postCommand("hide"));
    expect(result.current.state.hidden).toBe(true);
    act(() => postCommand("show"));
    expect(result.current.state.hidden).toBe(false);
  });

  it("updateProfile → boot profile 에 shallow merge (다음 시작 반영)", async () => {
    const { result } = renderHook(() => useWidget());
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "wc:boot",
            payload: {
              apiBase: "http://example.test/api",
              triggerEndpointPath: "t1",
              profile: { plan: "free" },
            },
          },
        }),
      );
    });
    await waitFor(() => expect(result.current.config).not.toBeNull());
    act(() => postCommand("updateProfile", { profile: { plan: "pro", seat: 3 } }));
    expect(result.current.config?.profile).toEqual({ plan: "pro", seat: 3 });
  });

  it("updateProfile without config → no-op (부팅 전 안전)", () => {
    const { result } = renderHook(() => useWidget());
    act(() => postCommand("updateProfile", { profile: { x: 1 } }));
    expect(result.current.config).toBeNull();
  });
});

// `worldGenRef` 가 `useSessionGenerations()` 반환값이 된 뒤의 **구성 지점 계약**.
//
// 추출 전에는 지역 `useRef` 라 ESLint 가 안정성을 알아서 알았고 deps 에 넣을 필요도 없었다.
// 훅 반환값이 되면서 그 정적 보장이 사라져 4개 `useCallback` deps 에 손으로 넣었는데, 그러면
// **ref 객체가 매 렌더 동일해야만** 콜백 identity 가 보존된다. 하위 훅 테스트가 ref 안정성을
// 고정하지만, 실제로 깨졌을 때 드러나는 곳은 여기(useWidget 구성)다.
describe("useWidget — 콜백 참조 안정성 (worldGenRef deps 계약)", () => {
  it("재렌더해도 start·newChat·endConversation 참조가 유지된다", () => {
    const { result, rerender } = renderHook(() => useWidget());
    const before = {
      start: result.current.actions.start,
      newChat: result.current.actions.newChat,
      endConversation: result.current.actions.endConversation,
    };

    rerender();

    expect(result.current.actions.start).toBe(before.start);
    expect(result.current.actions.newChat).toBe(before.newChat);
    expect(result.current.actions.endConversation).toBe(before.endConversation);
  });
});
