import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSessionGenerations, type BootAttempt } from "./use-session-generations";

/**
 * `useSessionGenerations` 의 **축 분리** 계약.
 *
 * 종전에는 이 판정자들이 `use-widget.ts`(1100줄) 안에 있어 단위로 겨눌 수 없었고, 검증은
 * 전부 위젯 통합 테스트를 경유했다. 그런데 이 파일군의 반복 결함은 정확히 **어느 판정자가
 * 어느 축을 보느냐**에서 났다 — 특히:
 *
 * - `cannotApplyConfig` 가 world 를 보면 안 된다: 대체된 형제 시도가 복원 중 종료를 확정하면
 *   (`finalizeEnded`→world++) 그 **정당한** 무효화가 살아있는 마지막 부팅까지 stale 화해
 *   §3(재전송) 을 깨뜨렸다(17_36_57 concurrency CRITICAL, 재현 확인).
 * - `isAttemptStale` 은 반대로 world 를 **봐야** 한다 — 옛 세션으로 스트림을 열면 안 되므로.
 *
 * 두 판정자의 차이는 한 줄이고 이름만으로는 구분되지 않는다. 그래서 축을 직접 겨누는 단위
 * 테스트를 둔다 — 통합 테스트는 이 구분이 무너져도 다른 이유로 통과할 수 있다.
 */
describe("useSessionGenerations — 축 분리", () => {
  it("beginBootAttempt 는 boot 만 올린다 (부팅 시도는 세계를 바꾸지 않는다)", () => {
    const { result } = renderHook(() => useSessionGenerations());
    const worldBefore = result.current.worldGenRef.current;

    let a1!: BootAttempt;
    let a2!: BootAttempt;
    act(() => {
      a1 = result.current.beginBootAttempt();
      a2 = result.current.beginBootAttempt();
    });

    expect(a2.boot).toBe(a1.boot + 1); // 시도 세대는 증가 = 나중 시도가 앞선 것을 대체
    expect(result.current.worldGenRef.current).toBe(worldBefore); // world 는 불변
  });

  it("cannotApplyConfig 는 world 를 보지 않는다 (형제 시도의 정당한 종료가 살아있는 부팅을 죽이면 안 된다)", () => {
    const { result } = renderHook(() => useSessionGenerations());
    let attempt!: BootAttempt;
    act(() => {
      attempt = result.current.beginBootAttempt();
    });

    // 형제 시도가 복원 중 종료를 확정 → world 무효화. 이 시도는 아직 어떤 세션도 안 건드렸다.
    act(() => {
      result.current.worldGenRef.current++;
    });

    expect(result.current.cannotApplyConfig(attempt)).toBe(false); // 여전히 config 적용 자격 있음
  });

  it("isAttemptStale 은 world 를 본다 (옛 세션으로 스트림을 열지 않는다)", () => {
    const { result } = renderHook(() => useSessionGenerations());
    let attempt!: BootAttempt;
    act(() => {
      attempt = result.current.beginBootAttempt();
    });
    expect(result.current.isAttemptStale(attempt)).toBe(false); // 전제

    act(() => {
      result.current.worldGenRef.current++;
    });

    // 같은 입력에 대해 두 판정자가 **갈린다** — 이 대비가 축 분리의 관측 지점이다.
    expect(result.current.cannotApplyConfig(attempt)).toBe(false);
    expect(result.current.isAttemptStale(attempt)).toBe(true);
  });

  it("나중 시도가 앞선 시도를 대체한다 (boot 축)", () => {
    const { result } = renderHook(() => useSessionGenerations());
    let first!: BootAttempt;
    act(() => {
      first = result.current.beginBootAttempt();
      result.current.beginBootAttempt(); // 대체자
    });

    expect(result.current.cannotApplyConfig(first)).toBe(true);
    expect(result.current.isAttemptStale(first)).toBe(true);
  });

  it("언마운트는 되돌아오지 않는 종점 — 두 판정자 모두 참", () => {
    const { result } = renderHook(() => useSessionGenerations());
    let attempt!: BootAttempt;
    act(() => {
      attempt = result.current.beginBootAttempt();
      result.current.unmountedRef.current = true;
    });

    expect(result.current.cannotApplyConfig(attempt)).toBe(true);
    expect(result.current.isAttemptStale(attempt)).toBe(true);
  });

  it("isStale 은 world 축 단독 — 캡처 시점 이후 무효화 여부", () => {
    const { result } = renderHook(() => useSessionGenerations());
    const gen = result.current.worldGenRef.current;
    expect(result.current.isStale(gen)).toBe(false);

    act(() => {
      result.current.worldGenRef.current++;
    });
    expect(result.current.isStale(gen)).toBe(true);

    // 부팅 시도는 world 를 건드리지 않으므로 isStale 에 영향 없다.
    const gen2 = result.current.worldGenRef.current;
    act(() => {
      result.current.beginBootAttempt();
    });
    expect(result.current.isStale(gen2)).toBe(false);
  });

  it("판정자 참조는 렌더 간 안정적 (호출부 useCallback 의존성 계약)", () => {
    // 호출부가 이 함수들을 의존성 배열에 넣으므로, 매 렌더 새 참조면 effect 가 재실행된다.
    const { result, rerender } = renderHook(() => useSessionGenerations());
    const before = {
      isStale: result.current.isStale,
      beginBootAttempt: result.current.beginBootAttempt,
      cannotApplyConfig: result.current.cannotApplyConfig,
      isAttemptStale: result.current.isAttemptStale,
    };
    const refsBefore = {
      worldGenRef: result.current.worldGenRef,
      bootGenRef: result.current.bootGenRef,
      unmountedRef: result.current.unmountedRef,
    };
    rerender();
    // ref 객체 자체도 안정적이어야 한다 — `use-widget.ts` 가 `worldGenRef` 를 4개 useCallback 의
    // 의존성 배열에 넣기 때문이다(추출 전에는 지역 useRef 라 ESLint 가 안정성을 알아서 알았다).
    // 여기가 깨지면 그 콜백들이 매 렌더 새 참조가 되어 effect 가 재실행된다.
    expect(result.current.worldGenRef).toBe(refsBefore.worldGenRef);
    expect(result.current.bootGenRef).toBe(refsBefore.bootGenRef);
    expect(result.current.unmountedRef).toBe(refsBefore.unmountedRef);
    expect(result.current.isStale).toBe(before.isStale);
    expect(result.current.beginBootAttempt).toBe(before.beginBootAttempt);
    expect(result.current.cannotApplyConfig).toBe(before.cannotApplyConfig);
    expect(result.current.isAttemptStale).toBe(before.isAttemptStale);
  });

  it("두 축 동시 변화 — 대체된 시도 + world 무효화", () => {
    const { result } = renderHook(() => useSessionGenerations());
    let first!: BootAttempt;
    act(() => {
      first = result.current.beginBootAttempt();
      result.current.beginBootAttempt(); // boot 축: 대체
      result.current.worldGenRef.current++; // world 축: 무효화
    });

    // 각 축 단독으로도 참이므로 OR 결합상 참이어야 한다. 단일 축 테스트만 있으면
    // 결합 지점이 잘못 구현돼도(예: AND) 관측되지 않는다.
    expect(result.current.cannotApplyConfig(first)).toBe(true);
    expect(result.current.isAttemptStale(first)).toBe(true);
  });
});
