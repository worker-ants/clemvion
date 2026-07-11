# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** `newChat`/`endConversation` 간 "세션·클라이언트 캡처 → optimistic teardown/dispatch → best-effort fire-and-forget 명령" 패턴 중복
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` `newChat` (L1090-1109) vs `endConversation` (L1123-1151)
  - 상세: 이번 diff 로 `newChat` 이 `endConversation` 과 거의 동일한 구조(정리 이전에 `sessionRef.current`/`clientRef.current` 캡처 → `resetSessionRefs`/teardown → optimistic `dispatch` → `client.interact(...).catch(e => console.warn(...))` best-effort) 를 독립적으로 재구현했다. 차이는 커맨드 페이로드(`{command:"cancel", reason:"user_new_chat"}` vs `end_conversation`/`cancel` 분기)와 로그 문구뿐이다. 향후 세 번째 종료류 액션(예: idle 강제 종료, admin kick)이 추가되면 동일 6단계 패턴이 다시 손으로 복제될 가능성이 높다.
  - 제안: "세션 스냅샷 캡처 → 로컬 teardown/optimistic dispatch → best-effort fire" 를 공용 헬퍼(예: `fireBestEffortCommand(session, client, command, logLabel)`)로 추출해 `newChat`/`endConversation` 이 커맨드 구성만 다르게 넘기도록 리팩터링을 백로그로 남길 것.

- **[WARNING]** `newChat` 의 coalesce 판정이 `widget-state.ts` 가 스스로 선언한 "phase 파생 로직 단일화" 원칙 밖에 별도 정의됨(잠재적 이중 진실)
  - 위치: `use-widget.ts` L1092 `if (startedRef.current && !sessionRef.current) return;` (주석: "판정 = `startedRef.current && !sessionRef.current`") vs `widget-state.ts` L92-93 자체 docstring `"phase 파생 로직은 본 모듈에 단일화(isTextInputSurface 선례) — 프레젠테이션 컴포넌트가 결과만 소비한다."`
  - 상세: 이 ref 조합은 사실상 `state.phase === "booting"` 과 동치를 의도한 것(주석에 그렇게 명시)이지만, `useCallback` 의존성 배열이 `[resetSessionRefs, start]` 뿐이라 stale-closure 회피 목적으로 `state.phase` 대신 두 개의 `ref` 를 직접 조합해 재도출했다. 결과적으로 "booting 여부" 를 판정하는 로직이 (a) `widget-state.ts::isActiveConversationPhase`/`WidgetPhase` enum 과 (b) `use-widget.ts` 의 `startedRef && !sessionRef` ref 조합, 두 곳에 독립적으로 존재한다. 현재는 두 정의가 동치이지만 향후 `WidgetPhase` 에 "시작은 했으나 세션 미확립"에 해당하지 않는 새 전이 phase 가 추가되거나, 반대로 세션 확립 시점의 의미가 바뀌면(예: persist 순서 변경) 두 정의가 조용히 어긋날 수 있다 — 컴파일러가 잡아줄 수 없는 암묵적 불변식이다.
  - 제안: 최소한 두 정의의 동치를 보증하는 회귀 테스트(예: 모든 `WidgetPhase` 값에 대해 `startedRef`/`sessionRef` 조합 결과와 `isActiveConversationPhase`/booting 여부가 일치함을 assert)를 추가하거나, 주석에 "이 조건이 깨지면 안 되는 이유"뿐 아니라 "언제 재검토해야 하는지"(WidgetPhase 확장 시 필수 재확인)를 명시해 향후 리팩터러가 두 지점을 함께 갱신하도록 유도할 것.

- **[INFO]** `use-widget.ts` 훅이 프레젠테이션(dispatch)·비즈니스(세션 lifecycle 판단)·데이터(EiaClient 네트워크 호출) 3계층을 단일 함수에 계속 응집시키는 기존 경향이 이번 diff(newChat +~20줄)로 더 심화
  - 위치: `use-widget.ts` `newChat` (L1090-1109)
  - 상세: `newChat` 은 이제 (1) coalesce 가드 판정 (2) ref 스냅샷 캡처 (3) teardown 오케스트레이션 (4) reducer dispatch (5) best-effort 네트워크 fire (6) 재시작(`start()`) 트리거까지 한 콜백에서 수행한다. 파일이 이미 `useTokenRefresh`/`usePendingMessageQueue` 로 일부 관심사를 성공적으로 분리해온 리팩터 방향과 대비된다. React 훅 자체가 순수 함수가 아니므로 세션 lifecycle 로직 단위테스트가 `renderHook` 경유로만 가능해 테스트 비용도 높아진다(실제로 이번 diff 의 테스트들이 모두 `renderHook`+`fetch` mock 경유).
  - 제안: 즉각적 blocking 사유는 아니며 파일 전반의 기존 스타일과 일관된 확장이다. 다만 세션 lifecycle(캡처→cancel/end→teardown→restart) 을 React 비의존 순수 오케스트레이터 모듈로 분리하면 SRP·테스트 용이성이 개선된다는 점을 리팩터 백로그 후보로 남긴다.

- **[INFO]** best-effort 실패 로깅 문구가 호출부마다 하드코딩 중복(`"[widget] <액션> 실패(...):"` 포맷)
  - 위치: `use-widget.ts` L1101-1106(신규), 기존 L916-919, L1145-1148 등과 동일 패턴 반복
  - 상세: 로깅 유틸이 없어 각 catch 블록이 프리픽스·문구를 독립적으로 작성한다. 기능적 결함은 아니나 포맷 drift(예: 대괄호 유무, 콜론 위치)를 유발하기 쉽다.
  - 제안: 필수는 아니나 `warnBestEffort(action: string, err: unknown)` 소형 헬퍼로 통합하면 유지보수성이 개선된다.

## 요약

이번 diff 는 §R9(single-flight coalesce + 확립 세션발 best-effort cancel)를 기존 `use-widget.ts` 세션 lifecycle 패턴(`resetSessionRefs`/`teardownSession`/ref 기반 gen guard) 위에 자연스럽게 확장한 변경으로, 순환 의존성이나 모듈 경계 위반, 레이어 전면 붕괴 같은 구조적 결함은 없다. `widget-state.ts` 는 로직 변경 없이 주석만 정합화했고, spec 문서(§R9)와 구현·테스트가 서로 대응되는 근거를 남겨 추적성은 양호하다. 다만 (1) `newChat`/`endConversation` 이 "캡처→teardown→dispatch→best-effort fire" 6단계 패턴을 반복 구현하고 있어 향후 유사 액션 추가 시 중복이 누적될 위험, (2) `newChat` 의 coalesce 판정(`startedRef && !sessionRef`)이 `widget-state.ts` 가 스스로 선언한 "phase 파생 로직 단일화" 원칙 밖에서 booting 조건을 재정의해 잠재적 이중 진실(dual source of truth)을 만든다는 점은 향후 `WidgetPhase` 확장 시 조용히 어긋날 수 있는 유지보수 리스크로 남는다. 두 항목 모두 즉시 차단할 결함은 아니며, 리팩터 백로그로 관리 가능한 수준이다.

## 위험도
MEDIUM
