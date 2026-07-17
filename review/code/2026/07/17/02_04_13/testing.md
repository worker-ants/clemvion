# 테스트(Testing) 리뷰

> 대상: `webauthn.controller.spec.ts` / `use-widget-eager-start.test.ts` / `use-widget.ts` (+ `review/code/2026/07/17/01_42_44/**` 리뷰 산출물 커밋)

## 검증 수행 내역

정적 분석에 그치지 않고 실제 실행으로 다음을 확인했다.

- `npx vitest run src/widget/use-widget-eager-start.test.ts` → **29 passed** (RESOLUTION.md claim 과 일치).
- `npx jest src/modules/auth/webauthn/webauthn.controller.spec.ts` → **10 passed** (RESOLUTION.md claim 과 일치).
- **Mutation 검증 (terminal 분기, W-req)**: `seedWaitingFromStatus` 의 terminal 판정을 `if (false && ...)` 로 무력화 후 재실행 → **정확히 신규 1건만 실패**(`replay_unavailable 폴백에서 execution 이 이미 종료됐으면 → ENDED 전이`), 나머지 28건은 그대로 통과. 파일은 원상 복구 후 재확인(29 passed).
- **Mutation 검증 (envelope shape, W2)**: `webauthnList` 반환을 `{data:{items}}` → bare array 로 무력화 후 재실행 → **정확히 신규 2건만 실패**(정상 매핑 케이스 + 빈 배열 케이스), 나머지 8건은 그대로 통과. 파일은 원상 복구 후 재확인(10 passed).
- 두 mutation 실험 모두 `git status --short codebase/` 로 원상 복구 확인 완료(잔여 diff 없음).

RESOLUTION.md 에 기록된 "회귀 검출력(mutation 검증)" 주장은 실측으로 재현되며 신뢰할 수 있다.

## 발견사항

- **[INFO]** `webauthn.controller.spec.ts` — `mapCredential` 의 nullable 필드(`deviceName: null`, `lastUsedAt: null`) 분기가 `webauthnList` 신규 테스트에 커버되지 않음
  - 위치: `codebase/backend/src/modules/auth/webauthn/webauthn.controller.spec.ts:47-87` (신규 `describe('webauthnList', ...)`), 대응 프로덕션: `webauthn.controller.ts:377-391` (`mapCredential`)
  - 상세: `mapCredential` 시그니처는 `deviceName: string | null`, `lastUsedAt: Date | null` 을 명시적으로 다루고(`lastUsedAt ? ... : null`), 이는 credential 이름 미설정·미사용 상태를 나타내는 실사용 경로다(사용자가 아직 credential 을 명명하지 않았거나 한 번도 사용하지 않은 경우). 신규 테스트 2건은 모두 non-null happy path 만 값으로 채워 이 null 분기가 회귀에 노출돼 있다(예: `lastUsedAt ? ... : null` 을 실수로 `lastUsedAt.toISOString()` 로 바꿔도 신규 테스트는 통과).
  - 제안: `deviceName: null, lastUsedAt: null` 을 가진 credential 을 추가한 3번째 케이스(또는 기존 케이스 중 하나를 null 값으로 교체)로 null 매핑을 pin. 저비용 · 높은 회귀 검출력.

- **[INFO]** `use-widget-eager-start.test.ts` — terminal 분기 커버리지가 `seedWaitingFromStatus` 의 3개 호출부 중 1곳(`replay_unavailable` 폴백)에만 국한
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:181`(replay_unavailable 폴백), `:332`(`start()` 직후 seed), `:570`(`applyConfig()` 세션 복원 직후) — 셋 다 동일한 `seedWaitingFromStatus` 를 호출하고 그 안의 terminal 분기(`:249-255`)를 공유
  - 상세: 신규 terminal 테스트(`replay_unavailable 폴백에서 execution 이 이미 종료됐으면 → ENDED 전이`)는 SSE 이벤트 경로로만 이 분기를 검증한다. 세 호출부가 "동일 처리 를 받는다"는 RESOLUTION.md 의 주장 자체는 코드 리딩으로 타당하지만(단일 함수 공유이므로), **세션 복원 경로**(`applyConfig` — 탭 재로드로 저장된 세션을 복원했는데 그 사이 execution 이 이미 종료된 경우)는 실무적으로 발생 가능성이 낮지 않은 시나리오이고, 향후 리팩터로 세 호출부가 분기되면(예: 복원 경로에만 예외 처리 추가) 이 mutation 이 캐치되지 않는다.
  - 제안: 필수는 아니나, `applyConfig` 세션 복원 시 저장된 세션이 이미 terminal 상태인 케이스를 최소 1건 추가하면 "공유 함수라 안전하다"는 현재의 암묵적 전제를 명시적으로 고정할 수 있다.

- **[INFO]** `use-widget.ts` — terminal 처리 로직이 두 지점(`handleEiaEvent` 의 `TERMINAL_EVENTS` 분기 `:184-189`, `seedWaitingFromStatus` 의 인라인 terminal 분기 `:249-255`)에 구조적으로 복제됨(teardownSession → dispatch ENDED → sendEvent conversationEnded 3줄 시퀀스가 두 곳에 그대로 반복)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:184-189`, `:249-255`
  - 상세: 테스트 관점에서는 두 지점이 각자 별도 코드 경로이므로 하나를 고쳐도 다른 하나가 자동으로 보호되지 않는다 — 실제로 이번 fix 가 후자에서만 발견된 결함이었다는 사실이 이를 보여준다. 공용 헬퍼(`handleTerminal(reason)`)로 추출하면 향후 seed 경로가 하나 더 늘어도(예: 새 polling 경로) 동일 인용만으로 안전해지고, "각 호출부마다 별도 terminal 테스트가 필요하다"는 현재의 테스트 부채가 구조적으로 줄어든다.
  - 제안: 즉시 조치 불필요(기능 결함 아님). 이 영역에 seed/terminal 호출부가 더 늘어나는 다음 변경에서 추출을 권장(maintainability 리뷰 관점과 겹침).

- **[NONE]** `use-widget-eager-start.test.ts` — I2 fix(GET 판정 관용구 통일)가 실제로 5곳(`:611,656,1141,1216,1270`) 모두에 일관 적용됨을 grep 으로 확인. 잔여 불일치 없음.

- **[NONE]** 리뷰 산출물 커밋(`review/code/2026/07/17/01_42_44/*.md`, `_retry_state.json`, `meta.json`) — 애플리케이션 코드가 아닌 이전 리뷰 세션의 기록(historical artifact)이므로 테스트 존재/커버리지 관점의 대상이 아님. 내용상 특기할 테스트 관련 이슈 없음.

## 요약

이번 변경은 이전 ai-review(01_42_44)에서 지적된 두 커버리지 갭(W-req: `replay_unavailable` 폴백의 terminal 상태 미처리, W2: webauthn envelope shape pin 테스트 부재)을 정확히 겨냥해 메꾼다. 직접 실행으로 `use-widget-eager-start.test.ts` 29/29, `webauthn.controller.spec.ts` 10/10 통과를 재확인했고, 두 신규 테스트 그룹 모두에 대해 독립적으로 mutation(구현 무력화) 실험을 재현해 "구현을 깨면 정확히 신규 테스트만 실패한다"는 회귀 검출력 주장을 검증했다 — 이는 이 규모의 fix 치고는 이례적으로 높은 품질의 자체 검증이다. 테스트 격리(각 테스트가 독립 `fetchMock`/`EventSource` stub 소유, `beforeEach`/`afterEach` 로 전역 상태 초기화)와 가독성(JSDoc 에 spec/rationale cross-ref, 왜 이 케이스가 필요한지 설명)도 이 코드베이스의 기존 컨벤션과 일관되게 높은 수준을 유지한다. 남은 갭은 모두 저위험 INFO 수준이다: (1) `mapCredential` 의 nullable 필드(`deviceName`/`lastUsedAt` null) 분기가 신규 webauthn 테스트에서 unasserted, (2) `seedWaitingFromStatus` 의 terminal 분기가 3개 호출부 중 SSE 이벤트 경로 1곳으로만 검증되어 세션 복원(`applyConfig`) 경로의 동일 시나리오는 암묵적으로만 보호됨, (3) terminal 처리 로직이 두 곳에 복제돼 있어 테스트 부채가 구조적으로 두 배(이는 이번 fix 가 발견된 방식 자체가 실증). 세 항목 모두 즉시 차단 사유는 아니다.

## 위험도
LOW
