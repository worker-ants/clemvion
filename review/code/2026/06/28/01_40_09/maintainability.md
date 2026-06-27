# 유지보수성(Maintainability) 리뷰

리뷰 대상: `useWidget` God hook 분리 PR — `use-token-refresh.ts`, `use-pending-message-queue.ts` 신설 + `use-widget.ts` 리팩터

---

## 발견사항

### [INFO] `use-token-refresh.ts` — `scheduleRefresh` 재귀 자기 참조 방식의 인지 부담
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.ts` L740–L766
- 상세: `useCallback(function scheduleRefresh() { … scheduleRefresh(); … })` 형태로 named function expression 을 이용해 setTimeout 콜백 내에서 자기 재귀 호출을 구현했다. 이 패턴은 동작상 올바르지만 — `useCallback` 반환값과 함수 표현식 내부 이름이 별개 바인딩이라는 사실을 모르는 독자는 "내부 `scheduleRefresh()` 가 `useCallback` 밖의 심볼을 참조하는가?" 라고 혼동할 수 있다. 주석으로 설명이 되어 있으나, 이 패턴 자체가 React 에서 비관용적이라 인지 부담이 남는다.
- 제안: `useRef` 에 함수를 저장하는 패턴(`const scheduleRefreshRef = useRef(); scheduleRefreshRef.current = fn; setTimeout(() => scheduleRefreshRef.current())`) 또는 `useRef`-backed recursive helper 로 대체하면 패턴을 더 명확하게 만들 수 있다. 단, 기존 동작 보존이 최우선이므로 이번 PR 범위에서는 INFO 수준 관찰에 머문다.

### [INFO] `use-token-refresh.ts` — `cancelledRef` 초기화를 마운트 effect 에서 수행
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.ts` L769–L775
- 상세: `cancelledRef.current = false` 를 `useEffect` 안에서 실행한다. `useRef(false)` 초기값으로 이미 false 이므로, 첫 마운트에서는 effect 가 redundant 하다. Strict Mode 이중 마운트 시 unmount→remount 주기를 대비한 의도적 설계라면 주석에 그 이유를 명시하면 가독성이 향상된다.
- 제안: `// Strict Mode 이중 마운트 방어: unmount 후 remount 시 cancelled=false 로 복원` 한 줄 추가 권장.

### [INFO] `use-pending-message-queue.ts` — `pendingSendRef` 네이밍이 외부 노출 없이 내부 전용임에도 다소 장황
- 위치: `/codebase/channel-web-chat/src/widget/use-pending-message-queue.ts` L267
- 상세: 훅 내부에만 존재하는 ref 인데 `pendingSendRef` 라는 이름이 `pending` (대기 표면)과 혼동될 여지가 있다. 파라미터 `pending: PendingInteraction | null` 과 같은 스코프에 존재하므로 독자가 처음 읽을 때 관계를 파악하는 데 약간의 시간이 걸린다.
- 제안: `queuedTextRef` 또는 `pendingTextRef` 같이 "텍스트를 보관한다"는 의미를 명확히 드러내는 이름이 `pending` 과의 혼동을 줄인다. 기능상 영향 없으므로 INFO.

### [INFO] `use-token-refresh.test.ts` — `NINETY_MIN` 상수가 테스트 외부에서 의미를 설명하는 주석 없음
- 위치: `/codebase/channel-web-chat/src/widget/use-token-refresh.test.ts` L411
- 상세: `const NINETY_MIN = 90 * 60 * 1000` 는 어디서 비롯한 숫자인지 테스트 파일만 봐서는 알 수 없다. `OVER_SIXTY_MIN_MS` 는 인라인 주석으로 "refresh delay(만료90m-lead30m=60m)를 넘기는 점프"라고 설명하지만, `NINETY_MIN` 자체는 설명이 없다.
- 제안: `/** 테스트용 세션 만료 여유(90분) — TOKEN_REFRESH_LEAD_MS(30m) + 실 delay(60m) 구성용 */` 같은 JSDoc 한 줄 추가.

### [INFO] `use-widget.ts` — `applyConfig` 가 마운트 effect 내부 지역 함수로 선언됨
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts` L1588
- 상세: 이번 PR 의 변경 사항은 아니지만, `applyConfig` 가 deps=`[]` 인 mount-once effect 의 지역 closure 로 선언되어 있다. 이 함수가 `scheduleRefresh`, `seedWaitingFromStatus`, `openStream` 을 닫아 씀으로써 stale 참조 가능성에 대한 추론이 필요하다. 해당 함수들이 모두 stable 임을 아는 독자에게는 문제없지만, `scheduleRefresh` 가 외부 hook 에서 오는 새 결합 관계는 이 deps=`[]` 가정을 확인하는 주석 보강의 가치가 있다.
- 제안: `// scheduleRefresh/openStream/seedWaitingFromStatus 는 전부 stable ref 기반 → deps=[] 유효` 같은 주석 1행 추가.

### [INFO] `use-widget.test.ts` 에서 smoke test 가 두 케이스를 하나의 `it` 블록에 묶음
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.test.ts` L940–L944
- 상세: `refreshDelayMs·TOKEN_REFRESH_MIN_DELAY_MS 가 use-widget 에서 re-export 됨` 이라는 단일 test 케이스 안에 두 가지 assertion 이 존재한다. 이 자체가 smoke 목적이라 설계 의도로 받아들일 수 있으나, 테스트 실패 시 어느 assertion 에서 실패했는지 메시지가 덜 명확해진다.
- 제안: 두 assertion 을 각각의 `it` 블록으로 분리하거나 현상 유지. 차이가 크지 않아 INFO.

---

## 요약

이번 변경은 542라인 규모의 `useWidget` God hook 에서 `useTokenRefresh`와 `usePendingMessageQueue` 두 훅을 추출하는 behavior-preserving 리팩터로, 유지보수성 관점에서 전반적으로 우수하다. 각 훅의 책임이 명확히 분리되었고, 인터페이스(`PendingMessageQueueDeps`, `TokenRefreshDeps`)에 JSDoc 주석이 충실하게 작성되었으며, 하위호환 re-export 패턴도 명문화되어 있다. 네이밍은 코드베이스 컨벤션을 잘 따르고 있으며 매직 넘버는 상수(`TOKEN_REFRESH_LEAD_MS`, `TOKEN_REFRESH_MIN_DELAY_MS`)로 분리되어 있다. 발견된 사항은 모두 INFO 수준의 가독성 개선 제안으로, 기능 정확성이나 유지보수에 직접적 위협이 되는 Critical/Warning 사항은 없다.

## 위험도

NONE
