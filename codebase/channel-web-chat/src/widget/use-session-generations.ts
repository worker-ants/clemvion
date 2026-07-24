// 세션 staleness 세대 축 — `useWidget()` 에서 분리(webchat-usewidget-extraction 1차 slice).
//
// **왜 이 묶음인가**: 이 파일군의 반복 결함은 규모가 아니라 **boot/world/unmount staleness 축의
// 응집도 부족**에서 났다(그 축에서만 9회, 매번 서로 반대편 구멍). 세 ref 와 네 판정자는 서로만
// 참조하는 닫힌 묶음이라 경계가 명확하고, 옮겨도 호출부 계약이 바뀌지 않는다.
//
// **`sessionEstablished()` 는 여기 없다 — 일부러다.** 그것은 `streamRef !== null` 이라 세대 축이
// 아니고, `beginBootAttempt` JSDoc 이 "boot 세대는 그 proxy 였고 **두 번 구멍이 났다**" 고 못박은
// 바로 그 혼동이다. 같이 묶으면 파일 이력이 분리하라고 말하는 두 축을 다시 합치게 된다.
//
// **부수 효과 — JSDoc 인접성 위험 해소**: 원본에서 이 선언들 사이에 다른 ref 를 끼워 넣어 주석이
// 유실된 사고가 두 번 있었고(`pendingResetRef`→`bootGenRef`, `bootGenRef`→`unmountedRef`) 방어가
// 경고 주석뿐이었다. 전용 파일로 옮기면 끼어들 것이 구조적으로 없다.

import { useCallback, useRef } from "react";

/** `applyConfig` 가 발급받는 부팅 시도 토큰 — world/boot 두 축을 하나로 묶는다. */
export interface BootAttempt {
  world: number;
  boot: number;
}

export interface SessionGenerations {
  worldGenRef: React.MutableRefObject<number>;
  bootGenRef: React.MutableRefObject<number>;
  unmountedRef: React.MutableRefObject<boolean>;
  isStale: (gen: number) => boolean;
  beginBootAttempt: () => BootAttempt;
  cannotApplyConfig: (attempt: { boot: number }) => boolean;
  isAttemptStale: (attempt: BootAttempt) => boolean;
}

export function useSessionGenerations(): SessionGenerations {
  /**
   * **world 세대 토큰 — 비동기 staleness 의 단일 진실**.
   *
   * 위젯의 모든 비동기 경로(webhook POST · `getStatus` · `interact`)는 응답이 도착할 때쯤 세계가
   * 바뀌어 있을 수 있다 — 종료 이벤트·410·새 대화·대화 종료·언마운트. 그때 지연 응답으로 최신
   * 상태를 덮으면 유령 표면·오종료·스트림 탈취가 난다.
   *
   * **계약**: 세계를 무효화하는 모든 지점이 `++worldGenRef.current` 하고, 모든 `await` 뒤에는
   * `if (isStale(gen)) return;` 로 재검증한다. 무효화 지점은 셋이다 —
   * (1) `teardownSession()` — 종료·410·새 대화·대화 종료가 전부 경유하는 choke point.
   *     단 config 확립 전에는 무효화할 세계가 없어 no-op (그 조기 return 주석 참조).
   * (2) `start()` — 새 execution 이 곧 직전 세계를 대체하므로 시작 자체가 무효화다.
   * (3) 언마운트 cleanup — `teardownSession` 을 거치지 않고 직접 bump 한다.
   *
   * **왜 하나로 합쳤나**: 종전에는 세대 카운터(`startGenRef`, `start()` 전용) · `sessionRef` 동일성
   * (`seed`/`sendCommand`) · `cancelled` 지역 플래그(`applyConfig` 초기 부팅) · `cancelledRef`
   * (`useTokenRefresh`, 아래 주입 지점 참조) **4종이 각기 다른 무효화 트리거**를 갖고 공존했다
   * (앞의 3종이 `use-widget.ts` 안, 4번째는 이미 분리된 훅 안에 있어 더 눈에 안 띄었다). 특히
   * `teardownSession()` 은 `sessionRef` 를 null 하지 않아
   * **`sessionRef` 동일성으로 지킨 경로는 SSE terminal 종료를 감지하지 못했다** — 그 결과 종료된
   * 위젯이 stale seed 응답으로 `awaiting_user_message` 로 되살아나는 버그가 있었다(재현 확인).
   * `start()` 가 매번 무사했던 것도 우연이 아니라 유일하게 올바른 가드(세대)를 썼기 때문.
   * 축이 하나로 합쳐지면서 호출부는 "무엇이 바뀌었는지" 를 구분할 필요 없이 **바뀌었으면 중단**
   * 하면 된다 (ai-review 2026-07-17 06_53_03 이후 구조 검토).
   *
   * *(`endedRef` 는 여기 합치지 않는다 — 그쪽은 staleness 가 아니라 **같은 세계 안에서 두 경로가
   * 같은 종료를 중복 통지**하는 것을 막는 별개 축이다.)*
   */
  const worldGenRef = useRef(0);
  /**
   * **부팅 시도 세대** — `applyConfig` 호출 1건 = 1세대. 나중 시도가 앞선 시도를 **대체**한다.
   *
   * `spec/7-channel-web-chat/2-sdk.md §3(재전송)` 은 host 가 iframe 재생성 없이 `wc:boot` 을 다시 보낼 수
   * 있고 **위젯은 마지막 `wc:boot` 의 config 를 적용**한다고 정한다. 그런데 `host-bridge` 는 in-flight
   * 여부를 보지 않고 매번 `applyConfig` 를 새로 기동하므로, 세대가 없으면 **`embed-config` 왕복의
   * resolve 순서가 승자를 정한다** — 먼저 보낸 config 가 나중에 resolve 하면 그게 이겨 §3(재전송) 을 어긴다
   * (재현 확인: `profile.plan` A→B 순서로 보내고 resolve 를 역전시키면 A 가 적용됐다).
   *
   * **`worldGenRef` 와 축이 다르다 — 합치지 말 것.** 부팅 시도는 세계를 바꾸지 않는다(그래서
   * `teardownSession` 은 config 확립 전엔 세대를 올리지 않는다 — 올렸다가 부팅 중 `applyConfig` 를
   * 죽여 **패널이 영원히 안 열리는** 회귀를 냈다). 세계 무효화 ≠ 시도 대체다.
   *
   * **`!cfg.apiBase` 조기 return 은 세대를 올리지 않는다** — 시도로 치지 않는다. 올리면 아무것도
   * 하지 않는 "죽은 대체자" 가 살아있는 시도를 밀어낸다.
   *
   * ⚠ **이 블록과 `bootGenRef` 선언 사이에 다른 선언을 끼워 넣지 말 것** — JSDoc 은 인접성으로만
   * 붙는다. `use-widget.ts` 에서 두 번 당했다(`pendingResetRef` 는 `bootGenRef` 삽입에, `bootGenRef` 는
   * `unmountedRef` 삽입에 각각 주석을 잃었다). 새 ref 는 이 블록 **위**나 `bootGenRef` **아래**에.
   *
   * *(이 훅으로 분리되면서 위험 자체는 크게 줄었다 — 1100줄 파일과 달리 여기엔 끼워 넣을 것이
   * 거의 없다. 그래도 경고를 남긴다: 후속 slice 가 이 파일로 상태를 더 옮겨올 예정이다.)*
   */
  const bootGenRef = useRef(0);
  /** 언마운트 여부 — world 무효화와 달리 **되돌아오지 않는** 종점이라 별도 축이다(`beginBootAttempt` §근거). */
  const unmountedRef = useRef(false);
  /**
   * 캡처한 `gen` 이후 세계가 무효화됐는가 — **모든 `await` 뒤의 표준 재검증**.
   *
   * `isStale(gen)` 을 손으로 복제하는 대신 이름을 붙였다. 이 관용구를 **빠뜨리는
   * 것**이 곧 이 파일군이 4라운드 연속 겪은 버그의 형태였으므로(`seedWaitingFromStatus` catch 분기·
   * `applyConfig` 비대칭), 의도가 이름으로 드러나고 `isStale` grep 하나로 전 지점을 셀 수 있어야
   * 한다 (ai-review 2026-07-17 09_36_01 maintainability).
   */
  const isStale = useCallback((gen: number) => worldGenRef.current !== gen, []);

  /**
   * 새 부팅 시도를 개시하고 그 **시도 토큰**을 반환한다 — 앞선 시도는 이 호출로 대체된다.
   *
   * `applyConfig` 는 세계 무효화(`worldGenRef`)와 시도 대체(`bootGenRef`) **두 축 모두**에 걸린다.
   * 그 둘을 호출부에서 손으로 AND 하지 않고 토큰 하나로 묶는 이유:
   *
   * 이 파일군이 **비대칭 가드 누락으로 CRITICAL 을 여러 번 냈다** — 한 호출부는 재검증하고 다른 호출부는
   * 빠뜨리는 형태(`02_04_13` C1 · `08_29_33` W2 · `09_36_01` W5, 그리고 `23_58_23` 의 `start()` 무방비
   * 되감기까지). 축을 하나 더 늘리면서 그 관용구를 손으로 복제하면 같은 실패를 초대한다. 토큰이면
   * **await 지점당 가드 호출은 여전히 1개**이고, 축이 늘어도 호출부가 아니라 이 predicate 한 곳만 바뀐다.
   * (`seedWaitingFromStatus` 의 표면 되감기 방어는 이 클래스가 반복 실패한 끝에 `sessionEstablished()`
   * 라는 **세 호출부 공통의 무조건 기본 가드**로 옮겨가 비대칭 자체를 구조적으로 없앴다 — 그 함수 JSDoc 참조.)
   *
   * 곁들여 `applyConfig` 는 `gen`(world 단독)을 **스코프에 두지 않는다** — 그래서 거기서
   * `isStale(gen)` 은 컴파일되지 않는다. **단 이건 좁은 보호다**: `use-widget.ts` 의 다른 함수에서 관용구를
   * 복사해 오는 가장 흔한 실수만 막을 뿐, `isStale(attempt.world)` 처럼 **일부러 축을 빼면 통과한다**
   * (실측 확인 — `isStale(worldGenRef.current)` 는 자기 자신과 비교해 **항상 false 인 무력 가드**가
   * 되는데도 컴파일된다). 타입 검사가 축 누락 일반을 막아주지는 **않는다**
   * (ai-review 2026-07-17 17_36_57 maintainability — 내 초기 주장이 과했다).
   *
   * 진짜 방어선은 **테스트**다: 두 재검증 지점 각각을 비대칭으로 제거하는 mutation 이 회귀 테스트에
   * 잡힌다(plan `webchat-boot-single-flight.md` §A-5 매트릭스). `guardedAwait` 구조화 대신 이 조합을
   * 택한 근거는 같은 plan §A-0.
   *
   * *(`bootGenRef` 는 **`applyConfig` 의 config 적용 경합에만** 쓴다 — `beginBootAttempt`(발급)와
   * `cannotApplyConfig`/`isAttemptStale`(재검증). `start()`/`sendCommand`/`seedWaitingFromStatus` 는
   * 이 축을 쓰지 않는다. 특히 `seedWaitingFromStatus` 의 표면 되감기 방어는 boot 세대 비교가 아니라
   * `sessionEstablished()`("스트림이 이미 열렸나")로 한다 — boot 세대는 그 proxy 였고 두 번 구멍이
   * 났다(18_39_11: 함수 경계에서 안 닿음 / 00_51_53: no-op 재전송이 start() 를 거짓 stale 처리해
   * 고착). 그 함수 JSDoc 표 참조.)*
   */
  const beginBootAttempt = useCallback(
    () => ({ world: worldGenRef.current, boot: ++bootGenRef.current }),
    [],
  );
  /**
   * 이 부팅 시도가 **config 를 적용할 자격을 잃었는가** — 첫 await(임베드 검증) 뒤의 재검증.
   *
   * **world 축을 보지 않는다.** 아직 어떤 세션도 건드리지 않은 시도에게 "세계가 바뀌었다"는 무의미하고,
   * 오히려 해롭다: 대체된 형제 시도가 복원 중 종료를 확정하면(`finalizeEnded`→world++) 그 **정당한**
   * 무효화가 **살아있는 마지막 부팅까지 stale 화해** §3(재전송) 을 깨뜨렸다(재현 확인 — config B 대신 A 고착).
   * 세션을 건드리는 복원 분기에서만 world 를 본다(`isAttemptStale`).
   * (ai-review 2026-07-17 17_36_57 concurrency CRITICAL)
   */
  const cannotApplyConfig = useCallback(
    (attempt: { boot: number }) =>
      unmountedRef.current || bootGenRef.current !== attempt.boot,
    [],
  );
  /** 복원 분기용 — config 적용 자격 **더하기** 세션 world 유효성(옛 세션으로 스트림을 열지 않는다). */
  const isAttemptStale = useCallback(
    (attempt: { world: number; boot: number }) =>
      cannotApplyConfig(attempt) || worldGenRef.current !== attempt.world,
    [cannotApplyConfig],
  );

  return {
    worldGenRef,
    bootGenRef,
    unmountedRef,
    isStale,
    beginBootAttempt,
    cannotApplyConfig,
    isAttemptStale,
  };
}
