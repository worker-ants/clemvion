# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이전 라운드(`01_42_44`)의 W-req(버퍼 gap 중 종료 유실) fix 는 `replay_unavailable`/`start()` 경로에서는 올바르나, 같은 함수를 호출하는 세 번째 지점인 **세션 복원(`applyConfig`) 경로**는 가드가 없어 teardown 직후 무효화된 토큰으로 SSE 를 재오픈하고 종료된 세션을 storage 에 되살리는 실질 회귀가 **실측 재현으로 확인**됨(side_effect·maintainability CRITICAL, requirement 재현 테스트로 뒷받침). 추가로 spec §3.1 이 이번에 추가된 terminal 예외를 반영하지 못한 SPEC-DRIFT 존재.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side-effect / maintainability | 세션 복원(`applyConfig`) 경로가 `seedWaitingFromStatus` 신규 terminal 단락에 대해 무방비 — teardown 직후 가드 없이 무조건 `openStream(saved,"0")`(무효화된 토큰으로 SSE 재오픈, 버퍼 replay 시 host `conversationEnded` 중복 발사 가능) + `scheduleRefresh()`(종료된 세션 기준 `refreshToken` 실제 호출 → 성공 시 방금 `clearSession()` 으로 지운 storage 를 종료된 세션 데이터로 재기록) 실행. `start()` 는 `startGenRef` 재확인(`:334`)으로 우연히 보호되나 `applyConfig` 는 대칭 가드가 없음. **실측 재현 확인**(requirement reviewer: `getEs() !== null` — EventSource 재생성됨을 테스트로 확인) | `codebase/channel-web-chat/src/widget/use-widget.ts:564-573`(`applyConfig`, 세션 복원) vs `:309-346`(`start()`, 특히 `:334` 가드) / `seedWaitingFromStatus` 정의 `:240-278` | `applyConfig` 에도 `start()` 와 동일한 재확인 가드 추가. 권장: `seedWaitingFromStatus` 가 "teardown 수행 여부"를 boolean 으로 반환하고, 3개 호출부(`start`/`applyConfig`/`replay_unavailable` 폴백) 모두 그 반환값으로 후속 `openStream`/`scheduleRefresh` 를 게이팅하도록 계약 통일. 회귀 테스트("복원된 세션이 이미 terminal → openStream 미호출 + phase ended") 추가 필수 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | terminal 처리(`teardownSession()`+`dispatch({type:"ENDED"})`+`bridgeRef.current?.sendEvent("conversationEnded",...)`) 3줄 시퀀스가 `handleEiaEvent` 의 기존 `TERMINAL_EVENTS` 분기와 `seedWaitingFromStatus` 의 신규 분기 두 곳에 그대로 복제 — 공유 계약이 코드로 강제되지 않아 위 CRITICAL 같은 호출부별 불일치가 컴파일/테스트로 드러나지 않음 | `use-widget.ts:184-189` vs `:249-255` | `endConversation(reason)` 같은 공용 헬퍼(`useCallback`, deps `[teardownSession]`)로 추출해 양쪽 모두 호출, 반환값으로 "이미 종료 처리됨"을 호출부가 판별하도록 강제 |
| 2 | 동시성 | `seedWaitingFromStatus` 전체가 `start()` 의 `startGenRef` staleness 가드를 적용받지 못함 — `replay_unavailable` 폴백은 fire-and-forget 호출(`:181`)이라, in-flight 중 사용자가 "새 대화"/"대화 종료"를 실행하면 지연 도착한 옛 `getStatus` 응답이 이미 교체되거나 리셋된 세션에 대해 `dispatch(WAITING)`(유령 UI) 또는 신규 terminal 분기의 `dispatch(ENDED)`+host 통지(살아있는 새 대화를 오탐 종료 통지)를 잘못 적용할 수 있음 | `use-widget.ts:240-278`(정의), 호출부 `:181`/`:332`/`:570` | `await` 직후 `session !== sessionRef.current`(또는 `startGenRef` 비교) 가드 추가 — CRITICAL #1 수정과 동일 메커니즘 공유 가능. `state`(React state) 대신 ref 기반 비교 사용(클로저 stale 값 회피) |
| 3 | 동시성 | SSE 라이브 terminal 분기(`:184-189`)와 REST 폴백의 신규 terminal 분기(`:249-255`)가 상호 배타적이지 않아, 버퍼 gap 타이밍에 따라 동일 종료 이벤트에 대해 host `conversationEnded` 가 두 경로에서 독립적으로 중복 발사될 수 있음(`endConversation()` 의 `if (state.phase === "ended") return;` 같은 중복 방지 가드가 이 두 분기에는 없음) | `use-widget.ts:184-189` vs `:249-255` | 위 staleness 가드 적용 시 함께 해소되거나, `endedRef` 플래그로 최초 1회만 종료 처리하도록 명시적 제한 |

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/7-channel-web-chat/1-widget-app.md §3.1` 이 "종료 신호가 아니므로 스트림·세션은 유지된다"고 **무조건** 서술하나, 이번 fix(`use-widget.ts:244-255`)는 `getStatus` 스냅샷 자체가 이미 terminal 이면(5분 버퍼 gap 안에 execution 이 종료된 경우) 세션 정리+`[ended]` 전이를 수행하도록 의도적으로 동작을 확장했다 — 코드가 정당한 버그 fix 로 옳고, spec 문구가 이 예외를 아직 반영하지 못한 전형적 spec drift | `spec/7-channel-web-chat/1-widget-app.md:104-107`; 동형 서술 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20` | 코드 변경 불필요. spec §3.1 에 "단, `getStatus` 스냅샷 자체가 이미 terminal 이면 표면 시드 대신 세션 정리+`[ended]` 전이를 수행한다"는 예외 문구 추가 + plan 항목 동형 서술 갱신 — `project-planner` 위임 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `mapCredential` 의 nullable 필드(`deviceName: null`, `lastUsedAt: null`) 분기가 신규 `webauthnList` 테스트에 미검증(happy path 값만 사용) | `webauthn.controller.spec.ts:47-87` (대응: `webauthn.controller.ts:377-391`) | null 값을 가진 credential 케이스 1건 추가(저비용·높은 회귀 검출력) |
| 2 | 테스트 | terminal 분기 회귀 테스트가 3개 호출부 중 `replay_unavailable` 1곳만 커버 — `applyConfig` 세션 복원 경로는 미검증(위 CRITICAL #1 이 테스트로 드러나지 않은 직접 원인) | `use-widget-eager-start.test.ts`; 호출부 `use-widget.ts:181/:332/:570` | `applyConfig` 복원 시 이미 terminal 인 세션 케이스(openStream 미호출 단언) 추가 |
| 3 | 범위 | 커밋 메시지의 "GET 판정 관용구 통일(5곳)" 서술이 실제 diff 와 불일치 — 기존 코드 중 실제로 관용구가 바뀐 곳은 1곳뿐(나머지는 신규 테스트가 처음부터 올바르게 작성됨) | `use-widget-eager-start.test.ts:1140` | 코드 변경 자체는 문제 없음. 서술 정확도만 사안 |
| 4 | 범위 | backend webauthn 테스트가 channel-web-chat 위젯 fix 커밋에 계속 번들 — 직전 라운드에서 이미 사용자 의도로 확인된 패턴의 연장이라 위반 아님 | 커밋 `e99f46145` | 조치 불필요. 향후 모듈 경계가 다른 fix 는 분리 커밋 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| side_effect | CRITICAL | `applyConfig` 복원 경로 가드 누락 — SSE 재오픈 + refreshToken 호출 + 세션 storage 부활 |
| maintainability | HIGH | 동일 이슈 + 근본 원인(terminal 처리 로직 중복, 공유 계약 부재) |
| requirement | MEDIUM | 위 이슈를 실측 재현(EventSource 재생성 확인) + SPEC-DRIFT(§3.1) |
| concurrency | LOW | `seedWaitingFromStatus` 전반의 staleness 가드 부재(레이스 2건, 근본원인은 CRITICAL #1 과 동일) |
| testing | LOW | 실행+mutation 검증 통과(29/29, 10/10), 잔여 커버리지 갭은 INFO 3건 |
| scope | NONE | fix 가 직전 리뷰 WARNING/INFO 5건에 1:1 대응, 범위 이탈 없음(INFO 2건은 서술 정확도 사안) |
| security | NONE | 신규 공격면·인젝션·인증 우회 없음, allow-list 검증 경로 확인 |
| api_contract | NONE | 엔드포인트/스키마/버전/인증 변경 없음, 순수 클라이언트 로직 보강 |
| user_guide_sync | NONE | 매트릭스 glob 1건 매칭되나 실질 사용자 가시 변경 없음(test-only 백필) |
| documentation | (미확인) | status=success 로 보고됐으나 `documentation.md` 파일이 생성되지 않음 — 재시도 필요 |

## 발견 없는 에이전트
security, api_contract, user_guide_sync — 모두 위험도 NONE, 확인성 INFO(조치 불필요)만 존재.

## 권장 조치사항
1. **[최우선/CRITICAL]** `applyConfig`(세션 복원) 경로에 `start()` 와 대칭인 재확인 가드 추가 — `seedWaitingFromStatus` 가 teardown 수행 여부를 반환하도록 하고 3개 호출부 모두 그 값으로 `openStream`/`scheduleRefresh` 를 게이팅. 회귀 테스트("복원된 세션이 이미 terminal → openStream 미호출") 필수 추가.
2. **[WARNING]** terminal 처리 3줄 로직을 공용 헬퍼(`endConversation(reason)`)로 추출해 두 지점(`handleEiaEvent`/`seedWaitingFromStatus`)의 복제를 제거 — 조치 1 의 재발 방지 구조화.
3. **[WARNING]** `seedWaitingFromStatus` 에 ref 기반 staleness 가드(`session !== sessionRef.current` 등) 추가 — fire-and-forget 레이스로 인한 유령 WAITING/중복 ENDED 통지 차단(조치 1과 동일 메커니즘 공유 가능).
4. **[SPEC-DRIFT]** `spec/7-channel-web-chat/1-widget-app.md §3.1` 및 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20` 에 이번 terminal 예외 문구 반영 — `project-planner` 위임, 코드 변경 불필요.
5. **[INFO]** `mapCredential` null 필드 케이스, `applyConfig` terminal 회귀 케이스를 테스트에 추가해 커버리지 갭 해소.
6. **[운영]** `documentation` reviewer 산출물(`documentation.md`) 미생성 확인 — 재실행하여 실제 문서 동기화 여부 확인 필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, user_guide_sync (10명)
  - **제외**: 아래 표 (4명, 세부 사유는 prompt 에 미포함되어 라우터 판단으로만 기록)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — diff 범위(위젯 상태 분기·테스트)상 성능 영향 경로 없음으로 추정(세부 사유 미제공) |
  | architecture | 라우터 판단 — 신규 모듈/구조 변경 없음으로 추정(세부 사유 미제공) |
  | dependency | 라우터 판단 — 의존성 파일 변경 없음(세부 사유 미제공) |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음(세부 사유 미제공) |