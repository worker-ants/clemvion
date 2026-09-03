# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능(타이머 관리 하드닝)은 견고하고 CRITICAL 없음. 다만 **5개 reviewer(architecture·requirement·scope·maintainability·documentation)가 독립적으로 동일 패턴을 지적**했다 — 신규 심볼(`clearExpiryTimers` 메서드, `MSG_AUTH_TOKEN_EXPIRING` 상수)이 기존 JSDoc 블록과 그 문서화 대상 선언 사이에 끼워 넣어져, `armExpiryTimers`(핵심 설계 근거)와 `AuthTokenExpiredPayload`(wire 계약 설명)가 사실상 무문서 상태가 됐다. documentation reviewer 는 이를 MEDIUM 으로 판정했고, requirement reviewer 는 추가로 좁은 엣지 케이스(exp 없는 토큰으로 재무장 시 옛 타이머 누수 재발 가능성)를 별도로 발견했다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Maintainability | JSDoc 오귀속 — `websocket.gateway.ts`: `armExpiryTimers`의 설계 근거 JSDoc(§1.2, revoke 카브아웃·`exp` 부재 처리 등 15줄)이 신규 `clearExpiryTimers` 메서드+JSDoc 삽입으로 원래 대상(`armExpiryTimers`)에서 분리됐다. `armExpiryTimers`는 이제 인접 JSDoc이 전혀 없고, `clearExpiryTimers`(단순 해제 헬퍼)는 자신과 무관한 상위 설계 근거를 떠안았다. **architecture·requirement·scope·maintainability·documentation 5개 reviewer가 독립적으로 동일 지적** — 가장 강하게 corroborate 된 발견. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:162-190` | `clearExpiryTimers`(+그 JSDoc)를 `armExpiryTimers` 정의 뒤로 옮기거나, 기존 §1.2 JSDoc을 `armExpiryTimers` 바로 위로 재배치 |
| 2 | Documentation / Maintainability | JSDoc 오귀속 — `websocket-events.types.ts`: `AuthTokenExpiredPayload`를 설명하던 JSDoc(spec §4.6 shape, `expiresAt` 비소비 계약, 이전 리뷰 정정 이력 등)이 신규 `MSG_AUTH_TOKEN_EXPIRING` 상수 삽입으로 그 인터페이스 선언에서 분리됐다. `requirement·maintainability·documentation` 3개 reviewer가 독립 지적. | `codebase/backend/src/modules/websocket/websocket-events.types.ts:287-315` | `MSG_AUTH_TOKEN_EXPIRING`(+JSDoc)을 `AuthTokenExpiredPayload` 인터페이스 뒤로 옮기거나, `AuthEventType` enum 뒤로 이동 |
| 3 | Requirement | 엣지 케이스 — 재무장(rearm) 시 새 토큰에 `exp` claim이 없으면 `armExpiryTimers`의 조기 `return`이 신규 추가된 선제 `clearExpiryTimers(client.id)` 호출보다 먼저 실행돼, 옛 타이머 쌍이 해제되지 않고 맵에 남는다. 현재 `connectionStateRecovery` 미사용으로 도달 불가하나, 신규 rearm 테스트도 양쪽 연결 모두 `exp` 있는 경우만 커버해 이 조합은 미검증. | `codebase/backend/src/modules/websocket/websocket.gateway.ts:194,215` | `this.clearExpiryTimers(client.id)` 호출을 조기 `return`보다 앞(메서드 최상단)으로 이동 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Documentation / Scope | `expiryTimers` 필드 위에 신·구 JSDoc 두 블록이 중복 적재(내용 겹침) — 오귀속은 아니나 정리 여지 | `websocket.gateway.ts:147-160` | 두 블록을 하나로 병합 |
| 2 | Side Effect | `setTimeout(...).unref()` 도입으로 이벤트 루프 keep-alive 의미 변경 — 의도된 개선, 테스트로 검증됨. 그레이스풀 셧다운(SIGTERM 후 강제 timeout 없는 드레인)과의 상호작용은 배포 런북에서 별도 추적 중 | `websocket.gateway.ts:238-239` | 조치 불필요, 런북 유지 |
| 3 | Concurrency | `unref()`로 인해 정상 셧다운 경로에서 사전 통지/강제 종료 콜백이 실행되지 못할 수 있는 트레이드오프(plan에 별도 항목으로 이미 다뤄짐) | `websocket.gateway.ts:236-239` | 조치 불필요(문서화된 의도) |
| 4 | Testing | `재무장` 테스트는 현재 프로덕션에서 도달 불가능한 경로(동일 `client.id` 재사용)를 검증 — `connectionStateRecovery` 도입 시 유효한 선제 방어 테스트로 판단, 뮤테이션으로 실효성 확인됨 | `websocket.gateway.spec.ts:809` | 조치 불필요 |
| 5 | Testing | unref 테스트가 `created.length >= 2` + `slice(-2)`로 다소 느슨 — 향후 `setTimeout` 호출이 늘어도 통과 유지될 여지 | `websocket.gateway.spec.ts:832-843` | 선택적으로 `toBe(2)`로 정밀화 |
| 6 | Side Effect | `jest.spyOn(global, 'setTimeout')`이 `try/finally` 없이 `mockRestore()`에 의존 — `afterEach`의 `useRealTimers()`가 실질적으로 완화하나 방어적으로 감쌀 수 있음 | `websocket.gateway.spec.ts:833-843` | `try/finally`로 감싸기(선택적) |
| 7 | Maintainability | `MSG_AUTH_TOKEN_EXPIRING`(진행형) vs `AuthEventType.AUTH_TOKEN_EXPIRED`/`AuthTokenExpiredPayload`(완료형) — 시제 불일치가 향후 재질문을 부를 수 있음 | `websocket-events.types.ts:283-310` | JSDoc에 관계 설명 한 줄 추가(선택적) |
| 8 | API Contract | `MSG_AUTH_TOKEN_EXPIRING` 상수 승격은 순수 additive — wire 상 전송 값 자체는 리터럴과 동일, 하위 호환성 영향 없음 | `websocket-events.types.ts:309-310` | 조치 불필요 |
| 9 | Architecture / Security | `armExpiryTimers` 진입부 선제 `clearExpiryTimers` 호출은 현재 도달 불가(Socket.IO가 연결마다 새 `client.id` 발급)하나, `connectionStateRecovery` 활성화 시 load-bearing 해짐 — 인가 우회 경로는 없음(재무장은 항상 새로 검증된 `exp` 기반) | `websocket.gateway.ts:215` | 현행 유지, `connectionStateRecovery` 도입 시 가정 재확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가 로직 변경 없음, 새로운 취약점 없음 |
| performance | NONE | 전부 O(1), N+1/블로킹 I/O 없음, unref로 셧다운 성능 개선 |
| architecture | LOW | JSDoc 오귀속(`armExpiryTimers`↔`clearExpiryTimers`) 1건 |
| requirement | LOW | JSDoc 오귀속 2건 + rearm exp-less 엣지 케이스 1건, 뮤테이션 3종 재현 확인(70/70 통과) |
| scope | LOW | plan 5항목과 diff 1:1 대응 확인, JSDoc 오귀속 2건만 흠 |
| side_effect | LOW | unref/선제 clear는 의도된 하드닝, spy mockRestore 방어 여지 |
| maintainability | LOW | JSDoc 오귀속 2건(문서화와 중복 지적), 필드 JSDoc 중복 1건 |
| testing | NONE | 뮤테이션 3축 RED 직접 재현, vacuous 아님, 회귀 없음(70/70) |
| documentation | MEDIUM | JSDoc 오귀속 2건 — 5개 reviewer 중 가장 높은 위험도 판정 |
| concurrency | NONE | 전 경로 동기 구간, race/데드락 없음, 좀비 타이머 누수 오히려 차단 |
| api_contract | NONE | REST 표면 무영향, WS wire 값 불변(additive), 계약 신뢰성 개선 |

## 발견 없는 에이전트

없음(security/performance/testing/concurrency/api_contract는 CRITICAL/WARNING 없이 NONE 판정, INFO만 기록).

## 권장 조치사항
1. `websocket.gateway.ts`의 `armExpiryTimers` JSDoc(§1.2 설계 근거)을 `clearExpiryTimers` 삽입으로 인해 분리된 위치에서 원래 대상(`armExpiryTimers`) 바로 위로 복원 — 5개 reviewer가 corroborate 한 최우선 항목.
2. `websocket-events.types.ts`의 `AuthTokenExpiredPayload` JSDoc을 `MSG_AUTH_TOKEN_EXPIRING` 삽입 위치로부터 분리해 인터페이스 선언에 재인접시킨다.
3. `armExpiryTimers`의 선제 `clearExpiryTimers(client.id)` 호출을 `exp` 유효성 조기 `return`보다 앞으로 옮겨, exp 없는 토큰으로 재무장하는 조합에서도 옛 타이머 쌍이 정리되도록 한다(현재 도달 불가이나 이번 라운드가 "도달 불가와 검증 불가는 다르다"는 기준으로 5건을 닫은 직후라 일관성 있게 적용 권장).
4. (선택) `expiryTimers` 필드 위 중복 JSDoc 병합, unref 테스트 정밀화, spy `try/finally` 방어 — 낮은 우선순위.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff와 무관(신규 의존성 추가/제거 없음) |
  | database | router 판단상 이번 diff와 무관(DB 스키마/쿼리 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff와 무관(사용자 가이드 영향 없는 내부 리팩터) |