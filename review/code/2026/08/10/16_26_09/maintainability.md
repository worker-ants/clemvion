# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** (재판정 요청) 401 복구 로직을 별도 헬퍼로 추출하지 않기로 한 보류 근거가 검토한 설계 대안 하나에만 근거하고 있다 — 주입-없는 co-located 추출이 가능해 그 근거가 성립하지 않는다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:506-536`(보류 대상인 401 복구 블록, `seedWaitingFromStatus` catch 내부) — 보류 결정 자체는 `review/code/2026/08/10/16_09_40/SUMMARY.md`(`## 채택하지 않은 것` 표 1행)와 `review/code/2026/08/10/16_09_40/maintainability.md:8`(원 리뷰어의 제안문)에 기록됨. 참고 선례: `codebase/channel-web-chat/src/widget/use-token-refresh.ts:64-69`(`clearRefreshTimer`), `:73-105`(`scheduleRefresh`).
  - 상세: 이번 라운드의 보류 근거는 "넷(`isStale`/`configRef`/`sessionRef`/`finalizeEnded`)을 주입해야 해 시그니처가 본문보다 길어진다" 는 것이다. 이는 **원 리뷰어가 제안한 특정 설계**(module-level 순수 함수 + 의존성 객체 주입, 예: `recoverFromExpiredToken(client, session, gen, { isStale, configRef, sessionRef, finalizeEnded })`)에 대해서는 맞는 계산이다. 그러나 이 파일에는 그보다 비용이 낮은 대안이 이미 존재하고 실제로 쓰이고 있다 — `use-token-refresh.ts` 의 `scheduleRefresh`/`clearRefreshTimer` 처럼 **같은 훅 스코프 안에 sibling `useCallback` 으로 정의해 `isStale`/`configRef`/`sessionRef`/`finalizeEnded` 를 클로저로 그대로 캡처**하는 방식이다. `use-widget.ts` 자체도 `seedWaitingFromStatus` 를 정확히 이 방식(같은 4개 의존성을 deps 배열 `[finalizeEnded, isStale, sessionEstablished, worldGenRef]` 로 캡처, 506번 줄)으로 정의하고 있으므로, 401 블록만 sibling `useCallback` 으로 쪼개면 시그니처는 `(client: EiaClient, session: SessionRef, gen: number): Promise<SeedOutcome>` 세 인자로 끝나 **본문(약 20줄)보다 뚜렷이 짧다**. 이 대안을 채택하면 `seedWaitingFromStatus` catch 블록의 401 분기는 `if (err instanceof EiaError && err.status === 401) return recoverFromExpiredToken(client, session, gen);` 한 줄로 줄어, 함수 하나의 중첩 깊이(함수→catch→if→try/catch, 4단계)와 분기 수(~9-10개)를 실질적으로 낮출 수 있다 — 원래 WARNING 이 지적한 문제를 부작용 없이 해소한다. 즉 "다섯 번째 분기에 재판정" 이라는 유예 조건은 **상황이 바뀌어야 가능해지는 일이 아니라 지금도 가능한 더 나은 설계를 검토하지 않은 결과**로 보인다.
  - 제안: `use-token-refresh.ts` 의 `scheduleRefresh`/`clearRefreshTimer` 패턴을 그대로 따라 401 복구 시퀀스를 `useWidget()` 내부의 sibling `useCallback`(예: `recoverFromExpiredToken`)으로 분리할 것을 재검토 권장. 의존성 주입 객체 없이 클로저로 기존 refs/콜백을 그대로 재사용하면 되므로 이전에 제기된 "시그니처가 본문보다 길어진다" 반론이 적용되지 않는다. 다음에 이 영역을 손볼 때가 아니라, 이번 판정에서 재평가할 가치가 있다.

- **[INFO]** (재판정 확인) 테스트 `fetchMock` 파라미터화 보류는 근거가 유효해 보인다 — 추가 조치 불필요
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:268-444`(신규 `it` 4건), 보류 판단은 `review/code/2026/08/10/16_09_40/SUMMARY.md`(`## 채택하지 않은 것` 표 2행)와 `review/code/2026/08/10/16_09_40/maintainability.md:16-19`(원 발견사항 자체).
  - 상세: 원 리뷰어가 이 항목을 처음부터 "제안: … 필수는 아니며(테스트 각각이 자기완결적으로 읽히는 것도 장점)" 로 스스로 낮춰 적었고, 이번 보류 근거("네 케이스의 자기완결성이 이점. `410` 이 생기면 그때")는 그 원래 트레이드오프 판단과 모순되지 않으며 재추출 트리거(다섯 번째 유사 케이스 등장)도 구체적이다. 401 헬퍼 추출 건과 달리, 여기엔 "지금 당장 무비용으로 가능한 더 나은 설계"가 확인되지 않는다 — 4건이 이미 병렬·인접해 있고 각 케이스 diff 가 `status`/`refresh-token` 응답 1~2개 필드뿐이라, 지금 파라미터화해도 이득이 read-cost 절감 정도이고 팩토리 함수 자체의 간접 참조 비용과 상쇄된다. 보류가 타당하다.
  - 제안: 조치 불요. 5번째 유사 시나리오(예: `410`)가 추가되는 시점에 재평가하는 현재 계획 유지 권장.

- **[INFO]** `applyRefreshedToken` 추출은 직전 WARNING(4줄 리터럴 중복)을 실제로 닫았고 새 결함을 만들지 않았다
  - 위치: `codebase/channel-web-chat/src/lib/session-store.ts:125-133`(신규 함수), 호출부 `codebase/channel-web-chat/src/widget/use-token-refresh.ts:93-97`, `codebase/channel-web-chat/src/widget/use-widget.ts:522-526`.
  - 상세: 두 호출부 모두 인자 순서(`session, refreshed, triggerEndpointPath`)와 반환값 사용(`sessionRef.current = applyRefreshedToken(...)`)이 동일 패턴이라 "저장하는 것은 하나" 라는 함수 JSDoc 의 의도가 실제 사용부에서도 지켜진다. 세대 검사(`isStale`)는 두 호출부 모두 이 함수 호출 **전**(또는 use-token-refresh 의 경우 `worldGenRef` 검사 후 곧바로)에 이미 처리돼 있어 "세대 검사는 호출부 책임" 이라는 JSDoc 계약과도 일치한다. `saveSession`/`loadSession`/`clearSession` 과 동일한 동사-접두 네이밍 컨벤션도 유지된다.
  - 제안: 조치 불요(확인용 기록).

- **[INFO]** `openStream` 직전 "최신 세션 재조회" 가드가 `start()`와 `applyConfig()`에서 서로 다른 널 처리 관용구로 구현돼 있다 — 둘 다 안전하지만 왜 다른지 설명이 없다
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:630-632`(`start()`: `const live = sessionRef.current; if (!live) return; openStream(live, "0");`) vs `codebase/channel-web-chat/src/widget/use-widget.ts:983-984`(`applyConfig()`: `const live = sessionRef.current ?? saved; openStream(live, "0");`)
  - 상세: 두 지점의 주석(626행 "**`sessionRef.current` 를 쓴다**", 982행 "`start()` 와 같은 이유로 ref 를 읽는다")은 같은 근거(401 refresh 가 토큰을 교체할 수 있다)를 인용해 "대칭"임을 암시하지만, 실제 널 처리는 다르다 — `start()` 는 `sessionRef.current` 가 falsy 면 **조용히 아무 것도 안 하고 리턴**(스트림 미오픈으로 남음)하는 반면 `applyConfig()` 는 `saved`(seed 이전에 캡처한, 이 CRITICAL 이 문제 삼았던 바로 그 "옛일 수 있는" 로컬 변수)로 **폴백**한다. 두 위치 모두 이 시점에 `sessionRef.current` 가 null 이 되려면 `resetSessionRefs`(`teardownSession` 포함, world gen 증가 동반)를 거쳐야 하므로 직전의 `isStale`/`sessionEstablished` 재검사를 이미 통과했다면 실무적으로 도달 불가능한 방어 코드로 보인다 — 즉 오늘은 동작 차이가 실질적 위험은 아니다. 다만 향후 이 불변식이 느슨해지면(예: 다른 경로가 gen 을 안 올리고 `sessionRef.current` 만 null 화) `applyConfig()` 쪽은 조용히 "옛(stale) 세션으로 폴백" 해 이번에 고친 CRITICAL 과 같은 형태(무효 토큰으로 SSE 오픈)를 재현할 수 있는 반면 `start()` 쪽은 안전하게 멈춘다 — 같은 목적의 코드가 실패 방향이 다르다.
  - 제안: 강제 아님. 다음에 이 두 지점을 손볼 일이 있으면 `applyConfig()` 도 `start()` 와 동일하게 `if (!live) return;` 형태로 맞추거나(또는 반대로), 왜 하나는 폴백이고 하나는 조기 return 인지 한 줄 근거를 남길 것을 권장.

## 요약

이번 diff 의 핵심 유지보수성 변화는 직전 라운드(16_09_40) SUMMARY 가 남긴 세 갈래 후속 판정 요청에 대한 응답이다. 4줄 리터럴 중복(WARNING #2)은 `session-store.ts` 의 `applyRefreshedToken` 추출로 실제로 닫혔고, 호출부 두 곳 모두 계약(세대 검사는 호출부 책임)을 지킨다. 테스트 `fetchMock` 파라미터화 보류(WARNING #3)는 원 리뷰어 자신의 "필수 아님" 판단과 정합하고 재추출 트리거도 구체적이라 타당하다. 그러나 401 복구 헬퍼 추출 보류(WARNING #1)의 근거 — "넷을 주입해야 시그니처가 본문보다 길어진다" — 는 원 리뷰어가 제안한 특정 설계(module-level 순수 함수 + 의존성 주입)에만 성립하며, 같은 파일이 `seedWaitingFromStatus` 자신에게 이미 쓰고 있는 클로저 기반 sibling `useCallback` 패턴(`use-token-refresh.ts` 의 `scheduleRefresh`/`clearRefreshTimer` 와 동일 관용구)으로 추출하면 의존성 주입 없이 시그니처를 3개 인자로 줄일 수 있어 반론이 성립하지 않는다. 즉 "다음에 재판정" 이라는 유예 조건은 상황 변화가 아니라 설계 탐색 미비에 기인한 것으로 보이므로, 이 보류는 재검토를 권장한다. 그 외 새로 관찰한 항목(`start()`/`applyConfig()` 의 null 처리 비대칭)은 오늘은 도달 불가능한 방어 코드 수준이라 낮은 우선순위다. CRITICAL 급 신규 결함은 없다.

## 위험도

LOW
