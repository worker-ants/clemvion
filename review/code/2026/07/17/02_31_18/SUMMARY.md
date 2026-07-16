# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 재발은 없으나(직전 라운드 CRITICAL/W1/W2/W3/SD1 fix 는 모두 정확히 반영·검증됨), 이번 fix 가 새로 도입한 `endedRef`/게이팅 계약 자체에 커버리지 공백 2건(host 중복 통지 재발 가능 경로, `applyConfig` stale race)이 남아 있고, 그 원인이 된 인라인 주석-실동작 불일치와 테스트 커버리지 공백이 다수 reviewer 에서 교차 확인됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용(Side Effect) | 신설된 `endedRef` "host `conversationEnded` 1회 발사" 가드가 `sendCommand` 의 `410 Gone` 종료 catch 경로를 커버하지 못함 — SSE terminal 로 먼저 종료된 뒤 in-flight `sendCommand` 가 410 을 받으면 `finalizeEnded` 를 거치지 않고 무조건 재차 `dispatch(ENDED)` + `sendEvent("conversationEnded")` 를 발사해 host 가 동일 종료를 2회 통지받을 수 있음(구체적 재현 시나리오 확인됨) | `codebase/channel-web-chat/src/widget/use-widget.ts:396-401`(`sendCommand` 410 catch, 미가드) vs `:166-174`(`finalizeEnded`) | `sendCommand` 의 410 catch 를 `finalizeEnded("gone")` 경유로 바꾸거나 진입부에 `if (endedRef.current) return;` 추가. 근본적으로는 `finalizeEnded`/`teardownSession` 이 `sessionRef.current = null` 도 수행해 후속 `sendCommand` 자체를 조기 차단. 회귀 테스트: "SSE terminal 후 in-flight 410" 시 1회만 발사되는지 단언 |
| 2 | 동시성(Concurrency) | `applyConfig`(세션 복원) 경로 — `seedWaitingFromStatus` 가 반환하는 `false` 가 "정상 시드"와 "staleness 로 인한 조용한 폐기"를 구분하지 못함. `start()` 는 자신만의 `startGenRef` 2차 재검증으로 우연히 안전하지만 `applyConfig` 는 이 재검증이 없어, 마운트 직후 getStatus 왕복 시간 안에 host 가 새 대화를 시작하면 지연 응답이 `openStream(saved,...)` 을 실행해 방금 시작된 새 대화의 정상 SSE 스트림을 stale 토큰으로 탈취할 수 있음(좁은 타이밍 창, 재현 시나리오 상세 확인됨) | `codebase/channel-web-chat/src/widget/use-widget.ts:615-620`(`applyConfig`) vs `:371-376`(`start()`의 대칭 이중 가드), `seedWaitingFromStatus` 정의 `:273-316` | `applyConfig` 에 `start()` 와 대칭인 재검증(`seedWaitingFromStatus` 호출 직후 `if (sessionRef.current !== saved) return;`) 추가. 근본적으로는 반환 타입을 `"ended" \| "stale" \| "continue"` 3-state 로 바꾸거나 `startGenRef` 유사 world-generation 카운터를 3개 호출부가 공유하도록 승격 |
| 3 | 문서화/유지보수성 [겹침: requirement·maintainability·documentation 3개 reviewer 공통 지적] | `handleEiaEvent` 의 `execution.replay_unavailable` 분기 인라인 주석이 이번 fix 이후에도 여전히 "종료 신호가 아니므로 스트림·세션은 유지" 로 무조건 서술 — spec(`§3.1`)은 terminal 예외를 정확히 명문화했으나 코드에 가장 가까운 인라인 주석은 갱신되지 않았고, `RESOLUTION.md`(SD1 행)는 "인라인 주석도 동형 갱신"이라고 **사실과 다르게** 기록함 | `codebase/channel-web-chat/src/widget/use-widget.ts:204-207` vs `spec/7-channel-web-chat/1-widget-app.md:104-114`, `review/code/2026/07/17/02_04_13/RESOLUTION.md`(SD1 행) | `use-widget.ts:204-207` 주석을 spec §3.1 과 동형으로 정정("기본적으로 유지하나, `seedWaitingFromStatus` 재조회 결과가 이미 terminal 이면 `finalizeEnded` 로 종료 확정"). RESOLUTION.md 소급 수정은 불필요하나 향후 라운드에서 이 처분 기록의 부정확성을 사실관계로 남길 것 |
| 4 | 유지보수성(Maintainability) | 공개 액션 `endConversation()` 이 신규 `finalizeEnded`/`endedRef` 1회 가드 체계에 편입되지 않고, 별도의 인라인 종료 시퀀스 + 별도 가드(`state.phase === "ended"`)를 독자 유지 — "종료 처리"라는 동일 개념이 파일 내 두 메커니즘(ref flag vs state 검사)으로 분산되어 있고, `resetSessionRefs()` 경유 시 `state.phase==="ended"` 인데 `endedRef.current===false` 인 불일치 상태도 발생 가능. 현재는 다른 가드(즉시 sessionRef null화)로 우연히 안전하나 CRITICAL 의 근본 원인("함수 안에 넣으면 모든 호출부가 안전할 것"이라는 착각)과 같은 패턴 | `codebase/channel-web-chat/src/widget/use-widget.ts`(`finalizeEnded` vs `endConversation`) | `endConversation` 도 `finalizeEnded(reason)` 을 호출하도록 통합(고유 로직은 유지), 또는 최소한 자체 종료 시퀀스 직후 `endedRef.current = true` 로 재설정해 두 가드 간 불변식 일치 |
| 5 | 테스트(Testing) | `start()` 자신의 신규 `ended` 게이팅(`:371-372`)을 직접 exercise 하는 회귀 테스트가 없음 — 그 줄을 삭제해도 현재 30개 테스트가 전부 통과할 가능성이 높음 | `codebase/channel-web-chat/src/widget/use-widget.ts:371-372` | webhook POST 응답 직후 최초 `getStatus` 가 곧바로 `completed` 를 반환하는 fetchMock 을 구성해 `openStream` 미호출 + `phase` 즉시 `ended` 전이를 단언하는 테스트 추가 |
| 6 | 테스트(Testing) [겹침: requirement 도 동일 문제 INFO 로 지적] | 신규 `applyConfig` 회귀 테스트의 `expect(refreshCalls).toBe(0)` 단언이 decorative — 세션 `expiresAt` 이 90분 뒤라 실제 refresh 지연은 약 60분(real timer), `vi.useFakeTimers()` 미사용이라 게이팅 성공/실패와 무관하게 항상 `refreshCalls===0` 이 됨. RESOLUTION.md 의 "3중 단언" 주장과 달리 실질 회귀 검출력은 `getEs()===null` 단언 1개에 의존 | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:247-248` vs `use-token-refresh.ts:21-24, 62-88`(`refreshDelayMs`/`scheduleRefresh`) | `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync(...)` 로 타이머 발화까지 진행하거나 `scheduleRefresh`/`refreshToken` 을 spy 로 감싸 호출 자체 여부를 직접 단언 |
| 7 | 테스트(Testing) [겹침: requirement 도 W3(dedup) 테스트 공백을 INFO 로 별도 지적] | 직전 라운드 concurrency WARNING W2(staleness 가드)·W3(`endedRef` 중복 방지)에 대한 전용 회귀 테스트가 없음 — 두 가드를 각각 무력화해도 현재 30개 테스트가 실패하지 않을 가능성. CRITICAL 이 바로 이런 테스트 갭 때문에 놓쳤던 전례와 동일 구조 | `codebase/channel-web-chat/src/widget/use-widget.ts:277`(W2 staleness 가드), `:180-190`(W3 `endedRef` 가드) | (a) `getStatus` 를 pending 상태로 잡아둔 채 세션을 교체한 뒤 resolve 시켜 stale 응답이 무시됨을 단언하는 W2 테스트, (b) SSE terminal 과 REST 폴백 terminal 이 근접 타이밍에 겹치는 케이스로 `conversationEnded` 발사 횟수가 1회임을 단언하는 W3 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/유지보수성 [겹침: documentation·maintainability] | `seedWaitingFromStatus` JSDoc 최상단 요약 줄이 이번 diff 로 확장된 책임(terminal 시 `finalizeEnded` 정리)을 반영하지 못함 — 직전 라운드부터 잔존, 회귀 아님 | `codebase/channel-web-chat/src/widget/use-widget.ts:246` 부근 | 요약 줄을 "현재 표면을 시드하거나, 스냅샷이 이미 terminal 이면 세션을 정리하고 ENDED 로 전이한다" 로 확장 |
| 2 | 문서화/유지보수성 [겹침: documentation·maintainability] | `ai-review` 인용 주석이 프로젝트 관례(`ai-review YYYY-MM-DD ...`)와 달리 날짜 없이 세션 시각(`02_04_13`)만 사용 — 이번 diff 에서 신규 3~4곳 추가되며 반복·확산 | `use-widget.ts`(4곳), `use-widget-eager-start.test.ts:211` | `(ai-review 2026-07-17 02_04_13 W1)` 처럼 날짜 포함 포맷으로 통일. 급하지 않으나 다음 정리 라운드에서 일괄 정정 권장 |
| 3 | 유지보수성(Maintainability) | `useWidget` 훅의 단일 함수 비대화가 계속 진행형 — 이번 diff 로 `endedRef`/`finalizeEnded`/staleness 가드/반환 게이팅 3곳이 추가되며 상태·계약이 계속 누적 | `codebase/channel-web-chat/src/widget/use-widget.ts`(`useWidget` 전체) | 즉시 조치 불필요. 향후 `useEiaStream`(가칭) 분리 시 종료 판정·teardown 계약을 단일 진입점으로 강제하는 설계 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 유일한 프로덕션 변경(`use-widget.ts`)은 순수 방어적 강화. 새 공격면·인젝션·시크릿 노출 없음 |
| requirement | LOW | mutation 테스트로 CRITICAL fix 정확성 직접 재현 확인. `handleEiaEvent` 인라인 주석 stale(WARNING) + RESOLUTION.md "동형 갱신" 주장 부정확 |
| scope | NONE | 직전 라운드 처분표(C1/W1/W2/W3/SD1/I1/I2) 7건 전부 1:1 정확 대응, 범위 이탈 없음 |
| side_effect | WARNING | `endedRef` 가드가 `sendCommand` 410 경로를 커버 못해 host 중복 통지 재발 가능 |
| maintainability | MEDIUM | 인라인 주석-동작 불일치, `endConversation` 종료 로직 이원화 — CRITICAL 근본원인과 동일 패턴 재발 우려 |
| testing | MEDIUM | `start()` 게이팅·W2/W3 전용 회귀 테스트 부재, `refreshCalls` decorative assertion |
| documentation | LOW | 인라인 주석 stale + RESOLUTION.md 부정확 기록을 가장 상세히 실증(diff 라인 단위 대조) |
| concurrency | MEDIUM | `applyConfig` 경로에 `start()` 와 비대칭인 stale-session `openStream` 탈취 race 잔존 |

## 발견 없는 에이전트

- **security** — INFO 수준 확인(방어적 강화, allow-list 유지, 시크릿 없음)만 존재, WARNING/CRITICAL 없음.
- **scope** — 직전 라운드 처분표 1:1 대조 결과 범위 이탈·불필요 변경 없음.

## 권장 조치사항

1. `sendCommand` 의 `410 Gone` catch 를 `finalizeEnded`(또는 `endedRef` 체크) 경유로 편입해 host `conversationEnded` 중복 발사를 막는다 (side_effect WARNING #1).
2. `applyConfig` 에 `start()` 와 대칭인 stale 재검증을 추가해 새 대화 SSE 스트림이 지연된 복원 응답에 탈취되는 race 를 차단한다 (concurrency WARNING #2).
3. `handleEiaEvent` 의 `execution.replay_unavailable` 인라인 주석을 spec §3.1 과 동형으로 정정하고, 다음 RESOLUTION.md 작성 시 "인라인 주석 동형 갱신" 처분 기록의 실제 이행 여부를 diff 대조로 재확인하는 관행을 둔다 (WARNING #3).
4. `endConversation` 을 `finalizeEnded` 가드 체계에 통합(또는 최소 `endedRef` 동기화)해 종료 로직의 이원화된 불변식을 하나로 합친다 (WARNING #4).
5. 테스트 커버리지 보강: `start()` 자체 게이팅 회귀 테스트 추가, `refreshCalls` decorative assertion 을 fake-timer/spy 기반으로 교체, W2(staleness)·W3(`endedRef` dedup) 전용 회귀 테스트 추가 (WARNING #5~7).
6. (저비용, 급하지 않음) `seedWaitingFromStatus` JSDoc 요약 줄 보강, `ai-review` 인용 주석 날짜 포맷 통일 (INFO #1~2).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (8명)
  - **제외**: 표 (6명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 — `concurrency` 는 router 자체 선정)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(이번 diff 범위 내 해당 없음으로 제외) |
  | architecture | 라우터 판단(이번 diff 범위 내 해당 없음으로 제외) |
  | dependency | 라우터 판단(신규/변경 의존성 없음) |
  | database | 라우터 판단(DB 스키마/쿼리 변경 없음) |
  | api_contract | 라우터 판단(외부 API 계약 변경 없음) |
  | user_guide_sync | 라우터 판단(사용자 가이드 영향 없음) |